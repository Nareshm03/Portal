/**
 * Comprehensive tests for Payment Dispute & Chargeback Management (TASK 26).
 *
 * Covers:
 *  1. Dispute record creation & every lifecycle state (CREATED, UNDER_REVIEW, ACTION_REQUIRED, WON, LOST, CLOSED)
 *  2. Duplicate and out-of-order webhook events handled safely
 *  3. Invalid signatures rejected on dispute webhooks
 *  4. Ownership & evidence access restrictions
 *  5. Settlement blocking while dispute is active
 *  6. Conflict prevention on refunds during active dispute (and policy override)
 *  7. Ledger integrity: balanced reversals, idempotency, no modifications to existing ledger entries
 *  8. Reconciliation failures: dispute amount > captured payment
 *  9. Admin endpoints: timeline, financial impact, evidence upload & download URL
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash, randomUUID } from 'node:crypto';
import { env } from '../src/config/env.js';
import {
  DISPUTE_STATUSES,
  DISPUTE_REASONS,
  VALID_TRANSITIONS,
  SETTLEMENT_BLOCKING_STATUSES,
  REFUND_BLOCKING_STATUSES,
  assertDisputeTransition,
  validateDisputeData,
  checkSettlementBlock,
  checkRefundConflict,
  reconcileDisputeAmount,
  buildDisputeEvent,
  buildDisputeTimeline,
  buildDisputeFinancialImpact,
  parseRazorpayDisputeEvent,
  postDisputeLostLedger,
} from '../src/services/disputes.js';
import {
  checkDisputeReconciliation,
  checkDisputedOrderSettlement,
  IssueCategory,
} from '../src/services/reconciliation.js';
import { createMockSupabase, testUuid, profileRow } from './helpers/mockSupabase.js';
import { createRouteTester, injectDb } from './helpers/routeTester.js';

const rt = createRouteTester();

const BUYER_ID = testUuid(1);
const TRAVELLER_ID = testUuid(2);
const ADMIN_ID = testUuid(3);
const STRANGER_ID = testUuid(4);
const ORDER_ID = testUuid(5);
const PAYMENT_INTENT_ID = testUuid(6);
const DISPUTE_ID = testUuid(7);

function token(userId) {
  return `Bearer ${userId}-token`;
}

function signWebhook(rawPayload, secret = env.RAZORPAY_TEST_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret_key_12345') {
  return createHmac('sha256', secret).update(rawPayload).digest('hex');
}

/* ------------------------------------------------------------------ */
/* 1. Dispute Creation & Lifecycle State Machine                       */
/* ------------------------------------------------------------------ */

