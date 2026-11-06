import { HttpError } from '../utils/httpError.js';
import { assertSafeMinorUnits } from './money.js';

/**
 * Ledger writes must be performed inside a PostgreSQL transaction/RPC.
 * This module validates the balanced journal before it is submitted.
 */
export function validateJournal(entries) {
  if (!Array.isArray(entries) || entries.length < 2) throw new HttpError(400, 'INVALID_JOURNAL', 'A journal requires at least two entries.');
  let debits = 0n;
  let credits = 0n;
  for (const entry of entries) {
    assertSafeMinorUnits(entry.amountPaise, 'entry.amountPaise');
    if (entry.amountPaise <= 0 || !['DEBIT', 'CREDIT'].includes(entry.direction) || !entry.accountCode) {
      throw new HttpError(400, 'INVALID_JOURNAL_ENTRY', 'Each journal entry requires an account, direction and positive amount.');
    }
    if (entry.direction === 'DEBIT') debits += BigInt(entry.amountPaise);
    else credits += BigInt(entry.amountPaise);
  }
  if (debits !== credits) throw new HttpError(409, 'UNBALANCED_JOURNAL', 'Debits and credits must balance exactly.');
  return { debits: Number(debits), credits: Number(credits), entries: entries.length };
}
