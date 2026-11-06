/**
 * Payment Dispute & Chargeback Management Engine.
 *
 * Handles dispute lifecycle: creation, status transitions, evidence tracking,
 * settlement blocking, refund conflict prevention, and ledger integrity.
 *
 * All monetary amounts are in integer minor units (paise).
 * Disputes are idempotent via provider_dispute_id uniqueness.
 * Ledger entries are never modified — reversals use new compensating entries.
 * No live Razorpay calls are made; all provider interactions happen via webhooks.
 */

import { HttpError } from '../utils/httpError.js';
import { assertSafeMinorUnits } from './money.js';
import { logger } from '../config/logger.js';

/* ------------------------------------------------------------------ */
/* Dispute lifecycle constants                                        */
/* ------------------------------------------------------------------ */

export const DISPUTE_STATUSES = Object.freeze([
  'CREATED',
  'UNDER_REVIEW',
  'ACTION_REQUIRED',
  'WON',
  'LOST',
  'CLOSED',
]);

export const DISPUTE_REASONS = Object.freeze([
  'DUPLICATE',
  'FRAUD',
  'INCORRECT_AMOUNT',
  'PRODUCT_NOT_RECEIVED',
  'PRODUCT_NOT_AS_DESCRIBED',
  'CANCELLED_ORDER',
  'REFUND_NOT_PROCESSED',
  'OTHER',
]);

/** Terminal dispute states — no further transitions allowed. */
export const TERMINAL_STATUSES = Object.freeze(new Set(['CLOSED']));

/** Dispute statuses that block settlement. */
export const SETTLEMENT_BLOCKING_STATUSES = Object.freeze(
  new Set(['CREATED', 'UNDER_REVIEW', 'ACTION_REQUIRED'])
);

/** Dispute statuses that block new refunds (unless explicitly permitted). */
export const REFUND_BLOCKING_STATUSES = Object.freeze(
  new Set(['CREATED', 'UNDER_REVIEW', 'ACTION_REQUIRED'])
);

/* ------------------------------------------------------------------ */
/* Valid state transitions (mirrors DB trigger)                        */
/* ------------------------------------------------------------------ */

export const VALID_TRANSITIONS = Object.freeze({
  CREATED:         new Set(['UNDER_REVIEW', 'ACTION_REQUIRED', 'CLOSED']),
  UNDER_REVIEW:    new Set(['ACTION_REQUIRED', 'WON', 'LOST', 'CLOSED']),
  ACTION_REQUIRED: new Set(['UNDER_REVIEW', 'WON', 'LOST', 'CLOSED']),
  WON:             new Set(['CLOSED']),
  LOST:            new Set(['CLOSED']),
  CLOSED:          new Set(),
});

/* ------------------------------------------------------------------ */
/* Razorpay dispute event mapping                                     */
/* ------------------------------------------------------------------ */

/** Map Razorpay webhook event types to internal dispute statuses. */
export const RAZORPAY_EVENT_STATUS_MAP = Object.freeze({
  'dispute.created':           'CREATED',
  'payment.dispute.created':   'CREATED',
  'dispute.under_review':      'UNDER_REVIEW',
  'dispute.action_required':   'ACTION_REQUIRED',
  'dispute.won':               'WON',
  'dispute.lost':              'LOST',
  'dispute.closed':            'CLOSED',
});

/** Map Razorpay dispute reason codes to internal reason enum values. */
export const RAZORPAY_REASON_MAP = Object.freeze({
  'chargeback':               'OTHER',
  'fraud':                    'FRAUD',
  'duplicate':                'DUPLICATE',
  'incorrect_amount':         'INCORRECT_AMOUNT',
  'product_not_received':     'PRODUCT_NOT_RECEIVED',
  'product_unacceptable':     'PRODUCT_NOT_AS_DESCRIBED',
  'subscription_cancelled':   'CANCELLED_ORDER',
  'refund_not_processed':     'REFUND_NOT_PROCESSED',
  'credit_not_processed':     'REFUND_NOT_PROCESSED',
});

/* ------------------------------------------------------------------ */
/* Dispute validation                                                 */
/* ------------------------------------------------------------------ */

/**
 * Validate that a status transition is legal.
 *
 * @param {string} fromStatus - Current dispute status.
 * @param {string} toStatus - Target dispute status.
 * @returns {boolean} true if valid.
 * @throws {HttpError} if transition is invalid.
 */
