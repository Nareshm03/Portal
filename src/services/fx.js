import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const CURRENCY_EXPONENTS = Object.freeze({ BHD: 3, JOD: 3, KWD: 3, OMR: 3, TND: 3, CLP: 0, JPY: 0, KRW: 0, INR: 2, USD: 2, EUR: 2, GBP: 2, SGD: 2, AED: 2, CAD: 2, AUD: 2, CHF: 2 });
const RATE_SCALE = 1_000_000n;
const pow10 = (n) => 10n ** BigInt(n);

function parseRateMicros(rate) {
  if (typeof rate !== 'string' || !/^\d{1,6}(\.\d{1,6})?$/.test(rate)) {
    throw new HttpError(400, 'INVALID_FX_RATE', 'FX rate must be a positive decimal string with up to 6 decimal places.');
  }
  const [whole, fraction = ''] = rate.split('.');
  const micros = BigInt(whole) * RATE_SCALE + BigInt((fraction + '000000').slice(0, 6));
  if (micros <= 0n) throw new HttpError(400, 'INVALID_FX_RATE', 'FX rate must be greater than zero.');
  return micros;
}

export function convertMinorUnits({ amountMinor, fromCurrency, toCurrency = 'INR', rate, rateTimestamp = new Date().toISOString(), source = env.FX_RATE_SOURCE }) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new HttpError(400, 'INVALID_MONEY', 'amountMinor must be a non-negative safe integer.');
  const from = String(fromCurrency).toUpperCase();
  const to = String(toCurrency).toUpperCase();
  const fromExp = CURRENCY_EXPONENTS[from];
  const toExp = CURRENCY_EXPONENTS[to];
  if (fromExp === undefined || toExp === undefined) throw new HttpError(400, 'UNSUPPORTED_CURRENCY', 'Currency exponent is not configured.');
  if (from !== 'INR' && to !== 'INR') throw new HttpError(400, 'UNSUPPORTED_FX_PAIR', 'Only conversion to or from INR is supported by this MVP.');
  if (from === to) return { amountMinor, currency: to, rate: '1.000000', source: 'IDENTITY', rateTimestamp, rounded: false };
  const micros = parseRateMicros(rate);
  // rate means INR per one unit of foreign currency, always supplied for foreign -> INR.
  let numerator;
  let denominator;
  if (to === 'INR') {
    numerator = BigInt(amountMinor) * micros * pow10(toExp);
    denominator = RATE_SCALE * pow10(fromExp);
  } else {
    numerator = BigInt(amountMinor) * RATE_SCALE * pow10(toExp);
    denominator = micros * pow10(fromExp);
  }
  const rounded = (numerator + denominator / 2n) / denominator;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new HttpError(400, 'AMOUNT_TOO_LARGE', 'Converted amount exceeds supported range.');
  return { amountMinor: Number(rounded), currency: to, rate, source, rateTimestamp, rounded: numerator % denominator !== 0n };
}

export function getConfiguredRate(fromCurrency, toCurrency = 'INR') {
  const from = String(fromCurrency).toUpperCase();
  const to = String(toCurrency).toUpperCase();
  if (from === to) return { rate: '1.000000', source: 'IDENTITY', rateTimestamp: new Date().toISOString() };
  if (to !== 'INR') throw new HttpError(400, 'UNSUPPORTED_FX_PAIR', 'Only INR destination quotes are supported.');
  const rate = env.fxRateTable?.[from]?.[to];
  if (!rate) throw new HttpError(503, 'FX_RATE_UNAVAILABLE', `No configured FX rate for ${from}/${to}.`);
  return { rate, source: env.FX_RATE_SOURCE, rateTimestamp: new Date().toISOString() };
}