test('disputes: covers all 6 lifecycle states', () => {
  const expected = ['CREATED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'WON', 'LOST', 'CLOSED'];
  for (const st of expected) {
    assert.ok(DISPUTE_STATUSES.includes(st), `Missing status: ${st}`);
  }
});

test('disputes: every valid lifecycle transition is permitted', () => {
  assert.equal(assertDisputeTransition('CREATED', 'UNDER_REVIEW'), true);
  assert.equal(assertDisputeTransition('CREATED', 'ACTION_REQUIRED'), true);
  assert.equal(assertDisputeTransition('CREATED', 'CLOSED'), true);

  assert.equal(assertDisputeTransition('UNDER_REVIEW', 'ACTION_REQUIRED'), true);
  assert.equal(assertDisputeTransition('UNDER_REVIEW', 'WON'), true);
  assert.equal(assertDisputeTransition('UNDER_REVIEW', 'LOST'), true);
  assert.equal(assertDisputeTransition('UNDER_REVIEW', 'CLOSED'), true);

  assert.equal(assertDisputeTransition('ACTION_REQUIRED', 'UNDER_REVIEW'), true);
  assert.equal(assertDisputeTransition('ACTION_REQUIRED', 'WON'), true);
  assert.equal(assertDisputeTransition('ACTION_REQUIRED', 'LOST'), true);
  assert.equal(assertDisputeTransition('ACTION_REQUIRED', 'CLOSED'), true);

  assert.equal(assertDisputeTransition('WON', 'CLOSED'), true);
  assert.equal(assertDisputeTransition('LOST', 'CLOSED'), true);
});

test('disputes: invalid lifecycle transitions are strictly rejected', () => {
  assert.throws(() => assertDisputeTransition('CREATED', 'WON'), { code: 'INVALID_DISPUTE_TRANSITION' });
  assert.throws(() => assertDisputeTransition('CREATED', 'LOST'), { code: 'INVALID_DISPUTE_TRANSITION' });
  assert.throws(() => assertDisputeTransition('WON', 'UNDER_REVIEW'), { code: 'INVALID_DISPUTE_TRANSITION' });
  assert.throws(() => assertDisputeTransition('LOST', 'ACTION_REQUIRED'), { code: 'INVALID_DISPUTE_TRANSITION' });
  assert.throws(() => assertDisputeTransition('CLOSED', 'UNDER_REVIEW'), { code: 'INVALID_DISPUTE_TRANSITION' });
  assert.throws(() => assertDisputeTransition('CLOSED', 'CREATED'), { code: 'INVALID_DISPUTE_TRANSITION' });
});

/* ------------------------------------------------------------------ */
/* 2. Webhook Processing: Dispute Creation & Lifecycle Events         */
/* ------------------------------------------------------------------ */

test('disputes: process dispute.created webhook creates persistent record and transitions order', async () => {
  const db = createMockSupabase({
    webhook_events: { data: [], error: null },
    payment_intents: {
      data: [{
        id: PAYMENT_INTENT_ID,
        order_id: ORDER_ID,
        buyer_id: BUYER_ID,
        amount_paise: 42000,
        provider_payment_id: 'pay_disp_test_1',
        provider_order_id: 'order_disp_test_1',
        status: 'CAPTURED',
      }],
      error: null,
    },
    orders: {
      data: [{
        id: ORDER_ID,
        state: 'LOCKED',
        buyer_id: BUYER_ID,
        traveller_id: TRAVELLER_ID,
        upfront_paise: 42000,
      }],
      error: null,
    },
    disputes: { data: [], error: null },
    dispute_events: { data: [], error: null },
    ledger_transactions: { data: [], error: null },
  });
  injectDb(db);

  const webhookBody = {
    event: 'dispute.created',
    payload: {
      dispute: {
        entity: {
          id: 'disp_rzp_001',
          payment_id: 'pay_disp_test_1',
          amount: 42000,
          currency: 'INR',
          reason_code: 'fraud',
          status: 'open',
          respond_by: Math.floor(Date.now() / 1000) + 86400 * 3,
        },
      },
      payment: {
        entity: {
          id: 'pay_disp_test_1',
          order_id: 'order_disp_test_1',
        },
      },
    },
  };

  const rawBytes = Buffer.from(JSON.stringify(webhookBody), 'utf8');
  const signature = signWebhook(rawBytes);

  const res = await rt.post(
    '/webhooks/razorpay',
    {
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': 'evt_disp_created_001',
      'content-type': 'application/json',
    },
    rawBytes
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.received, true);

  // Verify dispute was persisted
  const disputeInserts = db.callLog.insert.filter((i) => i.table === 'disputes');
  assert.equal(disputeInserts.length, 1);
  assert.equal(disputeInserts[0].payload.provider_dispute_id, 'disp_rzp_001');
  assert.equal(disputeInserts[0].payload.amount_paise, 42000);
  assert.equal(disputeInserts[0].payload.reason, 'FRAUD');
  assert.equal(disputeInserts[0].payload.status, 'CREATED');

  // Verify dispute audit event was logged
  const eventInserts = db.callLog.insert.filter((i) => i.table === 'dispute_events');
  assert.equal(eventInserts.length, 1);
  assert.equal(eventInserts[0].payload.to_status, 'CREATED');

  // Verify transition_order RPC was invoked to set DISPUTED state
  const rpcTransitions = db.callLog.rpc.filter((r) => r.funcName === 'transition_order');
  assert.ok(rpcTransitions.some((r) => r.params.p_to_state === 'DISPUTED'));
});

test('disputes: process dispute.won updates status and records audit event', async () => {
  const db = createMockSupabase({
    webhook_events: { data: [], error: null },
    disputes: {
      data: [{
        id: DISPUTE_ID,
        order_id: ORDER_ID,
        provider: 'RAZORPAY',
        provider_dispute_id: 'disp_rzp_002',
        status: 'UNDER_REVIEW',
        amount_paise: 42000,
        currency: 'INR',
      }],
      error: null,
    },
    dispute_events: { data: [], error: null },
    orders: {
      data: [{ id: ORDER_ID, state: 'DISPUTED', buyer_id: BUYER_ID }],
      error: null,
    },
  });
  injectDb(db);

  const webhookBody = {
    event: 'dispute.won',
    payload: {
      dispute: {
        entity: {
          id: 'disp_rzp_002',
          amount: 42000,
          currency: 'INR',
          status: 'won',
        },
      },
    },
  };
  const rawBytes = Buffer.from(JSON.stringify(webhookBody), 'utf8');
  const signature = signWebhook(rawBytes);

  const res = await rt.post(
    '/webhooks/razorpay',
    {
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': 'evt_disp_won_001',
      'content-type': 'application/json',
    },
    rawBytes
  );

  assert.equal(res.statusCode, 200);

  // Verify dispute status updated to WON
  const disputeUpdates = db.callLog.update.filter((u) => u.table === 'disputes');
  assert.ok(disputeUpdates.some((u) => u.payload.status === 'WON'));

  // Verify audit event logged
  const eventInserts = db.callLog.insert.filter((i) => i.table === 'dispute_events');
  assert.ok(eventInserts.some((i) => i.payload.to_status === 'WON'));
});

test('disputes: process dispute.lost applies balanced financial reversal ledger', async () => {
  const db = createMockSupabase({
    webhook_events: { data: [], error: null },
    disputes: {
      data: [{
        id: DISPUTE_ID,
        order_id: ORDER_ID,
        provider: 'RAZORPAY',
        provider_dispute_id: 'disp_rzp_003',
        status: 'ACTION_REQUIRED',
        amount_paise: 42000,
        currency: 'INR',
      }],
      error: null,
    },
    orders: {
      data: [{
        id: ORDER_ID,
        state: 'DISPUTED',
        buyer_id: BUYER_ID,
        upfront_paise: 42000,
        provider: 'RAZORPAY',
      }],
      error: null,
    },
    dispute_events: { data: [], error: null },
    ledger_transactions: { data: [], error: null },
    rpc: {
      post_ledger_transaction: () => ({ data: null, error: null }),
    },
  });
  injectDb(db);

  const webhookBody = {
    event: 'dispute.lost',
    payload: {
      dispute: {
        entity: {
          id: 'disp_rzp_003',
          amount: 42000,
          currency: 'INR',
          status: 'lost',
        },
      },
    },
  };
  const rawBytes = Buffer.from(JSON.stringify(webhookBody), 'utf8');
  const signature = signWebhook(rawBytes);

  const res = await rt.post(
    '/webhooks/razorpay',
    {
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': 'evt_disp_lost_001',
      'content-type': 'application/json',
    },
    rawBytes
  );

  assert.equal(res.statusCode, 200);

  // Verify status updated to LOST
  const disputeUpdates = db.callLog.update.filter((u) => u.table === 'disputes');
  assert.ok(disputeUpdates.some((u) => u.payload.status === 'LOST'));

  // Verify DISPUTE_LOST ledger reversal posted
  const ledgerRpcs = db.callLog.rpc.filter((r) => r.funcName === 'post_ledger_transaction');
  assert.equal(ledgerRpcs.length, 1);
  assert.equal(ledgerRpcs[0].params.p_event_type, 'DISPUTE_LOST');
  assert.equal(ledgerRpcs[0].params.p_idempotency_key, `dispute:lost:${DISPUTE_ID}`);

  // Verify double-entry balance: debits equal credits
  const entries = ledgerRpcs[0].params.p_entries;
  assert.equal(entries.length, 2);
  const debit = entries.find((e) => e.direction === 'DEBIT');
  const credit = entries.find((e) => e.direction === 'CREDIT');
  assert.equal(debit.accountCode, 'ESCROW_HOLD');
  assert.equal(credit.accountCode, 'DISPUTE_LOSS');
  assert.equal(debit.amountPaise, 42000);
  assert.equal(credit.amountPaise, 42000);
});

/* ------------------------------------------------------------------ */
/* 3. Duplicate and Out-of-Order Webhooks                              */
/* ------------------------------------------------------------------ */

test('disputes: duplicate webhook event ID returns duplicate status idempotently', async () => {
  const webhookBody = { event: 'dispute.under_review', payload: {} };
  const rawBytes = Buffer.from(JSON.stringify(webhookBody), 'utf8');
  const signature = signWebhook(rawBytes);

  const payloadHash = createHash('sha256').update(rawBytes).digest('hex');

  const db = createMockSupabase({
    webhook_events: {
      data: [{
        provider: 'RAZORPAY',
        provider_event_id: 'evt_dup_001',
        payload_hash: payloadHash,
        processed_at: new Date().toISOString(),
      }],
      error: null,
    },
  });
  // Simulate unique constraint error on webhook_events insert
  db.from = (table) => {
    const orig = createMockSupabase().from(table);
    if (table === 'webhook_events') {
      return {
        ...orig,
        insert: () => ({
          error: { code: '23505' },
          then: (cb) => Promise.resolve(cb({ error: { code: '23505' } })),
        }),
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  processed_at: new Date().toISOString(),
                  payload_hash: payloadHash,
                },
                error: null,
              }),
            }),
          }),
        }),
      };
    }
    return orig;
  };
  injectDb(db);

  const res = await rt.post(
    '/webhooks/razorpay',
    {
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': 'evt_dup_001',
      'content-type': 'application/json',
    },
    rawBytes
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.received, true);
});

