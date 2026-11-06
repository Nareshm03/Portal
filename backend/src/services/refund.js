/**
 * Refund, Cancellation & Payment Recovery Engine.
 *
 * Handles buyer/traveller cancellation, full and partial refunds,
 * refund status tracking, payment failure recovery, and dispute handling.
 *
 * All monetary amounts are in integer minor units (paise).
 * Refunds are idempotent via idempotency keys.
 * Ledger reversals are balanced transactions (never modify existing entries).
 * Refund records are persisted in the dedicated `refunds` table.
 */

import { HttpError } from '../utils/httpError.js';
import { assertSafeMinorUnits } from './money.js';
import { postRefundLedger } from './ledger.js';
import { assertTransition } from './stateMachine.js';
import { createRazorpayRefund, fetchRazorpayRefund } from './razorpay.js';
import { logger } from '../config/logger.js';

/* ------------------------------------------------------------------ */
/* Refund status constants                                            */
/* ------------------------------------------------------------------ */

export const REFUND_STATUSES = Object.freeze([
  'PENDING',   // Refund intent created, not yet submitted to provider
  'PROCESSING', // Refund submitted to provider, awaiting confirmation
  'COMPLETED',  // Refund confirmed by provider and ledger posted
  'FAILED',     // Refund failed (provider error or insufficient funds)
  'REVERSED',   // Refund was reversed/charged back by provider
]);

/* ------------------------------------------------------------------ */
/* Cancellation eligibility                                           */
/* ------------------------------------------------------------------ */

/**
 * Check whether the requesting user can cancel the given order.
 *
 * Business rules:
 *   - Buyer may cancel ACCEPTED orders (no payment captured yet).
 *   - Buyer may cancel LOCKED orders (payment captured; refund required).
 *   - Traveller may cancel LOCKED or PURCHASED orders (before landing).
 *   - Disputed, COMPLETED, FORFEITED, EXPIRED, CANCELLED, REFUNDED orders
 *     cannot be cancelled.
 *   - Only order participants (buyer or traveller) may cancel.
 *
 * @param {object} order - order row from DB
 * @param {string} userId - requesting user ID
 * @param {string} userRole - 'buyer' or 'traveller'
 * @returns {object} { eligible: boolean, reason?: string }
 */
export function checkCancellationEligibility(order, userId, userRole) {
  const isBuyer = order.buyer_id === userId;
  const isTraveller = order.traveller_id === userId;
  if (!isBuyer && !isTraveller) {
    return { eligible: false, reason: 'Only order participants may cancel.' };
  }
  const state = order.state;
  const TERMINAL_NO_CANCEL = new Set(['COMPLETED', 'FORFEITED', 'EXPIRED', 'CANCELLED', 'REFUNDED']);
  if (TERMINAL_NO_CANCEL.has(state)) {
    return { eligible: false, reason: `Order is ${state}; cancellation is not allowed.` };
  }
  if (state === 'DISPUTED') {
    return { eligible: false, reason: 'Order is in dispute; cancellation is blocked until dispute is resolved.' };
  }
  if (state === 'ACCEPTED') {
    if (!isBuyer) return { eligible: false, reason: 'Only the buyer may cancel before payment.' };
    return { eligible: true, reason: 'Buyer cancellation before payment; no refund required.' };
  }
  if (state === 'LOCKED') {
    // Payment captured; refund required for cancellation
    if (!isBuyer && !isTraveller) return { eligible: false, reason: 'Not authorized.' };
    return { eligible: true, reason: 'Payment captured; refund required for cancellation.' };
  }
  if (state === 'PURCHASED') {
    // Traveller confirmed purchase but has not landed; only traveller may cancel
    if (!isTraveller) return { eligible: false, reason: 'Only the traveller may cancel after purchase confirmation.' };
    return { eligible: true, reason: 'Traveller cancellation after purchase; refund required.' };
  }
  if (state === 'LANDED') {
    return { eligible: false, reason: 'Order has landed; cancellation is not allowed. Use dispute if applicable.' };
  }
  return { eligible: false, reason: `Order state ${state} does not permit cancellation.` };
}

/* ------------------------------------------------------------------ */
/* Refundable amount calculation                                      */
/* ------------------------------------------------------------------ */

/**
 * Calculate the maximum refundable amount for an order.
 *
 * Rules:
 *   - Refundable = captured payment amount (upfront_paise if CAPTURED)
 *   - Minus any already-refunded amount (from completed refunds)
 *   - Cannot exceed upfront_paise
 *
 * @param {object} order - order row from DB
 * @param {number} capturedAmountPaise - total captured amount in paise
 * @param {object[]} existingRefunds - already-processed refunds from the refunds table
 * @returns {number} max refundable amount in paise
 */
