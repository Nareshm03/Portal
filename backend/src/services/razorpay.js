import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

let razorpay;
let testModeRazorpay;

function getClient() {
  // If MOCK_PAYMENTS is enabled, throw error - we should use mock payments instead
  if (env.MOCK_PAYMENTS) throw new HttpError(503, 'REAL_PAYMENTS_DISABLED', 'Real payments are disabled for this build. Use mock payments instead.');
  
  // If PAYMENTS_ENABLED is false, throw error
  if (!env.PAYMENTS_ENABLED) throw new HttpError(503, 'PAYMENTS_DISABLED', 'Payments are disabled.');
  
  // Check for required credentials
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw new HttpError(503, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'Razorpay credentials are not configured.');
  
  if (!razorpay) razorpay = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return razorpay;
}

function getTestModeClient() {
  // In test mode, we require test credentials
  if (!env.RAZORPAY_TEST_KEY_ID || !env.RAZORPAY_TEST_KEY_SECRET) {
    throw new HttpError(503, 'TEST_MODE_CREDENTIALS_REQUIRED', 'Razorpay test mode credentials are not configured.');
  }
  
  if (!testModeRazorpay) {
    testModeRazorpay = new Razorpay({ 
      key_id: env.RAZORPAY_TEST_KEY_ID, 
      key_secret: env.RAZORPAY_TEST_KEY_SECRET 
    });
  }
  return testModeRazorpay;
}

// Main client getter that determines which mode to use
export function getRazorpayClient(mode = 'auto') {
  // Determine which mode to use
  let useTestMode = false;
  
  if (mode === 'test') {
    useTestMode = true;
  } else if (mode === 'live') {
    useTestMode = false;
  } else if (mode === 'auto') {
    // Auto-detect based on environment and credentials
    useTestMode = env.NODE_ENV !== 'production' || env.RAZORPAY_USE_TEST_MODE === 'true';
  }
  
  if (useTestMode) {
    console.log('Using Razorpay test mode client');
    return getTestModeClient();
  } else {
    console.log('Using Razorpay live mode client');
    return getClient();
  }
}

export async function createRazorpayOrder({ amountPaise, receipt, notes, mode = 'auto' }) {
  const client = getRazorpayClient(mode);
  return client.orders.create({ amount: amountPaise, currency: 'INR', receipt, notes });
}

export function verifyCheckoutSignature({ orderId, paymentId, signature, mode = 'auto' }) {
  // Determine which secret to use based on mode
  let secret;
  if (mode === 'test') {
    secret = env.RAZORPAY_TEST_KEY_SECRET;
  } else if (mode === 'live') {
    secret = env.RAZORPAY_KEY_SECRET;
  } else {
    // Auto mode: try test secret first, then live
    secret = env.RAZORPAY_TEST_KEY_SECRET || env.RAZORPAY_KEY_SECRET;
  }
  
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyWebhookSignature(rawBody, signature, mode = 'auto') {
  // Determine which webhook secret to use based on mode
  let webhookSecret;
  if (mode === 'test') {
    webhookSecret = env.RAZORPAY_TEST_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET;
  } else if (mode === 'live') {
    webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
  } else {
    // Auto mode: try test webhook secret first, then live
    webhookSecret = env.RAZORPAY_TEST_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET;
  }
  
  if (!webhookSecret || !Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest();
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function fetchRazorpayPayment(paymentId, mode = 'auto') {
  const client = getRazorpayClient(mode);
  return client.payments.fetch(paymentId);
}

/**
 * Create a refund for a captured Razorpay payment.
 *
 * @param {object} options
 * @param {string} options.paymentId - Razorpay payment ID to refund
 * @param {number} options.amountPaise - refund amount in paise (full payment if omitted)
 * @param {string} options.receipt - merchant receipt ID
 * @param {object} options.notes - optional notes
 * @param {string} options.mode - 'test' | 'live' | 'auto'
 * @returns {Promise<object>} Razorpay refund object
 */
export async function createRazorpayRefund({ paymentId, amountPaise, receipt, notes, mode = 'auto' }) {
  const client = getRazorpayClient(mode);
  const payload = { ...(amountPaise ? { amount: amountPaise } : {}), ...(receipt ? { receipt } : {}), ...(notes ? { notes } : {}) };
  return client.payments.refund(paymentId, payload);
}

/**
 * Fetch a Razorpay refund by refund ID.
 *
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} refundId - Razorpay refund ID
 * @param {string} mode - 'test' | 'live' | 'auto'
 * @returns {Promise<object>} Razorpay refund object
 */
export async function fetchRazorpayRefund(paymentId, refundId, mode = 'auto') {
  const client = getRazorpayClient(mode);
  return client.payments.fetchRefund(paymentId, refundId);
}
