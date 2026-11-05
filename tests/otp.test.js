import test from 'node:test';
import assert from 'node:assert/strict';
import { hashOtp, verifyOtp } from '../src/services/otp.js';

test('OTP hash is scoped to order and recipient', () => {
  const hash = hashOtp({ orderId: 'order-1', userId: 'buyer-1', code: '123456', pepper: 't'.repeat(40) });
  assert.equal(verifyOtp({ orderId: 'order-1', userId: 'buyer-1', code: '123456', expectedHash: hash, pepper: 't'.repeat(40) }), true);
  assert.equal(verifyOtp({ orderId: 'order-1', userId: 'buyer-2', code: '123456', expectedHash: hash, pepper: 't'.repeat(40) }), false);
  assert.equal(verifyOtp({ orderId: 'order-1', userId: 'buyer-1', code: '123455', expectedHash: hash, pepper: 't'.repeat(40) }), false);
});
