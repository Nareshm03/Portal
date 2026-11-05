/**
 * Payment Reconciliation and Ledger Integrity job.
 *
 * Run from a scheduler or manually with:
 *   node src/jobs/reconcilePayments.js
 *
 * STRICT READ-ONLY. This job NEVER writes to the database.
 * It NEVER modifies payment intents, ledger transactions, order states,
 * webhook records or any other table.
 *
 * The `db` and `now` parameters are injectable for unit testing without
 * a live Supabase database (same pattern as expireOrders.js).
 */

import { getSupabase } from '../config/supabase.js';
import { logger } from '../config/logger.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  IssueCategory,
  makeIssue,
  checkCapturedPayments,
  checkCollectionLedger,
  checkSettlementLedger,
  checkLedgerBalance,
  checkUnprocessedWebhooks,
  checkDuplicatePaymentIntents,
  checkDisputedOrderSettlement,
  buildSummary,
} from '../services/reconciliation.js';

// Page size for all bulk reads. Keeps memory bounded on large datasets.
const PAGE_LIMIT = 500;

// States that imply the order is LOCKED or later.
const LOCKED_OR_AFTER = new Set(['LOCKED', 'PURCHASED', 'LANDED', 'COMPLETED']);

/**
 * Run the full reconciliation pass.
 *
 * @param {object} [options]
 * @param {object} [options.db]  – injectable Supabase client (defaults to service-role client)
 * @param {Date}   [options.now] – injectable clock (defaults to Date.now())
 * @returns {Promise<object>} reconciliation summary (never throws; errors are captured in the report)
 */
