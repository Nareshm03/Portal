/**
 * Payment Reconciliation and Ledger Integrity service.
 *
 * STRICT READ-ONLY. This module NEVER writes to the database.
 * It NEVER modifies payment intents, ledger transactions, order states,
 * webhook records or any other table. It only reads and reports.
 *
 * Inject a Supabase client via the `db` parameter so the job can be
 * unit-tested without a live database connection (same pattern as expireOrders).
 */

/** Issue categories emitted by each check. Keep these stable — they appear in
 * reports and can be used by downstream alerting tooling. */
export const IssueCategory = Object.freeze({
  CAPTURED_ORDER_NOT_LOCKED:         'CAPTURED_ORDER_NOT_LOCKED',
  PAYMENT_AMOUNT_MISMATCH:           'PAYMENT_AMOUNT_MISMATCH',
  PAYMENT_CURRENCY_MISMATCH:         'PAYMENT_CURRENCY_MISMATCH',
  LOCKED_MISSING_COLLECTION_LEDGER:  'LOCKED_MISSING_COLLECTION_LEDGER',
  COMPLETED_MISSING_SETTLEMENT_LEDGER:'COMPLETED_MISSING_SETTLEMENT_LEDGER',
  UNBALANCED_LEDGER_TRANSACTION:     'UNBALANCED_LEDGER_TRANSACTION',
  LEDGER_TRANSACTION_INVALID_ENTRY:  'LEDGER_TRANSACTION_INVALID_ENTRY',
  UNPROCESSED_WEBHOOK:               'UNPROCESSED_WEBHOOK',
  DUPLICATE_PAYMENT_INTENT:          'DUPLICATE_PAYMENT_INTENT',
  DISPUTED_ORDER_WITH_SETTLEMENT:    'DISPUTED_ORDER_WITH_SETTLEMENT',
  DISPUTE_AMOUNT_MISMATCH:           'DISPUTE_AMOUNT_MISMATCH',
  QUERY_FAILURE:                     'QUERY_FAILURE',
});

/** One reconciliation issue. Internal IDs only — never personal data. */
export function makeIssue(category, affectedIds, recommendation) {
  return { category, affectedIds, recommendation };
}

/* ------------------------------------------------------------------ */
/* Individual checks (pure functions – tested directly)               */
/* ------------------------------------------------------------------ */

/**
 * Check 1 & 2: For every CAPTURED payment intent verify:
 *   a) Its order is LOCKED (or later — meaning the transition happened).
 *   b) The captured amount equals order.upfront_paise and currency is INR.
 *
 * @param {object[]} intents  – payment_intents rows with status='CAPTURED'
 * @param {Map<string,object>} ordersById – orders keyed by id
 * @returns {object[]} issues
 */
export function checkCapturedPayments(intents, ordersById) {
  const issues = [];
  const SETTLED_OR_AFTER_LOCK = new Set(['LOCKED', 'PURCHASED', 'LANDED', 'COMPLETED', 'DISPUTED', 'FORFEITED']);
  for (const intent of intents) {
    const order = ordersById.get(intent.order_id);
    if (!order) {
      issues.push(makeIssue(
        IssueCategory.CAPTURED_ORDER_NOT_LOCKED,
        { intentId: intent.id, orderId: intent.order_id },
        'Order record missing for captured payment intent. Manual investigation required.'
      ));
      continue;
    }
    if (!SETTLED_OR_AFTER_LOCK.has(order.state)) {
      issues.push(makeIssue(
        IssueCategory.CAPTURED_ORDER_NOT_LOCKED,
        { intentId: intent.id, orderId: order.id, orderState: order.state },
        `Order state is ${order.state} but a captured payment exists. The order should be LOCKED or later. Manual review required.`
      ));
    }
    if (Number(intent.amount_paise) !== Number(order.upfront_paise)) {
      issues.push(makeIssue(
        IssueCategory.PAYMENT_AMOUNT_MISMATCH,
        { intentId: intent.id, orderId: order.id, intentAmount: intent.amount_paise, orderUpfront: order.upfront_paise },
        'Captured intent amount does not equal order.upfront_paise. Financial reconciliation required.'
      ));
    }
    if (intent.currency !== 'INR') {
      issues.push(makeIssue(
        IssueCategory.PAYMENT_CURRENCY_MISMATCH,
        { intentId: intent.id, orderId: order.id, currency: intent.currency },
        `Payment intent currency is ${intent.currency}, expected INR. Manual review required.`
      ));
    }
  }
  return issues;
}

/**
 * Check 3: Every LOCKED (or later) order must have a ledger transaction
 * with event_type = 'PAYMENT_CAPTURED' and idempotency_key = 'order:lock:<orderId>'.
 *
 * @param {object[]} orders – orders in states LOCKED, PURCHASED, LANDED, COMPLETED
 * @param {Map<string,object[]>} ledgerByOrderId – ledger_transactions keyed by order_id
 * @returns {object[]} issues
 */