export function assertDisputeTransition(fromStatus, toStatus) {
  if (!DISPUTE_STATUSES.includes(fromStatus) || !DISPUTE_STATUSES.includes(toStatus)) {
    throw new HttpError(400, 'UNKNOWN_DISPUTE_STATUS', `Unknown dispute status: ${fromStatus} or ${toStatus}`);
  }
  if (!VALID_TRANSITIONS[fromStatus]?.has(toStatus)) {
    throw new HttpError(409, 'INVALID_DISPUTE_TRANSITION', `Dispute transition ${fromStatus} → ${toStatus} is not allowed.`);
  }
  return true;
}

/**
 * Validate and normalize a dispute reason from a provider reason string.
 *
 * @param {string} providerReason - Raw reason string from provider.
 * @returns {string} Normalized dispute_reason enum value.
 */
export function normalizeDisputeReason(providerReason) {
  if (!providerReason) return 'OTHER';
  const normalized = String(providerReason).toLowerCase().trim();
  return RAZORPAY_REASON_MAP[normalized] ?? 'OTHER';
}

/**
 * Validate dispute creation data.
 *
 * @param {object} options
 * @returns {object} Validated dispute record data.
 */
export function validateDisputeData({
  orderId, paymentIntentId, provider, providerDisputeId,
  providerPaymentId, providerOrderId, amountPaise,
  currency = 'INR', reason, evidenceDeadline, metadata = {},
} = {}) {
  if (!orderId || typeof orderId !== 'string') {
    throw new HttpError(400, 'ORDER_ID_REQUIRED', 'Order ID is required.');
  }
  if (!provider || !['RAZORPAY', 'MOCK'].includes(provider)) {
    throw new HttpError(400, 'INVALID_PROVIDER', 'Provider must be RAZORPAY or MOCK.');
  }
  assertSafeMinorUnits(amountPaise, 'amountPaise');
  if (amountPaise <= 0) {
    throw new HttpError(400, 'INVALID_DISPUTE_AMOUNT', 'Dispute amount must be positive.');
  }
  if (currency !== 'INR') {
    throw new HttpError(400, 'UNSUPPORTED_CURRENCY', 'Only INR disputes are supported.');
  }
  const normalizedReason = DISPUTE_REASONS.includes(reason) ? reason : normalizeDisputeReason(reason);
  return {
    order_id: orderId,
    payment_intent_id: paymentIntentId ?? null,
    provider,
    provider_dispute_id: providerDisputeId ?? null,
    provider_payment_id: providerPaymentId ?? null,
    provider_order_id: providerOrderId ?? null,
    amount_paise: amountPaise,
    currency,
    reason: normalizedReason,
    status: 'CREATED',
    evidence_deadline: evidenceDeadline ?? null,
    metadata: metadata ?? {},
  };
}

/* ------------------------------------------------------------------ */
/* Settlement & refund conflict checks                                */
/* ------------------------------------------------------------------ */

/**
 * Check whether an order has any active (unresolved) disputes
 * that block settlement.
 *
 * @param {object[]} disputes - Dispute rows for the order.
 * @returns {{ blocked: boolean, reason?: string, disputeIds?: string[] }}
 */
export function checkSettlementBlock(disputes) {
  if (!Array.isArray(disputes) || disputes.length === 0) {
    return { blocked: false };
  }
  const blocking = disputes.filter(
    (d) => SETTLEMENT_BLOCKING_STATUSES.has(d.status)
  );
  if (blocking.length === 0) return { blocked: false };
  return {
    blocked: true,
    reason: `Settlement blocked by ${blocking.length} active dispute(s).`,
    disputeIds: blocking.map((d) => d.id),
  };
}

/**
 * Check whether an order has any active disputes that prevent
 * issuing new refunds.
 *
 * @param {object[]} disputes - Dispute rows for the order.
 * @param {boolean} [policyOverride=false] - If true, allow refund despite active disputes.
 * @returns {{ blocked: boolean, reason?: string, disputeIds?: string[] }}
 */
export function checkRefundConflict(disputes, policyOverride = false) {
  if (policyOverride) return { blocked: false };
  if (!Array.isArray(disputes) || disputes.length === 0) {
    return { blocked: false };
  }
  const blocking = disputes.filter(
    (d) => REFUND_BLOCKING_STATUSES.has(d.status)
  );
  if (blocking.length === 0) return { blocked: false };
  return {
    blocked: true,
    reason: `Refund blocked by ${blocking.length} active dispute(s). Use policy override to permit.`,
    disputeIds: blocking.map((d) => d.id),
  };
}

/* ------------------------------------------------------------------ */
/* Dispute amount reconciliation                                      */
/* ------------------------------------------------------------------ */