export async function reconcilePayments({ db = getSupabase(), now = new Date() } = {}) {
  const ranAt = now.toISOString();
  const issues = [];
  const queryFailures = [];

  // Counters so the summary can report totals regardless of how many checks ran.
  const inspected = { orders: 0, paymentIntents: 0, ledgerTransactions: 0, webhookEvents: 0 };

  /* ------------------------------------------------------------------
   * 1. Fetch all non-terminal orders we need to inspect.
   *    Terminal states (EXPIRED, FORFEITED) are not checked because they
   *    are intentionally closed — we focus on active and completed orders.
   * ------------------------------------------------------------------ */
  let allOrders = [];
  try {
    const { data, error } = await db.from('orders')
      .select('id, state, buyer_id, traveller_id, upfront_paise, deposit_paise, duty_paise, platform_fee_paise, traveller_reward_paise, subtotal_paise, balance_paise')
      .in('state', ['ACCEPTED', 'LOCKED', 'PURCHASED', 'LANDED', 'COMPLETED', 'DISPUTED'])
      .limit(PAGE_LIMIT);
    if (error) throw error;
    allOrders = data ?? [];
    inspected.orders = allOrders.length;
  } catch (err) {
    queryFailures.push({ query: 'orders', error: err.message ?? String(err) });
    logger.error({ err }, 'reconcile_orders_query_failed');
  }

  const ordersById = new Map(allOrders.map((o) => [o.id, o]));
  const orderIds = allOrders.map((o) => o.id);
  const lockedOrAfterOrders = allOrders.filter((o) => LOCKED_OR_AFTER.has(o.state));
  const completedOrders = allOrders.filter((o) => o.state === 'COMPLETED');
  const disputedOrders = allOrders.filter((o) => o.state === 'DISPUTED');

  /* ------------------------------------------------------------------
   * 2. Fetch all CAPTURED payment intents.
   *    Checks: captured-but-not-locked, amount mismatch, currency mismatch,
   *    duplicate captured intents per order.
   * ------------------------------------------------------------------ */
  let capturedIntents = [];
  let allIntents = [];
  if (orderIds.length > 0) {
    try {
      const { data, error } = await db.from('payment_intents')
        .select('id, order_id, buyer_id, provider, status, amount_paise, currency, provider_order_id, idempotency_key')
        .in('order_id', orderIds)
        .limit(PAGE_LIMIT);
      if (error) throw error;
      allIntents = data ?? [];
      capturedIntents = allIntents.filter((i) => i.status === 'CAPTURED');
      inspected.paymentIntents = allIntents.length;
    } catch (err) {
      queryFailures.push({ query: 'payment_intents', error: err.message ?? String(err) });
      logger.error({ err }, 'reconcile_payment_intents_query_failed');
    }
  }

  // Checks 1 & 2 — captured intents vs order state and amounts
  if (capturedIntents.length > 0) {
    issues.push(...checkCapturedPayments(capturedIntents, ordersById));
  }

  // Check 8 — duplicate intents per order
  const intentsByOrderId = new Map();
  for (const intent of allIntents) {
    if (!intentsByOrderId.has(intent.order_id)) intentsByOrderId.set(intent.order_id, []);
    intentsByOrderId.get(intent.order_id).push(intent);
  }
  issues.push(...checkDuplicatePaymentIntents(intentsByOrderId));

  /* ------------------------------------------------------------------
   * 3. Fetch ledger transactions for all relevant orders.
   *    Checks: missing collection ledger, missing settlement ledger,
   *    unbalanced entries, invalid entries, disputed settlement.
   * ------------------------------------------------------------------ */
  let ledgerTransactions = [];
  const ledgerByOrderId = new Map();
  if (orderIds.length > 0) {
    try {
      // Fetch transactions first, then their entries separately.
      // This avoids a nested-select syntax that varies between the live Supabase client
      // and the mock used in tests.
      const { data: txnData, error: txnError } = await db.from('ledger_transactions')
        .select('id, order_id, event_type, idempotency_key, created_at')
        .in('order_id', orderIds)
        .limit(PAGE_LIMIT);
      if (txnError) throw txnError;

      const txns = txnData ?? [];
      const txnIds = txns.map((t) => t.id);

      let entriesByTxnId = new Map();
      if (txnIds.length > 0) {
        const { data: entryData, error: entryError } = await db.from('ledger_entries')
          .select('id, transaction_id, account_code, direction, amount_paise')
          .in('transaction_id', txnIds)
          .limit(PAGE_LIMIT);
        if (entryError) throw entryError;
        for (const entry of entryData ?? []) {
          if (!entriesByTxnId.has(entry.transaction_id)) entriesByTxnId.set(entry.transaction_id, []);
          entriesByTxnId.get(entry.transaction_id).push(entry);
        }
      }

      // Attach entries to their transaction row.
      ledgerTransactions = txns.map((t) => ({ ...t, entries: entriesByTxnId.get(t.id) ?? [] }));
      inspected.ledgerTransactions = ledgerTransactions.length;
      for (const txn of ledgerTransactions) {
        if (!ledgerByOrderId.has(txn.order_id)) ledgerByOrderId.set(txn.order_id, []);
        ledgerByOrderId.get(txn.order_id).push(txn);
      }
    } catch (err) {
      queryFailures.push({ query: 'ledger_transactions', error: err.message ?? String(err) });
      logger.error({ err }, 'reconcile_ledger_query_failed');
    }
  }

  // Check 3 — locked orders missing collection ledger
  if (lockedOrAfterOrders.length > 0) {
    issues.push(...checkCollectionLedger(lockedOrAfterOrders, ledgerByOrderId));
  }

  // Check 4 — completed orders missing settlement ledger
  if (completedOrders.length > 0) {
    issues.push(...checkSettlementLedger(completedOrders, ledgerByOrderId));
  }

  // Checks 5 & 6 — balanced journal and valid entries
  if (ledgerTransactions.length > 0) {
    issues.push(...checkLedgerBalance(ledgerTransactions));
  }

  // Check 9 — disputed orders must not have settlement entries
  if (disputedOrders.length > 0) {
    issues.push(...checkDisputedOrderSettlement(disputedOrders, ledgerByOrderId));
  }

  /* ------------------------------------------------------------------
   * 4. Check 7: Unprocessed webhook events.
   * ------------------------------------------------------------------ */
  let unprocessedWebhooks = [];
  try {
    const { data, error } = await db.from('webhook_events')
      .select('id, provider, event_type, created_at')
      .is('processed_at', null)
      .limit(PAGE_LIMIT);
    if (error) throw error;
    unprocessedWebhooks = data ?? [];
    inspected.webhookEvents = unprocessedWebhooks.length;
  } catch (err) {
    queryFailures.push({ query: 'webhook_events', error: err.message ?? String(err) });
    logger.error({ err }, 'reconcile_webhooks_query_failed');
  }

  if (unprocessedWebhooks.length > 0) {
    issues.push(...checkUnprocessedWebhooks(unprocessedWebhooks));
  }

  /* ------------------------------------------------------------------
   * 5. Capture any query failures as issues so the summary is complete.
   * ------------------------------------------------------------------ */
  for (const failure of queryFailures) {
    issues.push(makeIssue(
      IssueCategory.QUERY_FAILURE,
      { query: failure.query },
      `Query '${failure.query}' failed: ${failure.error}. Reconciliation for this data set is incomplete.`
    ));
  }

  return buildSummary({ inspected, issues, queryFailures, ranAt });
}

/* ------------------------------------------------------------------
 * CLI entry point
 * ------------------------------------------------------------------ */
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  reconcilePayments().then((summary) => {
    // Log a structured machine-readable summary.
    logger.info({
      ranAt: summary.ranAt,
      inspected: summary.inspected,
      totalIssues: summary.totalIssues,
      queryFailures: summary.queryFailures.length,
      issueCategories: Object.keys(summary.issuesByCategory),
    }, 'reconciliation_complete');

    // Print the full human-readable report to stdout for operators.
    // Sensitive fields (amounts, IDs) are fine — no credentials or PII is logged.
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');

    if (summary.queryFailures.length > 0) {
      logger.warn({ failures: summary.queryFailures }, 'reconciliation_incomplete_due_to_query_failures');
      process.exit(2); // partial — caller can distinguish from clean and failure
    }
    process.exit(summary.totalIssues > 0 ? 1 : 0); // 1 = issues found; 0 = clean
  }).catch((err) => {
    logger.error({ err }, 'reconciliation_job_fatal');
    process.exit(1);
  });
}