export function checkCollectionLedger(orders, ledgerByOrderId) {
  const issues = [];
  for (const order of orders) {
    const txns = ledgerByOrderId.get(order.id) ?? [];
    const hasCollection = txns.some(
      (t) => t.event_type === 'PAYMENT_CAPTURED' &&
             t.idempotency_key === `order:lock:${order.id}`
    );
    if (!hasCollection) {
      issues.push(makeIssue(
        IssueCategory.LOCKED_MISSING_COLLECTION_LEDGER,
        { orderId: order.id, orderState: order.state },
        'No PAYMENT_CAPTURED ledger transaction found for this locked order. Manual posting or investigation required.'
      ));
    }
  }
  return issues;
}

/**
 * Check 4: Every COMPLETED order must have a ledger transaction
 * with event_type = 'ORDER_SETTLED' and idempotency_key = 'order:complete:<orderId>'.
 *
 * @param {object[]} completedOrders
 * @param {Map<string,object[]>} ledgerByOrderId
 * @returns {object[]} issues
 */
export function checkSettlementLedger(completedOrders, ledgerByOrderId) {
  const issues = [];
  for (const order of completedOrders) {
    const txns = ledgerByOrderId.get(order.id) ?? [];
    const hasSettlement = txns.some(
      (t) => t.event_type === 'ORDER_SETTLED' &&
             t.idempotency_key === `order:complete:${order.id}`
    );
    if (!hasSettlement) {
      issues.push(makeIssue(
        IssueCategory.COMPLETED_MISSING_SETTLEMENT_LEDGER,
        { orderId: order.id },
        'No ORDER_SETTLED ledger transaction found for this completed order. Manual investigation required.'
      ));
    }
  }
  return issues;
}

/**
 * Check 5 & 6: For every ledger transaction, verify its entries are balanced
 * (total debits === total credits) and each entry has a positive amount,
 * valid direction, and a non-empty account code.
 *
 * @param {object[]} transactions – ledger_transactions rows (with nested entries array)
 * @returns {object[]} issues
 */
export function checkLedgerBalance(transactions) {
  const issues = [];
  for (const txn of transactions) {
    const entries = txn.entries ?? [];
    if (entries.length < 2) {
      issues.push(makeIssue(
        IssueCategory.LEDGER_TRANSACTION_INVALID_ENTRY,
        { transactionId: txn.id, orderId: txn.order_id, eventType: txn.event_type },
        'Ledger transaction has fewer than 2 entries. At least a DEBIT and a CREDIT are required.'
      ));
      continue;
    }
    let debits = 0n;
    let credits = 0n;
    let entryInvalid = false;
    for (const entry of entries) {
      const amount = BigInt(Math.trunc(Number(entry.amount_paise ?? 0)));
      if (amount <= 0n || !['DEBIT', 'CREDIT'].includes(entry.direction) || !entry.account_code?.trim()) {
        issues.push(makeIssue(
          IssueCategory.LEDGER_TRANSACTION_INVALID_ENTRY,
          { transactionId: txn.id, entryId: entry.id, orderId: txn.order_id },
          'Ledger entry has a zero/negative amount, missing account code, or invalid direction.'
        ));
        entryInvalid = true;
        break;
      }
      if (entry.direction === 'DEBIT') debits += amount;
      else credits += amount;
    }
    if (!entryInvalid && debits !== credits) {
      issues.push(makeIssue(
        IssueCategory.UNBALANCED_LEDGER_TRANSACTION,
        { transactionId: txn.id, orderId: txn.order_id, eventType: txn.event_type, debits: String(debits), credits: String(credits) },
        'Ledger transaction is unbalanced. Debits and credits must match exactly. Manual correction via a compensating transaction required.'
      ));
    }
  }
  return issues;
}

/**
 * Check 7: Webhook events where processed_at IS NULL were received but
 * never fully processed. They may represent dropped handler executions.
 *
 * @param {object[]} webhookEvents
 * @returns {object[]} issues
 */
export function checkUnprocessedWebhooks(webhookEvents) {
  return webhookEvents.map((evt) =>
    makeIssue(
      IssueCategory.UNPROCESSED_WEBHOOK,
      { webhookEventId: evt.id, provider: evt.provider, eventType: evt.event_type, createdAt: evt.created_at },
      'Webhook event was stored but never marked processed. Re-processing or manual reconciliation may be required.'
    )
  );
}

/**
 * Check 8: Detect duplicate payment intents for the same order — more than
 * one intent in CAPTURED status, or multiple CREATING/CREATED/AUTHORIZED intents
 * for the same order (the DB unique index should prevent this, but we verify).
 *
 * @param {Map<string,object[]>} intentsByOrderId – payment_intents grouped by order_id
 * @returns {object[]} issues
 */