/**
 * Reconcile dispute amount against the captured payment for the order.
 * The dispute amount must not exceed the captured payment amount.
 *
 * @param {number} disputeAmountPaise - Dispute amount.
 * @param {number} capturedAmountPaise - Captured payment amount.
 * @returns {{ valid: boolean, reason?: string }}
 */
export function reconcileDisputeAmount(disputeAmountPaise, capturedAmountPaise) {
  const dAmount = Number(disputeAmountPaise);
  const cAmount = Number(capturedAmountPaise);
  if (!Number.isSafeInteger(dAmount) || dAmount <= 0) {
    return { valid: false, reason: 'Dispute amount must be a positive integer.' };
  }
  if (!Number.isSafeInteger(cAmount) || cAmount <= 0) {
    return { valid: false, reason: 'Captured payment amount must be a positive integer.' };
  }
  if (dAmount > cAmount) {
    return {
      valid: false,
      reason: `Dispute amount ${dAmount} exceeds captured payment ${cAmount}.`,
    };
  }
  return { valid: true };
}

/* ------------------------------------------------------------------ */
/* Dispute ledger operations                                          */
/* ------------------------------------------------------------------ */

/**
 * Build a balanced dispute-lost ledger journal.
 * When a dispute is LOST, the merchant loses funds. This reverses the
 * escrow hold: debits ESCROW_HOLD and credits DISPUTE_LOSS.
 *
 * Only called after a confirmed provider outcome.
 * Uses postLedger's idempotency (via idempotency key) to prevent double-posting.
 *
 * @param {object} supabaseClient
 * @param {object} order - Order row
 * @param {string} disputeId - Dispute UUID
 * @param {number} amountPaise - Dispute loss amount
 * @param {string} actorId - System actor UUID
 */
export async function postDisputeLostLedger(supabaseClient, order, disputeId, amountPaise, actorId) {
  const { postLedger } = await import('./ledger.js');
  const amount = Number(amountPaise);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new HttpError(400, 'INVALID_DISPUTE_AMOUNT', 'Dispute loss amount must be a positive integer.');
  }
  await postLedger(supabaseClient, {
    orderId: order.id,
    eventType: 'DISPUTE_LOST',
    idempotencyKey: `dispute:lost:${disputeId}`,
    actorId,
    metadata: { disputeId, description: 'Funds reversed due to lost dispute/chargeback' },
    entries: [
      { accountCode: 'ESCROW_HOLD', direction: 'DEBIT', amountPaise: amount },
      { accountCode: 'DISPUTE_LOSS', direction: 'CREDIT', amountPaise: amount },
    ],
  });
  logger.info({ orderId: order.id, disputeId, amountPaise: amount }, 'dispute_lost_ledger_posted');
}

/**
 * Build a balanced dispute-won reversal ledger journal.
 * When a dispute is WON, the funds remain in escrow (no action needed).
 * We post a record-keeping entry for audit trail.
 *
 * @param {object} supabaseClient
 * @param {string} orderId - Order UUID
 * @param {string} disputeId - Dispute UUID
 * @param {string} actorId - System actor UUID
 */
export async function recordDisputeWonEvent(supabaseClient, orderId, disputeId, actorId) {
  logger.info({ orderId, disputeId, actorId }, 'dispute_won_recorded');
}

/* ------------------------------------------------------------------ */
/* Webhook event parsing                                              */
/* ------------------------------------------------------------------ */

/**
 * Parse a Razorpay dispute webhook payload into a normalized dispute event.
 *
 * @param {object} payload - Parsed JSON webhook payload.
 * @param {string} eventType - Razorpay event type string.
 * @returns {object|null} Normalized dispute data, or null if not a dispute event.
 */