export function getRefundableAmount(order, capturedAmountPaise, existingRefunds = []) {
  const upfrontPaise = Number(order.upfront_paise ?? 0);
  const refundable = Math.min(Number(capturedAmountPaise), upfrontPaise);
  let refundedTotal = 0;
  for (const refund of existingRefunds) {
    if (refund.status === 'COMPLETED') {
      refundedTotal += Number(refund.amount_paise ?? 0);
    }
  }
  return Math.max(0, refundable - refundedTotal);
}

/* ------------------------------------------------------------------ */
/* Refund intent validation                                           */
/* ------------------------------------------------------------------ */

/**
 * Validate and prepare a refund intent. Does not insert into the DB.
 *
 * @param {object} options
 * @param {string} options.orderId - order UUID
 * @param {string} options.buyerId - requesting user ID
 * @param {string} options.userRole - 'buyer' or 'traveller'
 * @param {number} [options.amountPaise] - refund amount (defaults to refundable max)
 * @param {string} options.reason - cancellation reason
 * @param {string} options.idempotencyKey - idempotency key (8-120 safe chars)
 * @param {string} [options.mode='auto'] - 'test' | 'live' | 'auto'
 * @returns {object} { orderId, buyerId, userRole, amountPaise, reason, idempotencyKey, mode }
 */
export function prepareRefundIntent({
  orderId, buyerId, userRole, amountPaise, reason, idempotencyKey, mode = 'auto'
} = {}) {
  if (!orderId || typeof orderId !== 'string') throw new HttpError(400, 'ORDER_ID_REQUIRED', 'Order ID is required.');
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,120}$/.test(idempotencyKey)) {
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Provide an Idempotency-Key header (8–120 safe characters).');
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 1) {
    throw new HttpError(400, 'REFUND_REASON_REQUIRED', 'A cancellation reason is required.');
  }
  if (amountPaise !== undefined) {
    assertSafeMinorUnits(amountPaise, 'amountPaise');
    if (amountPaise <= 0) throw new HttpError(400, 'INVALID_REFUND_AMOUNT', 'Refund amount must be positive.');
  }
  return {
    orderId,
    buyerId,
    userRole,
    amountPaise: amountPaise ?? null,
    reason: reason.trim(),
    idempotencyKey,
    mode,
  };
}

/* ------------------------------------------------------------------ */
/* Provider refund execution                                          */
/* ------------------------------------------------------------------ */

/**
 * Execute a refund through the configured provider.
 *
 * For MOCK: marks the refund COMPLETED immediately (no provider call).
 * For RAZORPAY_TEST / RAZORPAY: calls Razorpay refund API.
 *
 * @param {object} options
 * @param {string} options.paymentIntentId - payment intent UUID (for logging)
 * @param {string} options.providerOrderId - Razorpay order ID
 * @param {string} options.providerPaymentId - Razorpay payment ID
 * @param {number} options.amountPaise - refund amount in paise
 * @param {string} options.receipt - refund receipt ID
 * @param {string} options.mode - 'test' | 'live' | 'auto'
 * @returns {Promise<{ status: string, providerRefundId?: string, providerData?: object }>}
 */
export async function executeProviderRefund({
  paymentIntentId, providerOrderId, providerPaymentId, amountPaise, receipt, mode = 'auto'
} = {}) {
  if (!providerPaymentId) {
    // MOCK or no provider payment: complete immediately
    return { status: 'COMPLETED', providerRefundId: `mock_refund_${paymentIntentId}`, providerData: { mode: 'MOCK' } };
  }
  try {
    const refund = await createRazorpayRefund({
      paymentId: providerPaymentId,
      amountPaise,
      receipt,
      notes: { portal_payment_intent_id: paymentIntentId, portal_order_id: providerOrderId, mode: mode === 'test' ? 'test' : 'live' },
      mode,
    });
    return {
      status: refund.status === 'processed' ? 'COMPLETED' : 'PROCESSING',
      providerRefundId: refund.id,
      providerData: refund,
    };
  } catch (err) {
    logger.error({ err, paymentIntentId, providerPaymentId, amountPaise }, 'provider_refund_failed');
    return { status: 'FAILED', providerRefundId: null, providerData: { error: err.message } };
  }
}

/* ------------------------------------------------------------------ */
/* Refund verification                                                */
/* ------------------------------------------------------------------ */

/**
 * Verify a refund status with the provider.
 *
 * @param {string} providerPaymentId - Razorpay payment ID
 * @param {string} providerRefundId - Razorpay refund ID
 * @param {string} mode - 'test' | 'live' | 'auto'
 * @returns {Promise<{ status: string, providerData?: object }>}
 */
export async function verifyProviderRefund(providerPaymentId, providerRefundId, mode = 'auto') {
  if (!providerRefundId || !providerRefundId.startsWith('mock_refund_')) {
    try {
      const refund = await fetchRazorpayRefund(providerPaymentId, providerRefundId, mode);
      return {
        status: refund.status === 'processed' ? 'COMPLETED' : refund.status === 'failed' ? 'FAILED' : 'PROCESSING',
        providerData: refund,
      };
    } catch (err) {
      logger.error({ err, providerPaymentId, providerRefundId }, 'provider_refund_verify_failed');
      return { status: 'PROCESSING', providerData: { error: err.message } };
    }
  }
  return { status: 'COMPLETED', providerData: { mode: 'MOCK' } };
}

