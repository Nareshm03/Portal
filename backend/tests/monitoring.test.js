/**
 * Unit tests for the admin transaction monitoring service.
 * Pure logic — no live database or HTTP server required.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampPageLimit,
  redactSensitive,
  buildTimeline,
  buildTransactionSummary,
  buildExceptionFlags,
  buildListRow,
  SENSITIVE_FIELDS,
  MAX_PAGE_LIMIT,
  DEFAULT_PAGE_LIMIT,
} from '../src/services/monitoring.js';
import {
  checkCapturedPayments,
  checkCollectionLedger,
  checkSettlementLedger,
  checkDisputedOrderSettlement,
  IssueCategory,
} from '../src/services/reconciliation.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const UPFRONT = 42_000;
const future = new Date(Date.now() + 60_000).toISOString();

function mkOrder(id, state = 'LOCKED', upfront = UPFRONT) {
  return {
    id, state,
    buyer_id: `b-${id}`, traveller_id: `t-${id}`,
    subtotal_paise: 120_000, duty_paise: 12_000, traveller_reward_paise: 8_000,
    platform_fee_paise: 5_000, total_paise: 125_000, deposit_paise: 25_000,
    upfront_paise: upfront, balance_paise: 83_000, currency: 'INR',
    payment_deadline: future, forfeit_at: null,
    created_at: '2026-11-05T10:00:00.000Z', updated_at: '2026-11-05T10:05:00.000Z',
  };
}

function mkIntent(id, orderId, status = 'CAPTURED', amount = UPFRONT) {
  return { id, order_id: orderId, provider: 'MOCK', status, amount_paise: amount, currency: 'INR', provider_order_id: `prov_${id}`, created_at: '2026-11-05T10:01:00.000Z', updated_at: '2026-11-05T10:02:00.000Z' };
}

function mkLedgerTxn(id, orderId, eventType, key) {
  return { id, order_id: orderId, event_type: eventType, idempotency_key: key, created_at: '2026-11-05T10:03:00.000Z' };
}

function mkOrderEvent(fromState, toState, at = '2026-11-05T10:00:00.000Z') {
  return { from_state: fromState, to_state: toState, actor_id: 'actor-1', note: null, created_at: at };
}

function mkWebhookEvent(id, at = '2026-11-05T10:04:00.000Z') {
  return { id, provider: 'RAZORPAY', event_type: 'payment.captured', created_at: at, processed_at: at };
}

const reconciliationChecks = { checkCapturedPayments, checkCollectionLedger, checkSettlementLedger, checkDisputedOrderSettlement };

/* ================================================================== */
/* clampPageLimit                                                      */
/* ================================================================== */

test('clampPageLimit returns default for 0/NaN/string', () => {
  assert.equal(clampPageLimit(0), DEFAULT_PAGE_LIMIT);
  assert.equal(clampPageLimit('abc'), DEFAULT_PAGE_LIMIT);
  assert.equal(clampPageLimit(-5), DEFAULT_PAGE_LIMIT);
});

test('clampPageLimit clamps to MAX_PAGE_LIMIT', () => {
  assert.equal(clampPageLimit(MAX_PAGE_LIMIT + 1), MAX_PAGE_LIMIT);
  assert.equal(clampPageLimit(MAX_PAGE_LIMIT), MAX_PAGE_LIMIT);
  assert.equal(clampPageLimit(1), 1);
});

/* ================================================================== */
/* redactSensitive                                                     */
/* ================================================================== */

test('redactSensitive removes otp_hash, raw_provider_reference and token', () => {
  const obj = { id: 'x', otp_hash: 'secret', raw_provider_reference: { key: 'pkey' }, status: 'ok', token: 'abc' };
  const out = redactSensitive(obj);
  assert.equal(out.id, 'x');
  assert.equal(out.status, 'ok');
  assert.equal(out.otp_hash, '[REDACTED]');
  assert.equal(out.raw_provider_reference, '[REDACTED]');
  assert.equal(out.token, '[REDACTED]');
});

test('redactSensitive recurses into nested objects', () => {
  const obj = { outer: { inner: { password: 'secret', safe: 1 } } };
  const out = redactSensitive(obj);
  assert.equal(out.outer.inner.password, '[REDACTED]');
  assert.equal(out.outer.inner.safe, 1);
});

test('redactSensitive leaves arrays unchanged', () => {
  const arr = [1, 2, 3];
  assert.deepEqual(redactSensitive(arr), arr);
});

test('redactSensitive returns null/undefined as-is', () => {
  assert.equal(redactSensitive(null), null);
  assert.equal(redactSensitive(undefined), undefined);
});

/* ================================================================== */
/* buildTimeline                                                       */
/* ================================================================== */

test('buildTimeline returns empty array for all-empty inputs', () => {
  const t = buildTimeline({});
  assert.deepEqual(t, []);
});

