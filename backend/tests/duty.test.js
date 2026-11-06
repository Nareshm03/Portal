import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRequest, assertRequestMatchable } from '../src/services/duty.js';

test('third-party passenger-baggage goods are always sent to human review', () => {
  const result = evaluateRequest({ productCategory: 'electronics', isForThirdParty: true, fulfilmentMode: 'PASSENGER_BAGGAGE', hsCode: '85171300' });
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.canMatch, false);
  assert.throws(() => assertRequestMatchable({ compliance_status: result.status }), { code: 'COMPLIANCE_REVIEW_REQUIRED' });
});

test('blocked safety categories are rejected', () => {
  const result = evaluateRequest({ productCategory: 'firearms', isForThirdParty: true });
  assert.equal(result.status, 'REJECTED');
});
