/**
 * Admin Transaction Monitoring service.
 *
 * Pure functions for building timeline events, transaction summaries and
 * exception flags. All DB IO is done in the route layer and injected here.
 * This keeps the logic side-effect free and unit testable.
 *
 * Reconciliation checks are re-used from src/services/reconciliation.js;
 * this module does not re-implement them.
 */

export const SENSITIVE_FIELDS = Object.freeze([
  'otp_hash', 'raw_provider_reference', 'payload', 'secret', 'password',
  'token', 'key', 'phone_e164', 'email', 'full_name', 'passport'
]);

// Maximum page sizes enforced for admin list endpoints.
export const MAX_PAGE_LIMIT = 100;
export const DEFAULT_PAGE_LIMIT = 25;

/** Clamp a requested page limit to [1, MAX_PAGE_LIMIT]. */
export function clampPageLimit(requested, fallback = DEFAULT_PAGE_LIMIT) {
  const n = Math.trunc(Number(requested));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(n, 1), MAX_PAGE_LIMIT);
}

/** Strip any key whose name contains a sensitive term (case-insensitive). */
export function redactSensitive(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some((f) => k.toLowerCase().includes(f))) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactSensitive(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Build a unified chronological timeline for an order.
 *
 * Sources combined (all optional — missing sources produce empty sections):
 *   - order_events   → state transitions
 *   - payment_intents → payment state changes (status field)
 *   - ledger_transactions → money events
 *   - webhook_events → provider signals (payload NOT included)
 *
 * Returns events sorted ascending by timestamp. Sensitive fields are redacted.
 * Raw webhook payloads are never included.
 */
export function buildTimeline({ orderEvents = [], paymentIntents = [], ledgerTransactions = [], webhookEvents = [] }) {
  const events = [];

  for (const ev of orderEvents) {
    events.push({
      type: 'ORDER_STATE_CHANGE',
      at: ev.created_at,
      fromState: ev.from_state ?? null,
      toState: ev.to_state,
      actorId: ev.actor_id ?? null,
      note: ev.note ?? null,
    });
  }

  for (const pi of paymentIntents) {
    // One status-change event per intent — use created_at as the timestamp.
    events.push({
      type: 'PAYMENT_INTENT',
      at: pi.updated_at ?? pi.created_at,
      intentId: pi.id,
      provider: pi.provider,
      status: pi.status,
      amountPaise: pi.amount_paise,
      currency: pi.currency,
      providerOrderId: pi.provider_order_id ?? null,
      // Never expose raw_provider_reference — it may contain credentials.
    });
  }

  for (const lt of ledgerTransactions) {
    events.push({
      type: 'LEDGER_EVENT',
      at: lt.created_at,
      transactionId: lt.id,
      eventType: lt.event_type,
      idempotencyKey: lt.idempotency_key,
    });
  }

  for (const we of webhookEvents) {
    events.push({
      type: 'WEBHOOK_RECEIVED',
      at: we.created_at,
      webhookEventId: we.id,
      provider: we.provider,
      eventType: we.event_type,
      processedAt: we.processed_at ?? null,
      // payload field intentionally excluded.
    });
  }

  // Sort ascending by timestamp; use string comparison (ISO 8601 sorts correctly).
  events.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));
  return events;
}

/**
 * Build the financial and status summary for one order.
 * Never returns OTP hashes, raw provider references, or personal data.
 */