export function checkDuplicatePaymentIntents(intentsByOrderId) {
  const issues = [];
  const OPEN_STATUSES = new Set(['CREATING', 'CREATED', 'AUTHORIZED']);
  for (const [orderId, intents] of intentsByOrderId) {
    const captured = intents.filter((i) => i.status === 'CAPTURED');
    if (captured.length > 1) {
      issues.push(makeIssue(
        IssueCategory.DUPLICATE_PAYMENT_INTENT,
        { orderId, intentIds: captured.map((i) => i.id), duplicateType: 'multiple_captured' },
        'More than one CAPTURED payment intent for the same order. Manual reconciliation and potential refund review required.'
      ));
    }
    const open = intents.filter((i) => OPEN_STATUSES.has(i.status));
    if (open.length > 1) {
      issues.push(makeIssue(
        IssueCategory.DUPLICATE_PAYMENT_INTENT,
        { orderId, intentIds: open.map((i) => i.id), duplicateType: 'multiple_open' },
        'More than one open payment intent for the same order. The DB unique index may have been bypassed. Immediate investigation required.'
      ));
    }
  }
  return issues;
}

/**
 * Check 9: DISPUTED orders must not have an ORDER_SETTLED ledger transaction.
 * Disputes freeze settlement; if a settlement ledger entry exists something
 * went wrong with the authorization sequence.
 *
 * @param {object[]} disputedOrders
 * @param {Map<string,object[]>} ledgerByOrderId
 * @returns {object[]} issues
 */
export function checkDisputedOrderSettlement(disputedOrders, ledgerByOrderId) {
  const issues = [];
  for (const order of disputedOrders) {
    const txns = ledgerByOrderId.get(order.id) ?? [];
    const hasSettlement = txns.some((t) => t.event_type === 'ORDER_SETTLED');
    if (hasSettlement) {
      issues.push(makeIssue(
        IssueCategory.DISPUTED_ORDER_WITH_SETTLEMENT,
        { orderId: order.id },
        'A disputed order has an ORDER_SETTLED ledger transaction. Settlement should never happen while a dispute is open. Immediate manual review required.'
      ));
    }
  }
  return issues;
}

/**
 * Check 10: For every dispute, verify its amount does not exceed the captured payment amount.
 *
 * @param {object[]} disputes
 * @param {Map<string,object>} ordersById
 * @param {Map<string,object[]>} capturedIntentsByOrderId
 * @returns {object[]} issues
 */
export function checkDisputeReconciliation(disputes = [], ordersById = new Map(), capturedIntentsByOrderId = new Map()) {
  const issues = [];
  for (const dispute of disputes) {
    const order = ordersById.get(dispute.order_id);
    const intents = capturedIntentsByOrderId.get(dispute.order_id) ?? [];
    const totalCaptured = intents.reduce((sum, i) => sum + Number(i.amount_paise ?? 0), 0) || Number(order?.upfront_paise ?? 0);
    if (totalCaptured > 0 && Number(dispute.amount_paise) > totalCaptured) {
      issues.push(makeIssue(
        IssueCategory.DISPUTE_AMOUNT_MISMATCH,
        { disputeId: dispute.id, orderId: dispute.order_id, disputeAmount: dispute.amount_paise, capturedAmount: totalCaptured },
        `Dispute amount ${dispute.amount_paise} exceeds captured payment ${totalCaptured}. Immediate investigation required.`
      ));
    }
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* Summary builder                                                    */
/* ------------------------------------------------------------------ */

/**
 * Produce the structured reconciliation summary that the job returns.
 * `inspected` tracks totals; `issues` is the flat list; `queryFailures`
 * records individual fetch errors that made a check incomplete.
 */
export function buildSummary({ inspected, issues, queryFailures, ranAt }) {
  const byCategory = {};
  for (const issue of issues) {
    if (!byCategory[issue.category]) byCategory[issue.category] = [];
    byCategory[issue.category].push(issue);
  }
  const totalRecords = (inspected.orders ?? 0) + (inspected.paymentIntents ?? 0) + (inspected.ledgerTransactions ?? 0);
  // `consistent` = records with no issue found.  Each issue affects one record;
  // clamp at zero so a dense failure set never produces a negative count.
  const consistent = Math.max(0, totalRecords - issues.length);
  return {
    ranAt: ranAt ?? new Date().toISOString(),
    inspected,
    consistent,
    totalIssues: issues.length,
    queryFailures,
    issuesByCategory: byCategory,
    issues,
    note: 'Read-only reconciliation report. No database writes were performed. All findings require manual investigation.'
  };
}
