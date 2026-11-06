/**
 * Unit tests for the payment reconciliation service.
 *
 * All tests use an injected fake Supabase client — no live database.
 * Tests exercise both the pure check functions (src/services/reconciliation.js)
 * and the full job orchestration (src/jobs/reconcilePayments.js).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockSupabase } from './helpers/mockSupabase.js';
import { reconcilePayments } from '../src/jobs/reconcilePayments.js';
import {
  IssueCategory,
  checkCapturedPayments,
  checkCollectionLedger,
  checkSettlementLedger,
  checkLedgerBalance,
  checkUnprocessedWebhooks,
  checkDuplicatePaymentIntents,
  checkDisputedOrderSettlement,
  buildSummary,
} from '../src/services/reconciliation.js';

/* ------------------------------------------------------------------ */
/* Data-builder helpers                                               */
/* ------------------------------------------------------------------ */

const UPFRONT = 42_000;

function order(id, state = 'LOCKED', upfront = UPFRONT, extra = {}) {
  return {
    id, state,
    buyer_id: `buyer-${id}`, traveller_id: `traveller-${id}`,
    upfront_paise: upfront, deposit_paise: 25_000, duty_paise: 12_000,
    platform_fee_paise: 5_000, traveller_reward_paise: 8_000,
    subtotal_paise: 120_000, balance_paise: 83_000,
    payment_deadline: new Date(Date.now() - 60_000).toISOString(),
    ...extra,
  };
}

function intent(id, orderId, status = 'CAPTURED', amount = UPFRONT, currency = 'INR') {
  return { id, order_id: orderId, buyer_id: `buyer-${orderId}`, provider: 'MOCK', status, amount_paise: amount, currency, provider_order_id: `prov_${id}`, idempotency_key: `idem_${id}` };
}

function ledgerTxn(id, orderId, eventType, idempotencyKey, entries = []) {
  return { id, order_id: orderId, event_type: eventType, idempotency_key: idempotencyKey, created_at: new Date().toISOString(), entries };
}

function ledgerEntry(id, txnId, accountCode, direction, amount) {
  return { id, transaction_id: txnId, account_code: accountCode, direction, amount_paise: amount };
}

function collectionTxn(orderId) {
  return ledgerTxn(
    `txn-lock-${orderId}`, orderId, 'PAYMENT_CAPTURED', `order:lock:${orderId}`,
    [
      ledgerEntry(`e1-${orderId}`, `txn-lock-${orderId}`, 'PAYMENT_CLEARING', 'DEBIT', UPFRONT),
      ledgerEntry(`e2-${orderId}`, `txn-lock-${orderId}`, 'ESCROW_HOLD', 'CREDIT', UPFRONT),
    ]
  );
}

function settlementTxn(orderId) {
  // Amounts must balance to the test order() helper's fields:
  // upfront=42000 (ESCROW DEBIT) + balance=83000 (BUYER_RECEIVABLE DEBIT) = 125000 total debits
  // traveller_payable + duty(12000) + platform(5000) = 125000  =>  traveller_payable = 108000
  const travellerPayable = 108_000;
  return ledgerTxn(
    `txn-complete-${orderId}`, orderId, 'ORDER_SETTLED', `order:complete:${orderId}`,
    [
      ledgerEntry(`e3-${orderId}`, `txn-complete-${orderId}`, 'ESCROW_HOLD', 'DEBIT', UPFRONT),
      ledgerEntry(`e4-${orderId}`, `txn-complete-${orderId}`, 'BUYER_RECEIVABLE', 'DEBIT', 83_000),
      ledgerEntry(`e5-${orderId}`, `txn-complete-${orderId}`, 'TRAVELLER_PAYABLE', 'CREDIT', travellerPayable),
      ledgerEntry(`e6-${orderId}`, `txn-complete-${orderId}`, 'DUTY_PAYABLE', 'CREDIT', 12_000),
      ledgerEntry(`e7-${orderId}`, `txn-complete-${orderId}`, 'PLATFORM_REVENUE', 'CREDIT', 5_000),
    ]
  );
}