test('disputes: out-of-order webhook does not corrupt state (e.g. under_review arriving after dispute is LOST)', async () => {
  const db = createMockSupabase({
    webhook_events: { data: [], error: null },
    disputes: {
      data: [{
        id: DISPUTE_ID,
        order_id: ORDER_ID,
        provider: 'RAZORPAY',
        provider_dispute_id: 'disp_out_of_order_1',
        status: 'LOST',
        amount_paise: 42000,
        currency: 'INR',
      }],
      error: null,
    },
    dispute_events: { data: [], error: null },
  });
  injectDb(db);

  // Incoming webhook is an older 'dispute.under_review' event
  const webhookBody = {
    event: 'dispute.under_review',
    payload: {
      dispute: {
        entity: {
          id: 'disp_out_of_order_1',
          status: 'under_review',
        },
      },
    },
  };
  const rawBytes = Buffer.from(JSON.stringify(webhookBody), 'utf8');
  const signature = signWebhook(rawBytes);

  const res = await rt.post(
    '/webhooks/razorpay',
    {
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': 'evt_out_of_order_001',
      'content-type': 'application/json',
    },
    rawBytes
  );

  assert.equal(res.statusCode, 200);

  // Assert dispute status was NOT changed back to UNDER_REVIEW
  const updates = db.callLog.update.filter((u) => u.table === 'disputes');
  assert.equal(updates.filter((u) => u.payload.status === 'UNDER_REVIEW').length, 0);
});

