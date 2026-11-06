import test from 'node:test';
import assert from 'node:assert/strict';
import { convertMinorUnits } from '../src/services/fx.js';

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