function webhookEvent(id, processedAt = null) {
  return { id, provider: 'RAZORPAY', event_type: 'payment.captured', created_at: new Date().toISOString(), processed_at: processedAt };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function ordersById(orders) {
  return new Map(orders.map((o) => [o.id, o]));
}

function ledgerByOrderId(txns) {
  const map = new Map();
  for (const t of txns) {
    if (!map.has(t.order_id)) map.set(t.order_id, []);
    map.get(t.order_id).push(t);
  }
  return map;
}

function intentsByOrderId(intents) {
  const map = new Map();
  for (const i of intents) {
    if (!map.has(i.order_id)) map.set(i.order_id, []);
    map.get(i.order_id).push(i);
  }
  return map;
}

/* ================================================================== */
/* Check 1 & 2: Captured payment vs order state and amount            */
/* ================================================================== */

test('check: captured intent on a correctly locked order has no issues', () => {
  const o = order('o1', 'LOCKED');
  const i = intent('i1', 'o1', 'CAPTURED', UPFRONT);
  const issues = checkCapturedPayments([i], ordersById([o]));
  assert.equal(issues.length, 0);
});

test('check: captured intent on ACCEPTED order is flagged', () => {
  const o = order('o1', 'ACCEPTED');
  const i = intent('i1', 'o1', 'CAPTURED', UPFRONT);
  const issues = checkCapturedPayments([i], ordersById([o]));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, IssueCategory.CAPTURED_ORDER_NOT_LOCKED);
  assert.equal(issues[0].affectedIds.orderId, 'o1');
});

test('check: captured intent with wrong amount is flagged', () => {
  const o = order('o1', 'LOCKED', UPFRONT);
  const i = intent('i1', 'o1', 'CAPTURED', UPFRONT + 1);
  const issues = checkCapturedPayments([i], ordersById([o]));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, IssueCategory.PAYMENT_AMOUNT_MISMATCH);
  assert.equal(issues[0].affectedIds.intentAmount, UPFRONT + 1);
  assert.equal(issues[0].affectedIds.orderUpfront, UPFRONT);
});

test('check: captured intent with correct amount but wrong currency is flagged', () => {
  const o = order('o1', 'LOCKED', UPFRONT);
  const i = intent('i1', 'o1', 'CAPTURED', UPFRONT, 'USD');
  const issues = checkCapturedPayments([i], ordersById([o]));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, IssueCategory.PAYMENT_CURRENCY_MISMATCH);
});

test('check: captured intent for missing order is flagged', () => {
  const i = intent('i1', 'missing-order', 'CAPTURED', UPFRONT);
  const issues = checkCapturedPayments([i], new Map());
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, IssueCategory.CAPTURED_ORDER_NOT_LOCKED);
});

test('check: captured intent on COMPLETED order is fine (locked or later)', () => {
  const o = order('o1', 'COMPLETED');
  const i = intent('i1', 'o1', 'CAPTURED', UPFRONT);
  const issues = checkCapturedPayments([i], ordersById([o]));
  assert.equal(issues.length, 0);
});

/* ================================================================== */
/* Check 3: Locked orders must have a collection ledger transaction   */
/* ================================================================== */

test('check: locked order with collection ledger is consistent', () => {
  const o = order('o1', 'LOCKED');
  const txn = collectionTxn('o1');
  const issues = checkCollectionLedger([o], ledgerByOrderId([txn]));
  assert.equal(issues.length, 0);
});

test('check: locked order missing collection ledger is flagged', () => {
  const o = order('o1', 'LOCKED');
  const issues = checkCollectionLedger([o], new Map());
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, IssueCategory.LOCKED_MISSING_COLLECTION_LEDGER);
  assert.equal(issues[0].affectedIds.orderId, 'o1');
});

test('check: purchased and landed orders also require a collection ledger', () => {
  const purchased = order('o2', 'PURCHASED');
  const landed = order('o3', 'LANDED');
  const issues = checkCollectionLedger([purchased, landed], new Map());
  assert.equal(issues.length, 2);
  assert.ok(issues.every((i) => i.category === IssueCategory.LOCKED_MISSING_COLLECTION_LEDGER));
});