test('buildTimeline sorts events chronologically', () => {
  const timeline = buildTimeline({
    orderEvents: [mkOrderEvent(null, 'ACCEPTED', '2026-11-05T10:00:00.000Z')],
    paymentIntents: [mkIntent('i1', 'o1', 'CAPTURED', UPFRONT)],
    ledgerTransactions: [mkLedgerTxn('t1', 'o1', 'PAYMENT_CAPTURED', 'order:lock:o1')],
    webhookEvents: [mkWebhookEvent('w1', '2026-11-05T10:04:00.000Z')],
  });
  assert.equal(timeline.length, 4);
  for (let i = 1; i < timeline.length; i++) {
    assert.ok(timeline[i - 1].at <= timeline[i].at, `Events out of order at index ${i}`);
  }
});

test('buildTimeline assigns correct type labels', () => {
  const timeline = buildTimeline({
    orderEvents: [mkOrderEvent('ACCEPTED', 'LOCKED')],
    paymentIntents: [mkIntent('i1', 'o1')],
    ledgerTransactions: [mkLedgerTxn('t1', 'o1', 'PAYMENT_CAPTURED', 'k1')],
    webhookEvents: [mkWebhookEvent('w1')],
  });
  const types = timeline.map((e) => e.type);
  assert.ok(types.includes('ORDER_STATE_CHANGE'));
  assert.ok(types.includes('PAYMENT_INTENT'));
  assert.ok(types.includes('LEDGER_EVENT'));
  assert.ok(types.includes('WEBHOOK_RECEIVED'));
});

test('buildTimeline never exposes raw_provider_reference or payload', () => {
  const intents = [{ ...mkIntent('i1', 'o1'), raw_provider_reference: { key: 'secret' } }];
  const webhooks = [{ ...mkWebhookEvent('w1'), payload: '{"sensitive": true}' }];
  const timeline = buildTimeline({ paymentIntents: intents, webhookEvents: webhooks });
  for (const ev of timeline) {
    assert.ok(!('raw_provider_reference' in ev), 'raw_provider_reference must not appear in timeline');
    assert.ok(!('payload' in ev), 'payload must not appear in timeline');
  }
});

test('buildTimeline works with missing sources (partial records)', () => {
  const timeline = buildTimeline({ orderEvents: [mkOrderEvent(null, 'ACCEPTED')] });
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].type, 'ORDER_STATE_CHANGE');
});

test('buildTimeline empty history returns empty array', () => {
  assert.deepEqual(buildTimeline({ orderEvents: [], paymentIntents: [], ledgerTransactions: [], webhookEvents: [] }), []);
});

/* ================================================================== */
/* buildTransactionSummary                                            */
/* ================================================================== */

test('buildTransactionSummary: locked order with captured intent shows CAPTURED', () => {
  const o = mkOrder('o1', 'LOCKED');
  const intents = [mkIntent('i1', 'o1', 'CAPTURED')];
  const ledger = [mkLedgerTxn('t1', 'o1', 'PAYMENT_CAPTURED', 'order:lock:o1')];
  const s = buildTransactionSummary(o, intents, ledger);
  assert.equal(s.paymentStatus, 'CAPTURED');
  assert.equal(s.collectionLedgerPresent, true);
  assert.equal(s.settlementLedgerPresent, false);
  assert.equal(s.isDisputed, false);
  assert.equal(s.financials.upfrontPaise, UPFRONT);
});

test('buildTransactionSummary: completed order with both ledgers', () => {
  const o = mkOrder('o1', 'COMPLETED');
  const intents = [mkIntent('i1', 'o1', 'CAPTURED')];
  const ledger = [
    mkLedgerTxn('t1', 'o1', 'PAYMENT_CAPTURED', 'order:lock:o1'),
    mkLedgerTxn('t2', 'o1', 'ORDER_SETTLED', 'order:complete:o1'),
  ];
  const s = buildTransactionSummary(o, intents, ledger);
  assert.equal(s.collectionLedgerPresent, true);
  assert.equal(s.settlementLedgerPresent, true);
});

test('buildTransactionSummary: disputed order sets isDisputed true', () => {
  const o = mkOrder('o1', 'DISPUTED');
  const s = buildTransactionSummary(o, [], []);
  assert.equal(s.isDisputed, true);
});

test('buildTransactionSummary: no intents returns NONE payment status', () => {
  const o = mkOrder('o1', 'ACCEPTED');
  const s = buildTransactionSummary(o, [], []);
  assert.equal(s.paymentStatus, 'NONE');
});

test('buildTransactionSummary: financials are frozen from order columns', () => {
  const o = mkOrder('o1', 'LOCKED', 42_000);
  const s = buildTransactionSummary(o, [], []);
  assert.equal(s.financials.upfrontPaise, 42_000);
  assert.equal(s.financials.balancePaise, 83_000);
  assert.equal(s.financials.totalPaise, 125_000);
  assert.equal(s.financials.currency, 'INR');
});

/* ================================================================== */
/* buildExceptionFlags                                                 */
/* ================================================================== */

test('buildExceptionFlags: clean locked order has no exceptions', () => {
  const o = mkOrder('o1', 'LOCKED');
  const intents = [mkIntent('i1', 'o1', 'CAPTURED', UPFRONT)];
  const ledger = [mkLedgerTxn('t1', 'o1', 'PAYMENT_CAPTURED', 'order:lock:o1')];
  const flags = buildExceptionFlags({ order: o, capturedIntents: intents, ledgerTransactions: ledger, ...reconciliationChecks });
  assert.equal(flags.length, 0);
});