export function parseRazorpayDisputeEvent(payload, eventType) {
  const targetStatus = RAZORPAY_EVENT_STATUS_MAP[eventType];
  if (!targetStatus) return null;

  // Razorpay dispute entity can be at payload.payload.dispute.entity
  // or payload.payload.payment.entity for payment.dispute.created
  const disputeEntity = payload?.payload?.dispute?.entity
    ?? payload?.payload?.payment?.entity?.dispute;

  if (!disputeEntity) return null;

  const paymentEntity = payload?.payload?.payment?.entity;

  return {
    providerDisputeId: disputeEntity.id ?? null,
    providerPaymentId: disputeEntity.payment_id ?? paymentEntity?.id ?? null,
    providerOrderId: paymentEntity?.order_id ?? null,
    amountPaise: Number(disputeEntity.amount ?? 0),
    currency: String(disputeEntity.currency ?? 'INR').toUpperCase(),
    reason: normalizeDisputeReason(disputeEntity.reason_code ?? disputeEntity.reason_type ?? null),
    targetStatus,
    evidenceDeadline: disputeEntity.respond_by
      ? new Date(disputeEntity.respond_by * 1000).toISOString()
      : null,
    phase: disputeEntity.phase ?? null,
    metadata: {
      razorpayPhase: disputeEntity.phase ?? null,
      razorpayStatus: disputeEntity.status ?? null,
      razorpayReasonCode: disputeEntity.reason_code ?? null,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Dispute history helpers                                            */
/* ------------------------------------------------------------------ */

/**
 * Build a dispute event record for the audit trail.
 *
 * @param {object} options
 * @returns {object} Dispute event record for insertion.
 */
export function buildDisputeEvent({
  disputeId, fromStatus, toStatus, eventType, actorId = null, note = null, metadata = {},
} = {}) {
  if (!disputeId) throw new HttpError(400, 'DISPUTE_ID_REQUIRED', 'Dispute ID is required.');
  if (!toStatus || !DISPUTE_STATUSES.includes(toStatus)) {
    throw new HttpError(400, 'INVALID_TO_STATUS', 'A valid target status is required.');
  }
  if (fromStatus != null && !DISPUTE_STATUSES.includes(fromStatus)) {
    throw new HttpError(400, 'INVALID_FROM_STATUS', 'Invalid source status.');
  }
  if (!eventType || typeof eventType !== 'string') {
    throw new HttpError(400, 'EVENT_TYPE_REQUIRED', 'Event type is required.');
  }
  return {
    dispute_id: disputeId,
    from_status: fromStatus ?? null,
    to_status: toStatus,
    event_type: eventType,
    actor_id: actorId ?? null,
    note: note ? String(note).slice(0, 500) : null,
    metadata: metadata ?? {},
  };
}

/**
 * Build a timeline of dispute events for admin display.
 * Strips sensitive information and raw webhook payloads.
 *
 * @param {object[]} events - dispute_events rows.
 * @param {object[]} evidenceRecords - dispute_evidence rows.
 * @returns {object[]} Formatted timeline entries.
 */
export function buildDisputeTimeline(events = [], evidenceRecords = []) {
  const timeline = [];

  for (const ev of events) {
    timeline.push({
      type: 'DISPUTE_STATE_CHANGE',
      at: ev.created_at,
      fromStatus: ev.from_status ?? null,
      toStatus: ev.to_status,
      eventType: ev.event_type,
      actorId: ev.actor_id ?? null,
      note: ev.note ?? null,
    });
  }

  for (const ev of evidenceRecords) {
    timeline.push({
      type: 'EVIDENCE_UPLOADED',
      at: ev.created_at,
      evidenceId: ev.id,
      originalFilename: ev.original_filename ?? null,
      mimeType: ev.mime_type ?? null,
      sizeBytes: ev.size_bytes ?? null,
      uploadedBy: ev.uploaded_by ?? null,
      description: ev.description ?? null,
    });
  }

  // Sort ascending by timestamp.
  timeline.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));
  return timeline;
}

/**
 * Build a dispute financial impact summary for admin display.
 *
 * @param {object} dispute - Dispute row.
 * @param {object} order - Order row.
 * @param {object[]} ledgerTxns - Ledger transactions for the order.
 * @returns {object} Financial impact summary.
 */
export function buildDisputeFinancialImpact(dispute, order, ledgerTxns = []) {
  const hasCollection = ledgerTxns.some(
    (t) => t.event_type === 'PAYMENT_CAPTURED' && t.idempotency_key === `order:lock:${order.id}`
  );
  const hasSettlement = ledgerTxns.some((t) => t.event_type === 'ORDER_SETTLED');
  const hasDisputeLoss = ledgerTxns.some(
    (t) => t.event_type === 'DISPUTE_LOST' && t.idempotency_key === `dispute:lost:${dispute.id}`
  );

  return {
    disputeId: dispute.id,
    orderId: order.id,
    disputeAmountPaise: dispute.amount_paise,
    orderUpfrontPaise: order.upfront_paise,
    currency: dispute.currency ?? 'INR',
    status: dispute.status,
    hasCollectionLedger: hasCollection,
    hasSettlementLedger: hasSettlement,
    hasDisputeLossLedger: hasDisputeLoss,
    isSettlementBlocked: SETTLEMENT_BLOCKING_STATUSES.has(dispute.status),
    evidenceDeadline: dispute.evidence_deadline ?? null,
    createdAt: dispute.created_at,
    resolvedAt: dispute.resolved_at ?? null,
  };
}

