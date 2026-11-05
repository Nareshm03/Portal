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

import { calculateOrderBreakdown } from '../src/services/money.js';

test('order breakdown applies fee and deposit to product cost only, excluding duty', () => {
  const result = calculateOrderBreakdown({ productCostPaise: 100_000, dutyPaise: 12_000, travellerRewardPaise: 8_000, platformFeeBps: 500, depositBps: 2500 });
  assert.deepEqual(result, {
    productCostPaise: 100_000, dutyPaise: 12_000, travellerRewardPaise: 8_000,
    platformFeeBps: 500, platformFeePaise: 5_000, depositBps: 2500, depositPaise: 25_000,
    subtotalPaise: 120_000, totalPaise: 125_000, upfrontPaise: 42_000, balancePaise: 83_000, currency: 'INR'
  });
});

test('changing the duty does not change the fee or deposit', () => {
  const lowDuty = calculateOrderBreakdown({ productCostPaise: 100_000, dutyPaise: 0, travellerRewardPaise: 0, platformFeeBps: 500, depositBps: 2500 });
  const highDuty = calculateOrderBreakdown({ productCostPaise: 100_000, dutyPaise: 50_000, travellerRewardPaise: 0, platformFeeBps: 500, depositBps: 2500 });
  assert.equal(lowDuty.platformFeePaise, 5_000);
  assert.equal(highDuty.platformFeePaise, 5_000);
  assert.equal(lowDuty.depositPaise, 25_000);
  assert.equal(highDuty.depositPaise, 25_000);
  // upfront grows with duty; total minus upfront equals the remaining balance.
  assert.equal(highDuty.upfrontPaise, 25_000 + 50_000 + 5_000);
  assert.equal(highDuty.balancePaise, highDuty.totalPaise - highDuty.upfrontPaise);
});