test('buildExceptionFlags: captured but not locked order is flagged', () => {
  const o = mkOrder('o1', 'ACCEPTED');
  const intents = [mkIntent('i1', 'o1', 'CAPTURED', UPFRONT)];
  const flags = buildExceptionFlags({ order: o, capturedIntents: intents, ledgerTransactions: [], ...reconciliationChecks });
  assert.ok(flags.some((f) => f.category === IssueCategory.CAPTURED_ORDER_NOT_LOCKED));
});

test('buildExceptionFlags: locked order missing collection ledger is flagged', () => {
  const o = mkOrder('o1', 'LOCKED');
  const flags = buildExceptionFlags({ order: o, capturedIntents: [], ledgerTransactions: [], ...reconciliationChecks });
  assert.ok(flags.some((f) => f.category === IssueCategory.LOCKED_MISSING_COLLECTION_LEDGER));
});

test('buildExceptionFlags: completed order missing settlement is flagged', () => {
  const o = mkOrder('o1', 'COMPLETED');
  const ledger = [mkLedgerTxn('t1', 'o1', 'PAYMENT_CAPTURED', 'order:lock:o1')];
  const flags = buildExceptionFlags({ order: o, capturedIntents: [], ledgerTransactions: ledger, ...reconciliationChecks });
  assert.ok(flags.some((f) => f.category === IssueCategory.COMPLETED_MISSING_SETTLEMENT_LEDGER));
});

test('buildExceptionFlags: disputed order with settlement ledger is flagged', () => {
  const o = mkOrder('o1', 'DISPUTED');
  const ledger = [mkLedgerTxn('t1', 'o1', 'ORDER_SETTLED', 'order:complete:o1')];
  const flags = buildExceptionFlags({ order: o, capturedIntents: [], ledgerTransactions: ledger, ...reconciliationChecks });
  assert.ok(flags.some((f) => f.category === IssueCategory.DISPUTED_ORDER_WITH_SETTLEMENT));
});

/* ================================================================== */
/* buildListRow                                                        */
/* ================================================================== */

test('buildListRow includes key fields but not sensitive columns', () => {
  const o = mkOrder('o1', 'LOCKED');
  const row = buildListRow(o, [mkIntent('i1', 'o1', 'CAPTURED')], []);
  assert.equal(row.orderId, 'o1');
  assert.equal(row.state, 'LOCKED');
  assert.equal(row.paymentStatus, 'CAPTURED');
  assert.ok(!('otp_hash' in row));
  assert.ok(!('raw_provider_reference' in row));
  // personal data not exposed in list row
  assert.ok(!('full_name' in row));
  assert.ok(!('email' in row));
});

/* ================================================================== */
/* PARTIALLY_REFUNDED status mapping (Fix: explicit branch)           */
/* ================================================================== */

test('buildTransactionSummary: PARTIALLY_REFUNDED intent returns PARTIALLY_REFUNDED', () => {
  const o = mkOrder('o1', 'LOCKED');
  const intents = [{ ...mkIntent('i1', 'o1', 'PARTIALLY_REFUNDED', UPFRONT) }];
  const s = buildTransactionSummary(o, intents, []);
  assert.equal(s.paymentStatus, 'PARTIALLY_REFUNDED',
    'PARTIALLY_REFUNDED must not fall through to UNKNOWN');
  assert.notEqual(s.paymentStatus, 'UNKNOWN');
});

test('buildTransactionSummary: PARTIALLY_REFUNDED takes precedence over REFUNDED when mixed', () => {
  const o = mkOrder('o1', 'LOCKED');
  // Mixed intents: one partially refunded and one fully refunded.
  // PARTIALLY_REFUNDED branch is checked first; should win.
  const intents = [
    { ...mkIntent('i1', 'o1', 'PARTIALLY_REFUNDED', UPFRONT) },
    { ...mkIntent('i2', 'o1', 'REFUNDED', UPFRONT) },
  ];
  const s = buildTransactionSummary(o, intents, intents);
  assert.equal(s.paymentStatus, 'PARTIALLY_REFUNDED');
});

test('buildTransactionSummary: REFUNDED still maps when no PARTIALLY_REFUNDED', () => {
  const o = mkOrder('o1', 'LOCKED');
  const intents = [mkIntent('i1', 'o1', 'REFUNDED', UPFRONT)];
  const s = buildTransactionSummary(o, intents, []);
  assert.equal(s.paymentStatus, 'REFUNDED');
});

test('buildTransactionSummary: dead code removed — no LOCKED_OR_AFTER in scope', () => {
  // Verify the function still returns the correct financial shape after dead-code removal.
  const o = mkOrder('o1', 'ACCEPTED');
  const s = buildTransactionSummary(o, [], []);
  assert.equal(s.paymentStatus, 'NONE');
  assert.ok(typeof s.financials === 'object');
  assert.equal(s.financials.currency, 'INR');
});
