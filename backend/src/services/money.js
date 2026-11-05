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


/**
 * Rule-accurate order breakdown for the Portal marketplace.
 *
 * Per the approved business rules the platform fee and the commitment deposit
 * are both computed on the product cost only (excluding duty), and the
 * traveller reward is a separate amount the traveller enters and that is frozen
 * on acceptance:
 *
 *   total    = product cost + duty + traveller reward + platform fee
 *   upfront  = commitment deposit + duty + platform fee   (collected at lock)
 *   balance  = total - upfront                            (settled at completion)
 *
 * All amounts are integer paise in INR. `calculateBreakdown` is retained for
 * the original unit tests; this function carries the full financial model.
 */
export function calculateOrderBreakdown({ productCostPaise, dutyPaise, travellerRewardPaise, platformFeeBps, depositBps }) {
  assertSafeMinorUnits(productCostPaise, 'productCostPaise');
  assertSafeMinorUnits(dutyPaise, 'dutyPaise');
  assertSafeMinorUnits(travellerRewardPaise, 'travellerRewardPaise');
  if (productCostPaise <= 0) throw new HttpError(400, 'INVALID_MONEY', 'productCostPaise must be a positive integer.');
  const platformFeePaise = roundBasisPoints(productCostPaise, platformFeeBps);
  const depositPaise = Math.max(1, roundBasisPoints(productCostPaise, depositBps));
  const subtotalPaise = productCostPaise + dutyPaise + travellerRewardPaise;
  const totalPaise = subtotalPaise + platformFeePaise;
  if (!Number.isSafeInteger(totalPaise)) throw new HttpError(400, 'AMOUNT_TOO_LARGE', 'Calculated total exceeds supported range.');
  const upfrontPaise = depositPaise + dutyPaise + platformFeePaise;
  const balancePaise = totalPaise - upfrontPaise;
  return Object.freeze({
    productCostPaise, dutyPaise, travellerRewardPaise,
    platformFeeBps, platformFeePaise, depositBps, depositPaise,
    subtotalPaise, totalPaise, upfrontPaise, balancePaise, currency: 'INR'
  });
}