test('check: wrong event type does not count as collection', () => {
  const o = order('o1', 'LOCKED');
  const wrongTxn = ledgerTxn('t1', 'o1', 'ORDER_SETTLED', `order:lock:o1`, []);
  const issues = checkCollectionLedger([o], ledgerByOrderId([wrongTxn]));
  assert.equal(issues.length, 1);
});

/* ================================================================== */
/* Check 4: Completed orders must have a settlement ledger transaction */
/* ================================================================== */

test('check: completed order with settlement ledger is consistent', () => {
  const o = order('o1', 'COMPLETED');
  const txn = settlementTxn('o1');
  const issues = checkSettlementLedger([o], ledgerByOrderId([txn]));
  assert.equal(issues.length, 0);
});

test('check: completed order missing settlement ledger is flagged', () => {
  const o = order('o1', 'COMPLETED');
  const issues = checkSettlementLedger([o], new Map());
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, IssueCategory.COMPLETED_MISSING_SETTLEMENT_LEDGER);
});

/* ================================================================== */
/* Check 5 & 6: Ledger balance and valid entries                     */
/* ================================================================== */

test('check: balanced journal with valid entries passes', () => {
  const txn = collectionTxn('o1');
  const issues = checkLedgerBalance([txn]);
  assert.equal(issues.length, 0);
});

test('check: unbalanced journal is flagged', () => {
  const txn = ledgerTxn('t1', 'o1', 'PAYMENT_CAPTURED', 'order:lock:o1', [
    ledgerEntry('e1', 't1', 'PAYMENT_CLEARING', 'DEBIT', UPFRONT),
    ledgerEntry('e2', 't1', 'ESCROW_HOLD', 'CREDIT', UPFRONT - 1),
  ]);
  const issues = checkLedgerBalance([txn]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, IssueCategory.UNBALANCED_LEDGER_TRANSACTION);
  assert.equal(issues[0].affectedIds.transactionId, 't1');
});

test('check: entry with zero amount is flagged', () => {
  const txn = ledgerTxn('t1', 'o1', 'PAYMENT_CAPTURED', 'order:lock:o1', [
    ledgerEntry('e1', 't1', 'PAYMENT_CLEARING', 'DEBIT', 0),
    ledgerEntry('e2', 't1', 'ESCROW_HOLD', 'CREDIT', 0),
  ]);
  const issues = checkLedgerBalance([txn]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, IssueCategory.LEDGER_TRANSACTION_INVALID_ENTRY);
});

test('check: entry with missing account code is flagged', () => {
  const txn = ledgerTxn('t1', 'o1', 'PAYMENT_CAPTURED', 'order:lock:o1', [
    ledgerEntry('e1', 't1', '', 'DEBIT', UPFRONT),
    ledgerEntry('e2', 't1', 'ESCROW_HOLD', 'CREDIT', UPFRONT),
  ]);
  const issues = checkLedgerBalance([txn]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, IssueCategory.LEDGER_TRANSACTION_INVALID_ENTRY);
});

test('check: transaction with fewer than 2 entries is flagged', () => {
  const txn = ledgerTxn('t1', 'o1', 'PAYMENT_CAPTURED', 'order:lock:o1', [
    ledgerEntry('e1', 't1', 'PAYMENT_CLEARING', 'DEBIT', UPFRONT),
  ]);
  const issues = checkLedgerBalance([txn]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, IssueCategory.LEDGER_TRANSACTION_INVALID_ENTRY);
});

test('check: complex settlement journal (5 entries) is balanced', () => {
  const txn = settlementTxn('o1');
  const issues = checkLedgerBalance([txn]);
  assert.equal(issues.length, 0);
});

/* ================================================================== */
/* Check 7: Unprocessed webhook events                                */
/* ================================================================== */

test('check: processed webhook event has no issues', () => {
  const issues = checkUnprocessedWebhooks([]);
  assert.equal(issues.length, 0);
});

test('check: unprocessed webhook event is flagged', () => {
  const evt = webhookEvent('w1', null);
  const issues = checkUnprocessedWebhooks([evt]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, IssueCategory.UNPROCESSED_WEBHOOK);
  assert.equal(issues[0].affectedIds.webhookEventId, 'w1');
});