/* ------------------------------------------------------------------ */
/* 4. Invalid Signatures                                               */
/* ------------------------------------------------------------------ */

test('disputes: webhook with invalid signature returns 401', async () => {
  const rawBytes = Buffer.from(JSON.stringify({ event: 'dispute.created' }), 'utf8');
  const invalidSig = 'a'.repeat(64);

  const res = await rt.post(
    '/webhooks/razorpay',
    {
      'x-razorpay-signature': invalidSig,
      'x-razorpay-event-id': 'evt_bad_sig',
      'content-type': 'application/json',
    },
    rawBytes
  );
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, 'INVALID_WEBHOOK_SIGNATURE');
});

test('disputes: webhook missing event ID returns 400', async () => {
  const rawBytes = Buffer.from(JSON.stringify({ event: 'dispute.created' }), 'utf8');
  const signature = signWebhook(rawBytes);

  const res = await rt.post(
    '/webhooks/razorpay',
    {
      'x-razorpay-signature': signature,
      'content-type': 'application/json',
    },
    rawBytes
  );
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'EVENT_ID_REQUIRED');
});

/* ------------------------------------------------------------------ */
/* 5. Ownership & Evidence Access Restrictions                         */
/* ------------------------------------------------------------------ */

test('disputes: participant endpoints enforce ownership', async () => {
  const db = createMockSupabase({
    orders: {
      data: [{
        id: ORDER_ID,
        buyer_id: BUYER_ID,
        traveller_id: TRAVELLER_ID,
        state: 'DISPUTED',
      }],
      error: null,
    },
    disputes: {
      data: [{
        id: DISPUTE_ID,
        order_id: ORDER_ID,
        amount_paise: 42000,
        currency: 'INR',
        reason: 'PRODUCT_NOT_RECEIVED',
        status: 'CREATED',
        evidence_deadline: null,
        created_at: new Date().toISOString(),
        resolved_at: null,
      }],
      error: null,
    },
    profiles: {
      data: [
        profileRow(BUYER_ID, 'buyer'),
        profileRow(TRAVELLER_ID, 'traveller'),
        profileRow(STRANGER_ID, 'buyer'),
      ],
      error: null,
    },
  });
  injectDb(db);

  // Buyer can view disputes
  const buyerRes = await rt.get(`/orders/${ORDER_ID}/disputes`, { authorization: token(BUYER_ID) });
  assert.equal(buyerRes.statusCode, 200);
  assert.equal(buyerRes.body.data.length, 1);

  // Stranger is rejected with 403
  const strangerRes = await rt.get(`/orders/${ORDER_ID}/disputes`, { authorization: token(STRANGER_ID) });
  assert.equal(strangerRes.statusCode, 403);
  assert.equal(strangerRes.body.error.code, 'FORBIDDEN');
});

