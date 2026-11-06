import { HttpError } from '../utils/httpError.js';

export function assertSafeMinorUnits(value, field = 'amount') {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new HttpError(400, 'INVALID_MONEY', `${field} must be a non-negative safe integer in minor units.`);
  }
  return value;
}

export function roundBasisPoints(amountMinor, basisPoints) {
  assertSafeMinorUnits(amountMinor);
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) {
    throw new HttpError(400, 'INVALID_BASIS_POINTS', 'Basis points must be an integer from 0 to 10000.');
  }
  const numerator = BigInt(amountMinor) * BigInt(basisPoints);
  return Number((numerator + 5000n) / 10000n);
}

export function calculateBreakdown(subtotalPaise, platformFeeBps, depositBps) {
  assertSafeMinorUnits(subtotalPaise, 'subtotalPaise');
  const platformFeePaise = roundBasisPoints(subtotalPaise, platformFeeBps);
  const totalPaise = subtotalPaise + platformFeePaise;
  if (!Number.isSafeInteger(totalPaise)) throw new HttpError(400, 'AMOUNT_TOO_LARGE', 'Calculated total exceeds supported range.');
  const depositPaise = Math.max(1, roundBasisPoints(totalPaise, depositBps));
  return Object.freeze({ subtotalPaise, platformFeeBps, platformFeePaise, totalPaise, depositBps, depositPaise, balancePaise: totalPaise - depositPaise, currency: 'INR' });
}