test('check: multiple unprocessed webhooks each get an issue', () => {
  const issues = checkUnprocessedWebhooks([webhookEvent('w1'), webhookEvent('w2'), webhookEvent('w3')]);
  assert.equal(issues.length, 3);
});

/* ================================================================== */
/* Check 8: Duplicate payment intents                                 */
/* ================================================================== */

test('check: single captured intent is fine', () => {
  const issues = checkDuplicatePaymentIntents(
    intentsByOrderId([intent('i1', 'o1', 'CAPTURED')])
  );
  assert.equal(issues.length, 0);
});

test('check: two captured intents for same order is flagged', () => {
  const issues = checkDuplicatePaymentIntents(
    intentsByOrderId([intent('i1', 'o1', 'CAPTURED'), intent('i2', 'o1', 'CAPTURED')])
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, IssueCategory.DUPLICATE_PAYMENT_INTENT);
  assert.equal(issues[0].affectedIds.duplicateType, 'multiple_captured');
  assert.deepEqual(issues[0].affectedIds.intentIds.sort(), ['i1', 'i2'].sort());
});

test('check: two open intents for same order is flagged', () => {
  const issues = checkDuplicatePaymentIntents(
    intentsByOrderId([intent('i1', 'o1', 'CREATING'), intent('i2', 'o1', 'CREATED')])
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0].affectedIds.duplicateType, 'multiple_open');
});

/* ================================================================== */
/* Check 9: Disputed orders must not have settlement entries          */
/* ================================================================== */

test('check: disputed order without settlement entries is fine', () => {
  const o = order('o1', 'DISPUTED');
  const issues = checkDisputedOrderSettlement([o], new Map());
  assert.equal(issues.length, 0);
});

test('check: disputed order with settlement ledger is flagged', () => {
  const o = order('o1', 'DISPUTED');
  const txn = settlementTxn('o1');
  const issues = checkDisputedOrderSettlement([o], ledgerByOrderId([txn]));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, IssueCategory.DISPUTED_ORDER_WITH_SETTLEMENT);
  assert.equal(issues[0].affectedIds.orderId, 'o1');
});

/* ================================================================== */
/* Summary builder                                                    */
/* ================================================================== */

test('buildSummary: empty run produces zero issues and note', () => {
  const summary = buildSummary({ inspected: { orders: 0, paymentIntents: 0, ledgerTransactions: 0 }, issues: [], queryFailures: [], ranAt: 'now' });
  assert.equal(summary.totalIssues, 0);
  assert.ok(typeof summary.note === 'string');
  assert.equal(Object.keys(summary.issuesByCategory).length, 0);
});

test('buildSummary: consistent is never negative, totalIssues matches issue list length', () => {
  // More issues than total records — consistent must clamp to 0, not go negative.
  const manyIssues = Array.from({ length: 20 }, (_, i) => ({
    category: IssueCategory.LOCKED_MISSING_COLLECTION_LEDGER, affectedIds: { orderId: `o${i}` }, recommendation: ''
  }));
  const summary = buildSummary({
    inspected: { orders: 3, paymentIntents: 2, ledgerTransactions: 1 }, // total = 6
    issues: manyIssues,
    queryFailures: [],
    ranAt: 'now'
  });
  assert.equal(summary.totalIssues, 20);
  assert.equal(summary.consistent, 0, 'consistent must not be negative');
  assert.ok(summary.totalIssues === summary.issues.length, 'totalIssues must equal issues.length');
});

test('buildSummary: consistent reflects unaffected records when issues < total', () => {
  const issues = [{ category: IssueCategory.UNPROCESSED_WEBHOOK, affectedIds: {}, recommendation: '' }];
  const summary = buildSummary({
    inspected: { orders: 5, paymentIntents: 4, ledgerTransactions: 3 }, // total = 12
    issues,
    queryFailures: [],
    ranAt: 'now'
  });
  assert.equal(summary.totalIssues, 1);
  assert.equal(summary.consistent, 11);
  assert.ok(summary.consistent >= 0);
});