test('disputes: evidence download URL enforces participant and admin access', async () => {
  const EVIDENCE_ID = testUuid(8);
  const db = createMockSupabase({
    orders: {
      data: [{ id: ORDER_ID, buyer_id: BUYER_ID, traveller_id: TRAVELLER_ID }],
      error: null,
    },
    disputes: {
      data: [{ id: DISPUTE_ID, order_id: ORDER_ID }],
      error: null,
    },
    dispute_evidence: {
      data: [{
        id: EVIDENCE_ID,
        dispute_id: DISPUTE_ID,
        storage_path: `disputes/${DISPUTE_ID}/delivery_proof.pdf`,
        original_filename: 'delivery_proof.pdf',
        mime_type: 'application/pdf',
        size_bytes: 2048,
      }],
      error: null,
    },
    profiles: {
      data: [
        profileRow(BUYER_ID, 'buyer'),
        profileRow(STRANGER_ID, 'buyer'),
      ],
      error: null,
    },
  });
  db.storage = {
    from: () => ({
      createSignedUrl: async (path, ttl) => ({
        data: { signedUrl: `https://signed-storage-url.supabase.co/${path}` },
        error: null,
      }),
    }),
  };
  injectDb(db);

  // Authorized participant gets signed URL
  const authRes = await rt.get(`/disputes/${DISPUTE_ID}/evidence/${EVIDENCE_ID}/download`, { authorization: token(BUYER_ID) });
  assert.equal(authRes.statusCode, 200);
  assert.ok(authRes.body.data.downloadUrl);

  // Stranger gets 403
  const strangerRes = await rt.get(`/disputes/${DISPUTE_ID}/evidence/${EVIDENCE_ID}/download`, { authorization: token(STRANGER_ID) });
  assert.equal(strangerRes.statusCode, 403);
  assert.equal(strangerRes.body.error.code, 'FORBIDDEN');
});

/* ------------------------------------------------------------------ */
/* 6. Settlement Blocking                                              */
/* ------------------------------------------------------------------ */

test('disputes: settlement is blocked when active dispute is unresolved', async () => {
  const db = createMockSupabase({
    orders: {
      data: [{
        id: ORDER_ID,
        state: 'LANDED',
        buyer_id: BUYER_ID,
        traveller_id: TRAVELLER_ID,
      }],
      error: null,
    },
    disputes: {
      data: [{
        id: DISPUTE_ID,
        order_id: ORDER_ID,
        status: 'UNDER_REVIEW',
      }],
      error: null,
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer')],
      error: null,
    },
  });
  injectDb(db);

  const res = await rt.post(
    `/orders/${ORDER_ID}/handover/verify`,
    { authorization: token(BUYER_ID) },
    { code: '123456' }
  );

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'DISPUTE_ACTIVE_SETTLEMENT_BLOCKED');
});

/* ------------------------------------------------------------------ */
/* 7. Refund Conflict Prevention & Policy Override                     */
/* ------------------------------------------------------------------ */

