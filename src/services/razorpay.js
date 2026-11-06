import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

let razorpay;
function getClient() {
  if (!env.PAYMENTS_ENABLED || env.MOCK_PAYMENTS) throw new HttpError(503, 'REAL_PAYMENTS_DISABLED', 'Real payments are disabled for this build.');
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw new HttpError(503, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'Razorpay credentials are not configured.');
  if (!razorpay) razorpay = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return razorpay;
}

export async function createRazorpayOrder({ amountPaise, receipt, notes }) {
  return getClient().orders.create({ amount: amountPaise, currency: 'INR', receipt, notes });
}

export function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  if (!env.RAZORPAY_KEY_SECRET || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest();
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyWebhookSignature(rawBody, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest();
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function fetchRazorpayPayment(paymentId) {
  return getClient().payments.fetch(paymentId);
}
