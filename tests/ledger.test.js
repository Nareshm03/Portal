import test from 'node:test';
import assert from 'node:assert/strict';
import { validateJournal } from '../src/services/ledger.js';

test('accepts balanced journal entries', () => {
  assert.equal(validateJournal([
    { accountCode: 'PAYMENT_CLEARING', direction: 'DEBIT', amountPaise: 10_000 },
    { accountCode: 'BUYER_FUNDS', direction: 'CREDIT', amountPaise: 10_000 }
  ]).debits, 10_000);
});

test('rejects unbalanced journal entries', () => {
  assert.throws(() => validateJournal([
    { accountCode: 'PAYMENT_CLEARING', direction: 'DEBIT', amountPaise: 10_000 },
    { accountCode: 'BUYER_FUNDS', direction: 'CREDIT', amountPaise: 9_999 }
  ]), { code: 'UNBALANCED_JOURNAL' });
});