test('buildSummary: issues are grouped by category', () => {
  const issues = [
    { category: IssueCategory.CAPTURED_ORDER_NOT_LOCKED, affectedIds: {}, recommendation: '' },
    { category: IssueCategory.CAPTURED_ORDER_NOT_LOCKED, affectedIds: {}, recommendation: '' },
    { category: IssueCategory.UNPROCESSED_WEBHOOK, affectedIds: {}, recommendation: '' },
  ];
  const summary = buildSummary({ inspected: { orders: 2, paymentIntents: 2, ledgerTransactions: 0 }, issues, queryFailures: [], ranAt: 'now' });
  assert.equal(summary.totalIssues, 3);
  assert.equal(summary.issuesByCategory[IssueCategory.CAPTURED_ORDER_NOT_LOCKED].length, 2);
  assert.equal(summary.issuesByCategory[IssueCategory.UNPROCESSED_WEBHOOK].length, 1);
});

/* ================================================================== */
/* Full job: integration tests with injected mock DB                  */
/* ================================================================== */

/**
 * Build a mock DB for job-level tests. The job fetches ledger_transactions and
 * ledger_entries separately; this helper splits the embedded entries back out.
 */
function jobDb(orders = [], intents = [], ledgerTxns = [], webhookEvts = []) {
  // Detach entries from transactions for the separate ledger_entries query.
  const entries = ledgerTxns.flatMap((t) => (t.entries ?? []).map((e) => ({ ...e, transaction_id: t.id })));
  const txnsWithoutEntries = ledgerTxns.map(({ entries: _e, ...rest }) => rest);
  return createMockSupabase({
    orders: { data: orders, error: null },
    payment_intents: { data: intents, error: null },
    ledger_transactions: { data: txnsWithoutEntries, error: null },
    ledger_entries: { data: entries, error: null },
    webhook_events: { data: webhookEvts, error: null },
  });
}

test('job: empty database returns clean summary with zero issues', async () => {
  const db = jobDb();
  const summary = await reconcilePayments({ db });
  assert.equal(summary.totalIssues, 0);
  assert.equal(summary.queryFailures.length, 0);
  assert.equal(summary.inspected.orders, 0);
});

test('job: consistent locked order with correct payment and ledger is clean', async () => {
  const o = order('o1', 'LOCKED');
  const i = intent('i1', 'o1', 'CAPTURED', UPFRONT);
  const txn = collectionTxn('o1');
  const db = jobDb([o], [i], [txn]);
  const summary = await reconcilePayments({ db });
  assert.equal(summary.totalIssues, 0);
  assert.equal(summary.queryFailures.length, 0);
});

test('job: captured intent whose order is still ACCEPTED is flagged', async () => {
  const o = order('o1', 'ACCEPTED');
  const i = intent('i1', 'o1', 'CAPTURED', UPFRONT);
  const db = jobDb([o], [i], [], []);
  const summary = await reconcilePayments({ db });
  assert.ok(summary.totalIssues > 0);
  assert.ok(IssueCategory.CAPTURED_ORDER_NOT_LOCKED in summary.issuesByCategory);
});

test('job: captured intent with wrong amount is flagged', async () => {
  const o = order('o1', 'LOCKED', UPFRONT);
  const i = intent('i1', 'o1', 'CAPTURED', UPFRONT + 100);
  const txn = collectionTxn('o1');
  const db = jobDb([o], [i], [txn]);
  const summary = await reconcilePayments({ db });
  assert.ok(IssueCategory.PAYMENT_AMOUNT_MISMATCH in summary.issuesByCategory);
});

test('job: locked order without collection ledger is flagged', async () => {
  const o = order('o1', 'LOCKED');
  const i = intent('i1', 'o1', 'CAPTURED', UPFRONT);
  const db = jobDb([o], [i], []);
  const summary = await reconcilePayments({ db });
  assert.ok(IssueCategory.LOCKED_MISSING_COLLECTION_LEDGER in summary.issuesByCategory);
});