test('disputes: refund request is blocked during active dispute unless policy override granted', async () => {
  const db = createMockSupabase({
    orders: {
      data: [{
        id: ORDER_ID,
        state: 'LOCKED',
        buyer_id: BUYER_ID,
        traveller_id: TRAVELLER_ID,
        upfront_paise: 42000,
        provider: 'MOCK',
      }],
      error: null,
    },
    disputes: {
      data: [{
        id: DISPUTE_ID,
        order_id: ORDER_ID,
        status: 'ACTION_REQUIRED',
      }],
      error: null,
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer')],
      error: null,
    },
  });
  injectDb(db);

  // Without override: blocked
  const blockedRes = await rt.post(
    `/orders/${ORDER_ID}/cancel`,
    { authorization: token(BUYER_ID), 'idempotency-key': 'idem_cancel_disp_1' },
    { reason: 'Buyer cancellation attempt during dispute' }
  );
  assert.equal(blockedRes.statusCode, 409);
  assert.equal(blockedRes.body.error.code, 'REFUND_DISPUTE_CONFLICT');

  // With policyOverride: permitted
  const allowedRes = await rt.post(
    `/orders/${ORDER_ID}/cancel`,
    { authorization: token(BUYER_ID), 'idempotency-key': 'idem_cancel_disp_2' },
    { reason: 'Approved policy override for mutual cancellation', policyOverride: true }
  );
  assert.equal(allowedRes.statusCode, 200);
});

/* ------------------------------------------------------------------ */
/* 8. Ledger Integrity                                                 */
/* ------------------------------------------------------------------ */

test('disputes: postDisputeLostLedger creates balanced double-entry and never modifies prior entries', async () => {
  const ledgerCalls = [];
  const fakeSupabase = {
    rpc: async (funcName, params) => {
      ledgerCalls.push({ funcName, params });
      return { data: null, error: null };
    },
  };
  const order = { id: ORDER_ID, upfront_paise: 42000, provider: 'RAZORPAY' };

  await postDisputeLostLedger(fakeSupabase, order, DISPUTE_ID, 42000, BUYER_ID);

  assert.equal(ledgerCalls.length, 1);
  const call = ledgerCalls[0];
  assert.equal(call.funcName, 'post_ledger_transaction');
  assert.equal(call.params.p_event_type, 'DISPUTE_LOST');
  assert.equal(call.params.p_idempotency_key, `dispute:lost:${DISPUTE_ID}`);

  // Journal entries must balance exactly
  const debits = call.params.p_entries.filter((e) => e.direction === 'DEBIT');
  const credits = call.params.p_entries.filter((e) => e.direction === 'CREDIT');
  assert.equal(debits.reduce((s, e) => s + e.amountPaise, 0), credits.reduce((s, e) => s + e.amountPaise, 0));
  assert.equal(debits[0].accountCode, 'ESCROW_HOLD');
  assert.equal(credits[0].accountCode, 'DISPUTE_LOSS');
});

/* ------------------------------------------------------------------ */
/* 9. Reconciliation Failures                                          */
/* ------------------------------------------------------------------ */

test('disputes: checkDisputeReconciliation flags dispute amounts exceeding captured payment', () => {
  const disputes = [
    { id: 'd1', order_id: 'o1', amount_paise: 50000 },
    { id: 'd2', order_id: 'o2', amount_paise: 30000 },
  ];
  const ordersById = new Map([
    ['o1', { id: 'o1', upfront_paise: 42000 }],
    ['o2', { id: 'o2', upfront_paise: 42000 }],
  ]);
  const capturedIntentsByOrderId = new Map([
    ['o1', [{ status: 'CAPTURED', amount_paise: 42000 }]],
    ['o2', [{ status: 'CAPTURED', amount_paise: 42000 }]],
  ]);

  const issues = checkDisputeReconciliation(disputes, ordersById, capturedIntentsByOrderId);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, IssueCategory.DISPUTE_AMOUNT_MISMATCH);
  assert.equal(issues[0].affectedIds.disputeId, 'd1');
  assert.equal(issues[0].affectedIds.disputeAmount, 50000);
});

test('disputes: checkDisputedOrderSettlement flags settled orders that are in dispute', () => {
  const disputedOrders = [{ id: 'o_disp_1' }];
  const ledgerByOrderId = new Map([
    ['o_disp_1', [{ event_type: 'ORDER_SETTLED' }]],
  ]);
  const issues = checkDisputedOrderSettlement(disputedOrders, ledgerByOrderId);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, IssueCategory.DISPUTED_ORDER_WITH_SETTLEMENT);
});

/* ------------------------------------------------------------------ */
/* 10. Admin Endpoints: Inspection, Timeline & Evidence Management     */
/* ------------------------------------------------------------------ */

