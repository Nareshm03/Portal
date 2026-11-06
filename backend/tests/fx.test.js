import test from 'node:test';
import assert from 'node:assert/strict';
import { convertMinorUnits, fetchFxRate, getConfiguredRate } from '../src/services/fx.js';

test('converts USD cents into INR paise using integer rate math', () => {
  const result = convertMinorUnits({ amountMinor: 10_000, fromCurrency: 'USD', toCurrency: 'INR', rate: '83.500000', source: 'TEST' });
  assert.equal(result.amountMinor, 835_000);
  assert.equal(result.currency, 'INR');
  assert.equal(result.source, 'TEST');
});

test('supports zero- and three-decimal currencies', () => {
  const jpy = convertMinorUnits({ amountMinor: 1000, fromCurrency: 'JPY', toCurrency: 'INR', rate: '0.560000' });
  assert.equal(jpy.amountMinor, 56_000);
  const kwd = convertMinorUnits({ amountMinor: 1000, fromCurrency: 'KWD', toCurrency: 'INR', rate: '270.000000' });
  assert.equal(kwd.amountMinor, 27_000);
});

test('rejects unsupported pairs and floating money input', () => {
  assert.throws(() => convertMinorUnits({ amountMinor: 99.99, fromCurrency: 'USD', rate: '83.5' }), { code: 'INVALID_MONEY' });
  assert.throws(() => convertMinorUnits({ amountMinor: 100, fromCurrency: 'USD', toCurrency: 'EUR', rate: '83.5' }), { code: 'UNSUPPORTED_FX_PAIR' });
});

/* ------------------------------------------------------------------ */
/* Section 2: fawazahmed0 Exchange API fetch                          */
/* ------------------------------------------------------------------ */

function mockFetch(data, status = 200) {
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data),
  });
}

function mockFetchThrow() {
  globalThis.fetch = async () => {
    throw new TypeError('Network error');
  };
}

test('fetchFxRate: successful fetch from primary endpoint', async (t) => {
  mockFetch({ usd: { inr: '83.500000', date: '2026-11-05' } });
  const result = await fetchFxRate('USD', 'INR');
  assert.equal(result.rate, '83.500000');
  assert.equal(result.source, 'FAWAZAHAMED0');
  assert.equal(result.rateTimestamp, '2026-11-05T00:00:00.000Z');
});

test('fetchFxRate: falls back to Cloudflare when primary fails', async (t) => {
  let callCount = 0;
  globalThis.fetch = async (url) => {
    callCount++;
    if (url.includes('jsdelivr')) throw new TypeError('Primary down');
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ eur: { inr: '90.600000', date: '2026-11-05' } }),
    };
  };
  const result = await fetchFxRate('EUR', 'INR');
  assert.equal(result.rate, '90.600000');
  assert.equal(callCount, 2, 'Primary then fallback should be attempted');
});

test('fetchFxRate: both endpoints fail throws', async (t) => {
  mockFetchThrow();
  await assert.rejects(
    () => fetchFxRate('GBP', 'INR'),
    { code: 'FX_PROVIDER_ERROR' }
  );
});

test('fetchFxRate: invalid rate from provider throws', async (t) => {
  mockFetch({ aud: { inr: 'not-a-number', date: '2026-11-05' } });
  await assert.rejects(
    () => fetchFxRate('AUD', 'INR'),
    { code: 'INVALID_FX_RATE' }
  );
});

test('fetchFxRate: missing rate from provider throws', async (t) => {
  mockFetch({ sgd: {} });
  await assert.rejects(
    () => fetchFxRate('SGD', 'INR'),
    { code: 'FX_PROVIDER_ERROR' }
  );
});

test('fetchFxRate: identity pair returns without fetch', async (t) => {
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; return { ok: true, status: 200, text: async () => '{}' }; };
  const result = await fetchFxRate('INR', 'INR');
  assert.equal(result.rate, '1.000000');
  assert.equal(result.source, 'IDENTITY');
  assert.equal(fetched, false, 'Should not fetch for identity pair');
});

test('fetchFxRate: unsupported target currency throws', async (t) => {
  await assert.rejects(
    () => fetchFxRate('USD', 'EUR'),
    { code: 'UNSUPPORTED_FX_PAIR' }
  );
});

test('fetchFxRate: caches result for subsequent calls', async (t) => {
  let callCount = 0;
  globalThis.fetch = async (url) => {
    callCount++;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ cad: { inr: '62.000000', date: '2026-11-05' } }),
    };
  };
  const r1 = await fetchFxRate('CAD', 'INR');
  const r2 = await fetchFxRate('CAD', 'INR');
  assert.equal(r1.rate, '62.000000');
  assert.equal(r2.rate, '62.000000');
  assert.equal(callCount, 1, 'Second call should use cache, not fetch again');
});

test('getConfiguredRate: default provider (fawazahmed0) fetches live rate', async (t) => {
  // FX_PROVIDER defaults to 'fawazahmed0' in .env, so getConfiguredRate fetches live.
  const result = await getConfiguredRate('USD', 'INR');
  const rateNum = Number(result.rate);
  assert.ok(!isNaN(rateNum) && rateNum > 0, 'Rate should be a valid positive number');
  assert.equal(result.source, 'FAWAZAHAMED0');
  assert.ok(result.rateTimestamp, 'Should have a rate timestamp');
});