test('job: completed order without settlement ledger is flagged', async () => {
  const o = order('o1', 'COMPLETED');
  const txn = collectionTxn('o1'); // has collection but not settlement
  const db = jobDb([o], [intent('i1', 'o1', 'CAPTURED')], [txn]);
  const summary = await reconcilePayments({ db });
  assert.ok(IssueCategory.COMPLETED_MISSING_SETTLEMENT_LEDGER in summary.issuesByCategory);
});

test('job: unbalanced ledger transaction is flagged', async () => {
  const o = order('o1', 'LOCKED');
  const badTxn = ledgerTxn('t1', 'o1', 'PAYMENT_CAPTURED', 'order:lock:o1', [
    ledgerEntry('e1', 't1', 'PAYMENT_CLEARING', 'DEBIT', UPFRONT),
    ledgerEntry('e2', 't1', 'ESCROW_HOLD', 'CREDIT', UPFRONT - 1),
  ]);
  const db = jobDb([o], [intent('i1', 'o1', 'CAPTURED')], [badTxn]);
  const summary = await reconcilePayments({ db });
  assert.ok(IssueCategory.UNBALANCED_LEDGER_TRANSACTION in summary.issuesByCategory);
});

test('job: unprocessed webhook event is flagged', async () => {
  const db = jobDb([], [], [], [webhookEvent('w1', null)]);
  const summary = await reconcilePayments({ db });
  assert.ok(IssueCategory.UNPROCESSED_WEBHOOK in summary.issuesByCategory);
});

test('job: duplicate captured payment intents are flagged', async () => {
  const o = order('o1', 'LOCKED');
  const i1 = intent('i1', 'o1', 'CAPTURED');
  const i2 = intent('i2', 'o1', 'CAPTURED');
  const txn = collectionTxn('o1');
  const db = jobDb([o], [i1, i2], [txn]);
  const summary = await reconcilePayments({ db });
  assert.ok(IssueCategory.DUPLICATE_PAYMENT_INTENT in summary.issuesByCategory);
});

test('job: disputed order with settlement ledger is flagged', async () => {
  const o = order('o1', 'DISPUTED');
  const txn = settlementTxn('o1');
  const db = jobDb([o], [intent('i1', 'o1', 'CAPTURED')], [txn]);
  const summary = await reconcilePayments({ db });
  assert.ok(IssueCategory.DISPUTED_ORDER_WITH_SETTLEMENT in summary.issuesByCategory);
});

test('job: ledger_transactions query failure is captured, other checks still run', async () => {
  // ledger_transactions query fails, but orders/intents/webhooks should still be checked.
  const o = order('o1', 'LOCKED');
  const i = intent('i1', 'o1', 'CAPTURED', UPFRONT);
  // The mock returns data:[] with a non-null error to simulate a query failure.
  const db = createMockSupabase({
    orders: { data: [o], error: null },
    payment_intents: { data: [i], error: null },
    ledger_transactions: { data: [], error: { message: 'connection refused' } },
    ledger_entries: { data: [], error: null },
    webhook_events: { data: [], error: null },
  });
  const summary = await reconcilePayments({ db });
  assert.equal(summary.queryFailures.length, 1);
  assert.equal(summary.queryFailures[0].query, 'ledger_transactions');
  assert.ok(IssueCategory.QUERY_FAILURE in summary.issuesByCategory);
  // Other checks ran — locked order is missing collection ledger.
  assert.ok(IssueCategory.LOCKED_MISSING_COLLECTION_LEDGER in summary.issuesByCategory);
});

test('job: note confirms no database writes were performed', async () => {
  const db = jobDb();
  const summary = await reconcilePayments({ db });
  assert.ok(summary.note.toLowerCase().includes('no database writes'));
  // Confirm the mock DB received zero insert/update/delete calls.
  assert.equal(db.callLog.insert.length, 0, 'job must not insert');
  assert.equal(db.callLog.update.length, 0, 'job must not update');
  assert.equal(db.callLog.delete.length, 0, 'job must not delete');
  assert.equal(db.callLog.rpc.length, 0, 'job must not call any rpc');
});

test('job: function is exported and accepts no arguments', () => {
  assert.equal(typeof reconcilePayments, 'function');
});
