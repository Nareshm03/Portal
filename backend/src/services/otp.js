import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

export function generateOtp() {
  return String(randomInt(100000, 1000000));
}

export function hashOtp({ orderId, userId, code, pepper = env.OTP_PEPPER }) {
  return createHmac('sha256', pepper).update(`${orderId}:${userId}:${code}`).digest('hex');
}

export function verifyOtp({ orderId, userId, code, expectedHash, pepper = env.OTP_PEPPER }) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code) || typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashOtp({ orderId, userId, code, pepper }), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
