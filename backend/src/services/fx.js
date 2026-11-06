import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const CURRENCY_EXPONENTS = Object.freeze({ BHD: 3, JOD: 3, KWD: 3, OMR: 3, TND: 3, CLP: 0, JPY: 0, KRW: 0, INR: 2, USD: 2, EUR: 2, GBP: 2, SGD: 2, AED: 2, CAD: 2, AUD: 2, CHF: 2 });
const RATE_SCALE = 1_000_000n;
const pow10 = (n) => 10n ** BigInt(n);

// fawazahmed0 Exchange API endpoints (free, no API key, CC0 1.0).
// Primary: jsDelivr CDN. Fallback: Cloudflare Pages (recommended by the project).
const FAWAZAHAMED0_PRIMARY = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json';
const FAWAZAHAMED0_FALLBACK = 'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json';
const FETCH_TIMEOUT_MS = 10_000;
// The API updates daily. Cache for 24 hours to avoid redundant fetches.
const FETCH_CACHE_TTL_SECONDS = 24 * 60 * 60;

// Module-level cache for fetched FX rates (single-server process).
const fxCache = new Map();

function parseRateMicros(rate) {
  // Accept up to 8 decimal places from external providers; store at 6-decimal
  // micros precision (RATE_SCALE = 1_000_000).
  if (typeof rate !== 'string' || !/^\d{1,6}(\.\d{1,8})?$/.test(rate)) {
    throw new HttpError(400, 'INVALID_FX_RATE', 'FX rate must be a positive decimal string with up to 8 decimal places.');
  }
  const [whole, fraction = ''] = rate.split('.');
  // Truncate to 6 decimal places for micros storage precision.
  const microsFraction = (fraction + '000000').slice(0, 6);
  const micros = BigInt(whole) * RATE_SCALE + BigInt(microsFraction);
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

/** Fetch JSON from a URL with a hard timeout. */
async function fetchJsonWithTimeout(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new HttpError(502, 'FX_PROVIDER_ERROR', `FX provider returned ${response.status}`);
    const text = await response.text();
    return JSON.parse(text);
  } catch (err) {
    if (err.name === 'AbortError') throw new HttpError(504, 'FX_PROVIDER_TIMEOUT', 'FX provider request timed out.');
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch a live FX rate from the fawazahmed0 Exchange API.
 * Tries the primary endpoint, then the Cloudflare fallback.
 * Caches the result for FETCH_CACHE_TTL_SECONDS.
 * The API response shape is: { usd: { inr: "83.5", date: "2026-11-05" } }
 * Rate is INR per 1 unit of the base currency.
 */
export async function fetchFxRate(fromCurrency = 'USD', toCurrency = 'INR') {
  const from = String(fromCurrency).toUpperCase();
  const to = String(toCurrency).toUpperCase();

  if (from === to) return { rate: '1.000000', source: 'IDENTITY', rateTimestamp: new Date().toISOString() };
  if (to !== 'INR') throw new HttpError(400, 'UNSUPPORTED_FX_PAIR', 'Only INR destination quotes are supported.');

  // Check cache first.
  const cacheKey = `${from}/${to}`;
  const now = Date.now();
  const cached = fxCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < FETCH_CACHE_TTL_SECONDS * 1000) {
    return { ...cached.data };
  }

  let lastError;
  for (const url of [FAWAZAHAMED0_PRIMARY, FAWAZAHAMED0_FALLBACK]) {
    try {
      const data = await fetchJsonWithTimeout(url);
      const base = data[from.toLowerCase()];
      if (!base || typeof base[to.toLowerCase()] === 'undefined') {
        throw new HttpError(502, 'FX_PROVIDER_ERROR', `FX provider missing rate for ${from}/${to}.`);
      }
      const rate = String(base[to.toLowerCase()]);
      parseRateMicros(rate); // validates format — rejects stale/malformed rates

      const rateDate = base.date ?? new Date().toISOString().split('T')[0];
      const result = {
        rate,
        source: 'FAWAZAHAMED0',
        rateTimestamp: new Date(rateDate).toISOString(),
      };

      fxCache.set(cacheKey, { data: result, fetchedAt: now });
      return result;
    } catch (err) {
      // Wrap raw errors (network, timeout, parse) into HttpError so callers
      // can rely on a consistent error shape.
      if (!(err instanceof HttpError)) {
        err = new HttpError(502, 'FX_PROVIDER_ERROR', `FX provider request failed: ${err.message}`);
      }
      lastError = err;
      // Try the next endpoint.
    }
  }

  throw lastError ?? new HttpError(502, 'FX_PROVIDER_ERROR', 'All FX provider endpoints failed.');
}

/**
 * Get the FX rate for a currency pair.
 * When env.FX_PROVIDER === 'fawazahmed0', tries live fetch first, then falls back
 * to the static FX_RATE_TABLE_JSON config. Otherwise uses static config only.
 * The returned rate and rateTimestamp should be stored in the quote/order
 * financial snapshot and never recalculated after acceptance.
 */
export async function getConfiguredRate(fromCurrency, toCurrency = 'INR') {
  const from = String(fromCurrency).toUpperCase();
  const to = String(toCurrency).toUpperCase();
  if (from === to) return { rate: '1.000000', source: 'IDENTITY', rateTimestamp: new Date().toISOString() };
  if (to !== 'INR') throw new HttpError(400, 'UNSUPPORTED_FX_PAIR', 'Only INR destination quotes are supported.');

  // When configured, try the live provider first.
  if (env.FX_PROVIDER === 'fawazahmed0') {
    try {
      return await fetchFxRate(from, to);
    } catch {
      // Fall through to static config below.
    }
  }

  const rate = env.fxRateTable?.[from]?.[to];
  if (!rate) throw new HttpError(503, 'FX_RATE_UNAVAILABLE', `No configured FX rate for ${from}/${to}.`);
  return { rate, source: env.FX_RATE_SOURCE, rateTimestamp: new Date().toISOString() };
}