/* ------------------------------------------------------------------ */
/* Refund record helpers                                              */
/* ------------------------------------------------------------------ */

/**
 * Validate refund record data before insertion into the refunds table.
 *
 * @param {object} options
 * @param {string} options.orderId
 * @param {string} options.buyerId
 * @param {string} options.userRole
 * @param {number} options.amountPaise
 * @param {string} options.reason
 * @param {string} options.idempotencyKey
 * @param {string} options.provider
 * @param {string} [options.paymentIntentId]
 * @returns {object} validated refund record data
 */
export function validateRefundRecord({
  orderId, buyerId, userRole, amountPaise, reason, idempotencyKey, provider, paymentIntentId
} = {}) {
  if (!orderId || typeof orderId !== 'string') throw new HttpError(400, 'ORDER_ID_REQUIRED', 'Order ID is required.');
  if (!buyerId || typeof buyerId !== 'string') throw new HttpError(400, 'BUYER_ID_REQUIRED', 'Buyer ID is required.');
  if (!userRole || !['buyer', 'traveller'].includes(userRole)) {
    throw new HttpError(400, 'INVALID_USER_ROLE', 'userRole must be buyer or traveller.');
  }
  assertSafeMinorUnits(amountPaise, 'amountPaise');
  if (amountPaise <= 0) throw new HttpError(400, 'INVALID_REFUND_AMOUNT', 'Refund amount must be positive.');
  if (!reason || typeof reason !== 'string' || reason.trim().length < 1) {
    throw new HttpError(400, 'REFUND_REASON_REQUIRED', 'A cancellation reason is required.');
  }
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,120}$/.test(idempotencyKey)) {
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Provide an Idempotency-Key header (8–120 safe characters).');
  }
  if (!provider || !['MOCK', 'RAZORPAY'].includes(provider)) {
    throw new HttpError(400, 'INVALID_PROVIDER', 'Provider must be MOCK or RAZORPAY.');
  }
  return {
    order_id: orderId,
    buyer_id: buyerId,
    user_role: userRole,
    amount_paise: amountPaise,
    reason: reason.trim(),
    idempotency_key: idempotencyKey,
    provider,
    payment_intent_id: paymentIntentId ?? null,
    status: 'PENDING',
  };
}

/**
 * Build the provider reference payload for a refund record.
 *
 * @param {object} options
 * @param {string} options.refundType - 'full' | 'partial'
 * @param {string} options.reason
 * @param {string|null} options.originalPaymentId
 * @param {string|null} options.providerRefundId
 * @param {string} options.status
 * @param {object} [options.providerData]
 * @returns {object}
 */
export function buildRefundReference({
  refundType, reason, originalPaymentId, providerRefundId, status, providerData
} = {}) {
  return {
    refund_type: refundType,
    reason,
    original_payment_id: originalPaymentId,
    provider_refund_id: providerRefundId,
    status,
    provider_data: providerData ?? null,
    executed_at: providerRefundId ? new Date().toISOString() : null,
  };
}

/**
 * Check whether a refund's cumulative amount would exceed the refundable limit.
 *
 * @param {number} capturedAmountPaise - total captured amount for the order
 * @param {number} existingRefundedTotal - sum of completed refund amounts
 * @param {number} newAmountPaise - amount of the new refund request
 * @returns {number} max additional refundable amount
 */
export function checkRefundLimit(capturedAmountPaise, existingRefundedTotal, newAmountPaise) {
  const maxRefundable = Math.max(0, capturedAmountPaise - existingRefundedTotal);
  if (newAmountPaise > maxRefundable) {
    throw new HttpError(409, 'REFUND_EXCEEDS_CAPTURED', `Refund amount ${newAmountPaise} exceeds refundable ${maxRefundable}.`);
  }
  return maxRefundable;
}

/* ------------------------------------------------------------------ */
/* Ledger posting for refunds                                         */
/* ------------------------------------------------------------------ */

/**
 * Post a balanced reversal ledger for a refund.
 *
 * @param {object} supabaseClient - Supabase client
 * @param {object} order - order row
 * @param {string} actorId - user ID initiating the refund
 * @param {number} refundAmountPaise - refund amount in paise
 * @param {string} refundId - refund UUID (for idempotency key)
 * @returns {Promise<void>}
 */
export async function postRefundReversalLedger(supabaseClient, order, actorId, refundAmountPaise, refundId) {
  await postRefundLedger(supabaseClient, order, actorId, refundAmountPaise);
  logger.info({ orderId: order.id, refundId, amountPaise: refundAmountPaise }, 'refund_ledger_posted');
}
