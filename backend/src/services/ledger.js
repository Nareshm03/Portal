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


/**
 * Post a balanced, idempotent ledger transaction through the SECURITY DEFINER
 * RPC. The RPC re-validates balance and idempotency server-side; we validate
 * first for a fast, clear client error and then delegate the authoritative write.
 */
export async function postLedger(supabaseClient, { orderId, eventType, idempotencyKey, actorId, metadata = {}, entries }) {
  validateJournal(entries);
  const { error } = await supabaseClient.rpc('post_ledger_transaction', {
    p_order_id: orderId,
    p_event_type: eventType,
    p_idempotency_key: idempotencyKey,
    p_actor_id: actorId,
    p_metadata: metadata,
    p_entries: entries.map((entry) => ({ accountCode: entry.accountCode, direction: entry.direction, amountPaise: entry.amountPaise }))
  });
  if (error) throw new HttpError(409, 'LEDGER_POST_FAILED', 'The ledger entry could not be recorded.', { cause: error.message });
}

/**
 * Collection journal posted when the upfront payment is captured and the order
 * locks. The captured amount moves from the payment clearing account into the
 * escrow hold held against the order.
 */
export async function postCollectionLedger(supabaseClient, order, actorId) {
  const upfrontPaise = Number(order.upfront_paise);
  if (!Number.isSafeInteger(upfrontPaise) || upfrontPaise <= 0) return;
  await postLedger(supabaseClient, {
    orderId: order.id,
    eventType: 'PAYMENT_CAPTURED',
    idempotencyKey: `order:lock:${order.id}`,
    actorId,
    metadata: { provider: order.provider ?? 'MOCK', description: 'Upfront collection captured on order lock' },
    entries: [
      { accountCode: 'PAYMENT_CLEARING', direction: 'DEBIT', amountPaise: upfrontPaise },
      { accountCode: 'ESCROW_HOLD', direction: 'CREDIT', amountPaise: upfrontPaise }
    ]
  });
}

/**
 * Settlement journal posted on handover completion. Releases the held funds:
 * the traveller is credited their purchase reimbursement plus reward, duty is
 * owed to customs, the platform retains its fee, and the buyer's remaining
 * balance is settled. Zero-amount legs are omitted because the RPC rejects
 * zero-value entries while still requiring a balanced, >=2-entry journal.
 */
export async function postSettlementLedger(supabaseClient, order, actorId) {
  const upfrontPaise = Number(order.upfront_paise);
  const balancePaise = Number(order.balance_paise);
  const dutyPaise = Number(order.duty_paise);
  const rewardPaise = Number(order.traveller_reward_paise);
  const feePaise = Number(order.platform_fee_paise);
  const productCostPaise = Number(order.subtotal_paise) - dutyPaise - rewardPaise;
  const travellerPayable = productCostPaise + rewardPaise;
  const entries = [
    { accountCode: 'ESCROW_HOLD', direction: 'DEBIT', amountPaise: upfrontPaise },
    { accountCode: 'TRAVELLER_PAYABLE', direction: 'CREDIT', amountPaise: travellerPayable }
  ];
  if (Number.isSafeInteger(balancePaise) && balancePaise > 0) entries.push({ accountCode: 'BUYER_RECEIVABLE', direction: 'DEBIT', amountPaise: balancePaise });
  if (Number.isSafeInteger(dutyPaise) && dutyPaise > 0) entries.push({ accountCode: 'DUTY_PAYABLE', direction: 'CREDIT', amountPaise: dutyPaise });
  if (Number.isSafeInteger(feePaise) && feePaise > 0) entries.push({ accountCode: 'PLATFORM_REVENUE', direction: 'CREDIT', amountPaise: feePaise });
  await postLedger(supabaseClient, {
    orderId: order.id,
    eventType: 'ORDER_SETTLED',
    idempotencyKey: `order:complete:${order.id}`,
    actorId,
    metadata: { description: 'Funds released on handover completion' },
    entries
  });
}

/**
 * Refund reversal journal posted when a captured payment is refunded.
 * Reverses the PAYMENT_CAPTURED collection: debits ESCROW_HOLD (releasing
 * the held funds) and credits PAYMENT_CLEARING (returning funds to the buyer).
 * Zero-amount refunds are rejected because the RPC requires a balanced,
 * >=2-entry journal.
 */
export async function postRefundLedger(supabaseClient, order, actorId, refundAmountPaise) {
  const upfrontPaise = Number(order.upfront_paise);
  const refundPaise = Number(refundAmountPaise);
  if (!Number.isSafeInteger(refundPaise) || refundPaise <= 0) throw new HttpError(400, 'INVALID_REFUND_AMOUNT', 'Refund amount must be a positive integer.');
  if (refundPaise > upfrontPaise) throw new HttpError(409, 'REFUND_EXCEEDS_CAPTURED', `Refund amount ${refundPaise} exceeds captured upfront ${upfrontPaise}.`);
  await postLedger(supabaseClient, {
    orderId: order.id,
    eventType: 'PAYMENT_REFUNDED',
    idempotencyKey: `order:refund:${order.id}`,
    actorId,
    metadata: { provider: order.provider ?? 'MOCK', description: 'Payment refund reversed on order cancellation', refundAmountPaise: refundPaise },
    entries: [
      { accountCode: 'ESCROW_HOLD', direction: 'DEBIT', amountPaise: refundPaise },
      { accountCode: 'PAYMENT_CLEARING', direction: 'CREDIT', amountPaise: refundPaise }
    ]
  });
}