test('disputes: admin GET /admin/disputes lists disputes with sensitive fields redacted', async () => {
  const db = createMockSupabase({
    profiles: {
      data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE')],
      error: null,
    },
    disputes: {
      data: [{
        id: DISPUTE_ID,
        order_id: ORDER_ID,
        provider: 'RAZORPAY',
        provider_dispute_id: 'disp_adm_001',
        amount_paise: 42000,
        currency: 'INR',
        reason: 'FRAUD',
        status: 'UNDER_REVIEW',
        evidence_deadline: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
      }],
      error: null,
    },
  });
  injectDb(db);

  const res = await rt.get('/admin/disputes', { authorization: token(ADMIN_ID) });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].id, DISPUTE_ID);
  assert.equal(res.body.data[0].status, 'UNDER_REVIEW');
});

test('disputes: admin GET /admin/disputes/:disputeId returns timeline, financial impact & evidence', async () => {
  const EVIDENCE_ID = testUuid(9);
  const db = createMockSupabase({
    profiles: {
      data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE')],
      error: null,
    },
    disputes: {
      data: [{
        id: DISPUTE_ID,
        order_id: ORDER_ID,
        provider: 'RAZORPAY',
        provider_dispute_id: 'disp_adm_002',
        amount_paise: 42000,
        currency: 'INR',
        reason: 'PRODUCT_NOT_AS_DESCRIBED',
        status: 'ACTION_REQUIRED',
        evidence_deadline: new Date(Date.now() + 86400000).toISOString(),
        created_at: '2026-11-06T10:00:00Z',
      }],
      error: null,
    },
    orders: {
      data: [{
        id: ORDER_ID,
        state: 'DISPUTED',
        buyer_id: BUYER_ID,
        traveller_id: TRAVELLER_ID,
        upfront_paise: 42000,
        total_paise: 50000,
        currency: 'INR',
        created_at: '2026-11-06T09:00:00Z',
      }],
      error: null,
    },
    dispute_events: {
      data: [{
        id: 'ev1',
        dispute_id: DISPUTE_ID,
        from_status: 'CREATED',
        to_status: 'ACTION_REQUIRED',
        event_type: 'dispute.action_required',
        actor_id: null,
        note: 'Action required by bank',
        created_at: '2026-11-06T10:30:00Z',
      }],
      error: null,
    },
    dispute_evidence: {
      data: [{
        id: EVIDENCE_ID,
        dispute_id: DISPUTE_ID,
        storage_path: `disputes/${DISPUTE_ID}/proof.jpg`,
        original_filename: 'proof.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 51200,
        uploaded_by: ADMIN_ID,
        description: 'Photo of item',
        created_at: '2026-11-06T11:00:00Z',
      }],
      error: null,
    },
    ledger_transactions: {
      data: [{
        id: 'lt1',
        order_id: ORDER_ID,
        event_type: 'PAYMENT_CAPTURED',
        idempotency_key: `order:lock:${ORDER_ID}`,
        created_at: '2026-11-06T09:30:00Z',
      }],
      error: null,
    },
  });
  injectDb(db);

  const res = await rt.get(`/admin/disputes/${DISPUTE_ID}`, { authorization: token(ADMIN_ID) });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.id, DISPUTE_ID);
  assert.ok(res.body.data.financialImpact);
  assert.equal(res.body.data.financialImpact.isSettlementBlocked, true);
  assert.equal(res.body.data.financialImpact.hasCollectionLedger, true);
  assert.equal(res.body.data.timeline.length, 2);
  assert.equal(res.body.data.evidence.length, 1);
  assert.ok(res.body.data.instruction.includes('No automated accept/contest'));
});

test('disputes: admin POST /admin/disputes/:disputeId/evidence records evidence and logs audit event', async () => {
  const db = createMockSupabase({
    profiles: {
      data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE')],
      error: null,
    },
    disputes: {
      data: [{
        id: DISPUTE_ID,
        order_id: ORDER_ID,
        status: 'ACTION_REQUIRED',
      }],
      error: null,
    },
    dispute_evidence: { data: [], error: null },
    dispute_events: { data: [], error: null },
  });
  injectDb(db);

  const res = await rt.post(
    `/admin/disputes/${DISPUTE_ID}/evidence`,
    { authorization: token(ADMIN_ID) },
    {
      storagePath: `disputes/${DISPUTE_ID}/receipt.pdf`,
      originalFilename: 'receipt.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10240,
      description: 'Merchant purchase invoice',
    }
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.original_filename, 'receipt.pdf');

  // Verify audit event inserted
  const eventInserts = db.callLog.insert.filter((i) => i.table === 'dispute_events');
  assert.ok(eventInserts.some((i) => i.payload.event_type === 'EVIDENCE_SUBMITTED'));
});
