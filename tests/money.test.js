import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBreakdown, roundBasisPoints } from '../src/services/money.js';

test('calculates fee/deposit using integer paise', () => {
  const result = calculateBreakdown(100_000, 500, 2500);
  assert.deepEqual(result, {
    subtotalPaise: 100_000,
    platformFeeBps: 500,
    platformFeePaise: 5_000,
    totalPaise: 105_000,
    depositBps: 2500,
    depositPaise: 26_250,
    balancePaise: 78_750,
    currency: 'INR'
  });
});

test('rounds basis points deterministically', () => {
  assert.equal(roundBasisPoints(1, 5000), 1);
  assert.equal(roundBasisPoints(1, 4999), 0);
});

test('keeps the deposit positive for very small valid orders', () => {
  const result = calculateBreakdown(1, 500, 2500);
  assert.equal(result.depositPaise, 1);
});