export function buildTransactionSummary(order, capturedIntents, ledgerTransactions) {
  const paymentStatus = (() => {
    if (!capturedIntents?.length) return 'NONE';
    if (capturedIntents.some((i) => i.status === 'CAPTURED')) return 'CAPTURED';
    if (capturedIntents.some((i) => ['AUTHORIZED', 'CREATED'].includes(i.status))) return 'PENDING';
    if (capturedIntents.some((i) => i.status === 'CREATING')) return 'CREATING';
    if (capturedIntents.some((i) => i.status === 'PARTIALLY_REFUNDED')) return 'PARTIALLY_REFUNDED';
    if (capturedIntents.some((i) => i.status === 'REFUNDED')) return 'REFUNDED';
    if (capturedIntents.every((i) => i.status === 'FAILED')) return 'FAILED';
    return 'UNKNOWN';
  })();

  const collectionLedgerPresent = (ledgerTransactions ?? []).some(
    (t) => t.event_type === 'PAYMENT_CAPTURED' && t.idempotency_key === `order:lock:${order.id}`
  );
  const settlementLedgerPresent = (ledgerTransactions ?? []).some(
    (t) => t.event_type === 'ORDER_SETTLED' && t.idempotency_key === `order:complete:${order.id}`
  );

  return {
    orderId: order.id,
    state: order.state,
    isDisputed: order.state === 'DISPUTED',
    // Frozen financial snapshot — amounts are immutable after order creation.
    financials: {
      subtotalPaise: order.subtotal_paise,
      dutyPaise: order.duty_paise,
      travellerRewardPaise: order.traveller_reward_paise,
      platformFeePaise: order.platform_fee_paise,
      totalPaise: order.total_paise,
      depositPaise: order.deposit_paise,
      upfrontPaise: order.upfront_paise,
      balancePaise: order.balance_paise,
      currency: order.currency ?? 'INR',
    },
    paymentStatus,
    collectionLedgerPresent,
    settlementLedgerPresent,
    paymentDeadline: order.payment_deadline,
    forfeitAt: order.forfeit_at ?? null,
    createdAt: order.created_at,
    updatedAt: order.updated_at ?? null,
  };
}

/**
 * Run exception checks against a single order's data using the reconciliation
 * functions. Returns a (possibly empty) array of exception flags.
 *
 * Import the check functions lazily to avoid circular imports if monitoring
 * is ever imported by reconciliation in future.
 */
export function buildExceptionFlags({ order, capturedIntents = [], ledgerTransactions = [],
  checkCapturedPayments, checkCollectionLedger, checkSettlementLedger, checkDisputedOrderSettlement }) {
  const ordersById = new Map([[order.id, order]]);
  const ledgerByOrderId = new Map([[order.id, ledgerTransactions]]);
  const LOCKED_OR_AFTER = new Set(['LOCKED', 'PURCHASED', 'LANDED', 'COMPLETED']);
  const lockedOrAfter = LOCKED_OR_AFTER.has(order.state) ? [order] : [];
  const completed = order.state === 'COMPLETED' ? [order] : [];
  const disputed = order.state === 'DISPUTED' ? [order] : [];

  const issues = [
    ...checkCapturedPayments(capturedIntents, ordersById),
    ...checkCollectionLedger(lockedOrAfter, ledgerByOrderId),
    ...checkSettlementLedger(completed, ledgerByOrderId),
    ...checkDisputedOrderSettlement(disputed, ledgerByOrderId),
  ];

  return issues.map((i) => ({ category: i.category, affectedIds: i.affectedIds, recommendation: i.recommendation }));
}

/**
 * Build the list-row shape returned by GET /admin/transactions.
 * Strips bulky or sensitive data from the order row for list display.
 */
export function buildListRow(order, capturedIntents, ledgerTransactions) {
  const summary = buildTransactionSummary(order, capturedIntents, ledgerTransactions);
  return {
    orderId: order.id,
    state: order.state,
    buyerId: order.buyer_id,
    travellerId: order.traveller_id,
    totalPaise: order.total_paise,
    upfrontPaise: order.upfront_paise,
    balancePaise: order.balance_paise,
    currency: order.currency ?? 'INR',
    paymentStatus: summary.paymentStatus,
    collectionLedgerPresent: summary.collectionLedgerPresent,
    settlementLedgerPresent: summary.settlementLedgerPresent,
    isDisputed: summary.isDisputed,
    createdAt: order.created_at,
    paymentDeadline: order.payment_deadline,
  };
}
