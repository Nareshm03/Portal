/**
 * Unit tests for the Dispute & Chargeback Management service.
 * All tests use an injected fake Supabase client — no live database.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockSupabase } from '../helpers/mockSupabase.js';
import { randomUUID } from 'node:crypto';
import {
  DISPUTE_STATUSES,
  DISPUTE_REASONS,
  VALID_TRANSITIONS,
  TERMINAL_STATUSES,
  SETTLEMENT_BLOCKING_STATUSES,
  REFUND_BLOCKING_STATUSES,
  RAZORPAY_EVENT_STATUS_MAP,
  RAZORPAY_REASON_MAP,
  assertDisputeTransition,
  normalizeDisputeReason,
  validateDisputeData,
  checkSettlementBlock,
  checkRefundConflict,
  reconcileDisputeAmount,
  buildDisputeEvent,
  buildDisputeTimeline,
  buildDisputeFinancialImpact,
  parseRazorpayDisputeEvent,
} from '../../src/services/disputes.js';

const ORDER_ID = randomUUID();
const DISPUTE_ID = randomUUID();
const PAYMENT_INTENT_ID = randomUUID();

test('DISPUTE_STATUSES includes all expected statuses', () => {
  assert.deepEqual([...DISPUTE_STATUSES].sort(), ['ACTION_REQUIRED', 'CLOSED', 'CREATED', 'LOST', 'UNDER_REVIEW', 'WON']);
});

test('DISPUTE_REASONS includes all expected reasons', () => {
  assert.ok(DISPUTE_REASONS.includes('FRAUD'));
  assert.ok(DISPUTE_REASONS.includes('PRODUCT_NOT_RECEIVED'));
  assert.ok(DISPUTE_REASONS.includes('DUPLICATE'));
});

test('VALID_TRANSITIONS matches expected state machine', () => {
  assert.deepEqual([...VALID_TRANSITIONS.CREATED].sort(), ['ACTION_REQUIRED', 'CLOSED', 'UNDER_REVIEW']);
  assert.deepEqual([...VALID_TRANSITIONS.WON], ['CLOSED']);
  assert.deepEqual([...VALID_TRANSITIONS.CLOSED], []);
});

test('TERMINAL_STATUSES only contains CLOSED', () => {
  assert.deepEqual([...TERMINAL_STATUSES], ['CLOSED']);
});

test('SETTLEMENT_BLOCKING_STATUSES blocks non-terminal active disputes', () => {
  assert.ok(SETTLEMENT_BLOCKING_STATUSES.has('CREATED'));
  assert.ok(SETTLEMENT_BLOCKING_STATUSES.has('UNDER_REVIEW'));
  assert.ok(SETTLEMENT_BLOCKING_STATUSES.has('ACTION_REQUIRED'));
  assert.ok(!SETTLEMENT_BLOCKING_STATUSES.has('WON'));
  assert.ok(!SETTLEMENT_BLOCKING_STATUSES.has('LOST'));
  assert.ok(!SETTLEMENT_BLOCKING_STATUSES.has('CLOSED'));
});

test('REFUND_BLOCKING_STATUSES mirrors settlement blocking', () => {
  assert.ok(REFUND_BLOCKING_STATUSES.has('CREATED'));
  assert.ok(REFUND_BLOCKING_STATUSES.has('ACTION_REQUIRED'));
  assert.ok(!REFUND_BLOCKING_STATUSES.has('WON'));
  assert.ok(!REFUND_BLOCKING_STATUSES.has('LOST'));
});

test('assertDisputeTransition allows valid transitions', () => {
  assert.equal(assertDisputeTransition('CREATED', 'UNDER_REVIEW'), true);
  assert.equal(assertDisputeTransition('UNDER_REVIEW', 'WON'), true);
  assert.equal(assertDisputeTransition('WON', 'CLOSED'), true);
});

test('assertDisputeTransition rejects invalid transitions', () => {
  assert.throws(() => assertDisputeTransition('CREATED', 'WON'), { code: 'INVALID_DISPUTE_TRANSITION' });
  assert.throws(() => assertDisputeTransition('WON', 'UNDER_REVIEW'), { code: 'INVALID_DISPUTE_TRANSITION' });
  assert.throws(() => assertDisputeTransition('CLOSED', 'WON'), { code: 'INVALID_DISPUTE_TRANSITION' });
  assert.throws(() => assertDisputeTransition('UNKNOWN', 'CREATED'), { code: 'UNKNOWN_DISPUTE_STATUS' });
});

test('normalizeDisputeReason maps Razorpay codes correctly', () => {
  assert.equal(normalizeDisputeReason('fraud'), 'FRAUD');
  assert.equal(normalizeDisputeReason('duplicate'), 'DUPLICATE');
  assert.equal(normalizeDisputeReason('product_not_received'), 'PRODUCT_NOT_RECEIVED');
  assert.equal(normalizeDisputeReason('unknown_reason'), 'OTHER');
  assert.equal(normalizeDisputeReason(''), 'OTHER');
  assert.equal(normalizeDisputeReason(null), 'OTHER');
});

test('validateDisputeData accepts valid data', () => {
  const validated = validateDisputeData({
    orderId: ORDER_ID,
    paymentIntentId: PAYMENT_INTENT_ID,
    provider: 'RAZORPAY',
    providerDisputeId: 'disp_123',
    providerPaymentId: 'pay_123',
    providerOrderId: 'order_123',
    amountPaise: 42000,
    currency: 'INR',
    reason: 'FRAUD',
  });
  assert.equal(validated.order_id, ORDER_ID);
  assert.equal(validated.reason, 'FRAUD');
  assert.equal(validated.status, 'CREATED');
});

test('validateDisputeData rejects missing orderId', () => {
  assert.throws(() => validateDisputeData({ orderId: null, amountPaise: 1000 }), { code: 'ORDER_ID_REQUIRED' });
});

test('validateDisputeData rejects invalid provider', () => {
  assert.throws(() => validateDisputeData({ orderId: ORDER_ID, provider: 'STRIPE', amountPaise: 1000 }), { code: 'INVALID_PROVIDER' });
});

test('validateDisputeData rejects zero/negative amount', () => {
  // assertSafeMinorUnits validates >= 0, so 0 passes but -100 fails with INVALID_MONEY
  // The positive check is separate with INVALID_DISPUTE_AMOUNT
  assert.throws(() => validateDisputeData({ orderId: ORDER_ID, provider: 'RAZORPAY', amountPaise: 0 }), { code: 'INVALID_DISPUTE_AMOUNT' });
  assert.throws(() => validateDisputeData({ orderId: ORDER_ID, provider: 'RAZORPAY', amountPaise: -100 }), { code: 'INVALID_MONEY' });
});

test('validateDisputeData rejects unsupported currency', () => {
  assert.throws(() => validateDisputeData({ orderId: ORDER_ID, provider: 'RAZORPAY', amountPaise: 1000, currency: 'USD' }), { code: 'UNSUPPORTED_CURRENCY' });
});

test('validateDisputeData normalizes unknown reason to OTHER', () => {
  const validated = validateDisputeData({ orderId: ORDER_ID, provider: 'RAZORPAY', amountPaise: 1000, reason: 'UNKNOWN_REASON' });
  assert.equal(validated.reason, 'OTHER');
});

test('checkSettlementBlock returns blocked for active disputes', () => {
  const disputes = [
    { id: DISPUTE_ID, order_id: ORDER_ID, status: 'CREATED' },
    { id: randomUUID(), order_id: ORDER_ID, status: 'UNDER_REVIEW' },
  ];
  const result = checkSettlementBlock(disputes);
  assert.equal(result.blocked, true);
  assert.equal(result.disputeIds.length, 2);
});

test('checkSettlementBlock returns not blocked for terminal disputes', () => {
  const disputes = [
    { id: DISPUTE_ID, order_id: ORDER_ID, status: 'WON' },
    { id: randomUUID(), order_id: ORDER_ID, status: 'LOST' },
    { id: randomUUID(), order_id: ORDER_ID, status: 'CLOSED' },
  ];
  const result = checkSettlementBlock(disputes);
  assert.equal(result.blocked, false);
});

test('checkRefundConflict blocks refund for active disputes by default', () => {
  const disputes = [{ id: DISPUTE_ID, order_id: ORDER_ID, status: 'ACTION_REQUIRED' }];
  const result = checkRefundConflict(disputes, false);
  assert.equal(result.blocked, true);
});

test('checkRefundConflict allows refund with policy override', () => {
  const disputes = [{ id: DISPUTE_ID, order_id: ORDER_ID, status: 'CREATED' }];
  const result = checkRefundConflict(disputes, true);
  assert.equal(result.blocked, false);
});

test('reconcileDisputeAmount validates dispute <= captured', () => {
  assert.deepEqual(reconcileDisputeAmount(42000, 42000), { valid: true });
  assert.deepEqual(reconcileDisputeAmount(30000, 42000), { valid: true });
  assert.deepEqual(reconcileDisputeAmount(50000, 42000).valid, false);
});

test('buildDisputeEvent creates valid event record', () => {
  const event = buildDisputeEvent({
    disputeId: DISPUTE_ID,
    fromStatus: 'CREATED',
    toStatus: 'UNDER_REVIEW',
    eventType: 'DISPUTE_STATUS_CHANGED',
    actorId: 'admin-1',
    note: 'Under review by compliance',
    metadata: { reviewer: 'admin-1' },
  });
  assert.equal(event.dispute_id, DISPUTE_ID);
  assert.equal(event.from_status, 'CREATED');
  assert.equal(event.to_status, 'UNDER_REVIEW');
});

test('buildDisputeEvent rejects invalid toStatus', () => {
  assert.throws(() => buildDisputeEvent({ disputeId: DISPUTE_ID, toStatus: 'INVALID' }), { code: 'INVALID_TO_STATUS' });
});

test('buildDisputeTimeline merges events and evidence chronologically', () => {
  const events = [
    { id: 'e1', dispute_id: DISPUTE_ID, from_status: 'CREATED', to_status: 'UNDER_REVIEW', event_type: 'DISPUTE_STATUS_CHANGED', actor_id: 'admin-1', note: 'Under review', created_at: '2026-11-06T10:00:00Z' },
    { id: 'e2', dispute_id: DISPUTE_ID, from_status: 'UNDER_REVIEW', to_status: 'WON', event_type: 'DISPUTE_STATUS_CHANGED', actor_id: 'admin-1', note: 'Won', created_at: '2026-11-06T12:00:00Z' },
  ];
  const evidenceRecords = [
    { id: 'ev1', dispute_id: DISPUTE_ID, original_filename: 'receipt.pdf', mime_type: 'application/pdf', size_bytes: 1024, uploaded_by: 'buyer-1', description: 'Proof of delivery', created_at: '2026-11-06T11:00:00Z' },
  ];
  const timeline = buildDisputeTimeline(events, evidenceRecords);
  assert.equal(timeline.length, 3);
  assert.equal(timeline[0].type, 'DISPUTE_STATE_CHANGE');
  assert.equal(timeline[1].type, 'EVIDENCE_UPLOADED');
  assert.equal(timeline[2].type, 'DISPUTE_STATE_CHANGE');
  assert.equal(timeline[0].at, '2026-11-06T10:00:00Z');
});

test('buildDisputeFinancialImpact computes correct flags', () => {
  const dispute = { id: DISPUTE_ID, order_id: ORDER_ID, amount_paise: 42000, status: 'UNDER_REVIEW', evidence_deadline: '2026-11-06T12:00:00Z', created_at: '2026-11-06T10:00:00Z', resolved_at: null };
  const order = { id: ORDER_ID, upfront_paise: 42000, version: 1 };
  const ledgerTxns = [
    { event_type: 'PAYMENT_CAPTURED', idempotency_key: 'order:lock:' + ORDER_ID },
  ];
  const impact = buildDisputeFinancialImpact(dispute, order, ledgerTxns);
  assert.equal(impact.disputeId, DISPUTE_ID);
  assert.equal(impact.isSettlementBlocked, true);
  assert.equal(impact.hasCollectionLedger, true);
  assert.equal(impact.hasSettlementLedger, false);
  assert.equal(impact.hasDisputeLossLedger, false);
});

test('parseRazorpayDisputeEvent maps dispute.created event', () => {
  const payload = {
    event: 'dispute.created',
    payload: { dispute: { entity: { id: 'disp_123', amount: 42000, currency: 'INR', reason_code: 'fraud', respond_by: Math.floor(Date.now()/1000) + 86400 } } }
  };
  const parsed = parseRazorpayDisputeEvent(payload, 'dispute.created');
  assert.equal(parsed.providerDisputeId, 'disp_123');
  assert.equal(parsed.amountPaise, 42000);
  assert.equal(parsed.reason, 'FRAUD');
  assert.equal(parsed.targetStatus, 'CREATED');
  assert.ok(parsed.evidenceDeadline);
});

test('parseRazorpayDisputeEvent handles payment.dispute.created', () => {
  const payload = {
    event: 'payment.dispute.created',
    payload: { payment: { entity: { id: 'pay_123', order_id: 'order_123', dispute: { id: 'disp_123', amount: 42000, currency: 'INR', reason_code: 'product_not_received' } } } }
  };
  const parsed = parseRazorpayDisputeEvent(payload, 'payment.dispute.created');
  assert.equal(parsed.providerDisputeId, 'disp_123');
  assert.equal(parsed.providerPaymentId, 'pay_123');
  assert.equal(parsed.providerOrderId, 'order_123');
  assert.equal(parsed.reason, 'PRODUCT_NOT_RECEIVED');
});

test('parseRazorpayDisputeEvent returns null for non-dispute events', () => {
  assert.equal(parseRazorpayDisputeEvent({ event: 'payment.captured', payload: {} }, 'payment.captured'), null);
});