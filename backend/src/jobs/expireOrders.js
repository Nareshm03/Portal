import { getSupabase } from '../config/supabase.js';
import { logger } from '../config/logger.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Run from a scheduler (for example Render Cron) every 1–5 minutes.
 *
 * `db` and `now` are injectable so the job can be unit-tested without a live
 * Supabase database. When called with no arguments it uses the configured
 * Supabase service-role client and the current UTC time.
 */
export async function expireOrders({ db = getSupabase(), now = new Date() } = {}) {
  const nowIso = now.toISOString();
  let expired = 0;
  let forfeited = 0;

  // --- Payment expiry: ACCEPTED orders past their server-generated deadline ---
  const { data: unpaidOrders, error: unpaidError } = await db.from('orders')
    .select('id, buyer_id').eq('state', 'ACCEPTED').lte('payment_deadline', nowIso).limit(100);
  if (unpaidError) throw unpaidError;

  for (const order of unpaidOrders ?? []) {
    try {
      const { data: intents, error: intentError } = await db.from('payment_intents')
        .select('id, provider, status').eq('order_id', order.id);
      if (intentError) {
        logger.warn({ orderId: order.id, code: intentError.code }, 'order_expiry_intent_lookup_failed');
        continue;
      }

      // A captured payment must never be auto-expired.
      if ((intents ?? []).some((intent) => intent.status === 'CAPTURED')) continue;

      // Unresolved real-provider payment intents must be skipped for reconciliation.
      const unresolvedRealIntent = (intents ?? []).some((intent) =>
        intent.provider !== 'MOCK' && ['CREATING', 'CREATED', 'AUTHORIZED'].includes(intent.status)
      );
      if (unresolvedRealIntent) {
        logger.warn({ orderId: order.id }, 'order_expiry_waiting_for_payment_reconciliation');
        continue;
      }

      // Mock unpaid orders can expire safely: close the mock intent, then transition.
      const hasMockIntent = (intents ?? []).some((intent) =>
        intent.provider === 'MOCK' && ['CREATING', 'CREATED', 'AUTHORIZED'].includes(intent.status)
      );
      if (hasMockIntent) {
        const { error: closeError } = await db.from('payment_intents')
          .update({ status: 'FAILED' })
          .eq('order_id', order.id).eq('provider', 'MOCK')
          .in('status', ['CREATING', 'CREATED', 'AUTHORIZED']);
        if (closeError) {
          logger.warn({ orderId: order.id, code: closeError.code }, 'order_expiry_close_intent_failed');
          continue;
        }
      }

      const { error } = await db.rpc('transition_order', {
        p_order_id: order.id,
        p_to_state: 'EXPIRED',
        p_actor_id: order.buyer_id,
        p_note: 'Initial payment window elapsed; no unresolved provider payment remains.'
      });
      if (!error) expired++;
      else logger.warn({ orderId: order.id, code: error.code }, 'order_expiry_transition_skipped');
    } catch (err) {
      logger.warn({ orderId: order.id, code: err.code }, 'order_expiry_order_failed');
    }
  }

  // --- Handover expiry: LANDED orders past their 72-hour forfeit deadline ---
  const { data: landedOrders, error: landedError } = await db.from('orders')
    .select('id, buyer_id').eq('state', 'LANDED').lte('forfeit_at', nowIso).limit(100);
  if (landedError) throw landedError;

  for (const order of landedOrders ?? []) {
    try {
      const { error } = await db.rpc('transition_order', {
        p_order_id: order.id,
        p_to_state: 'FORFEITED',
        p_actor_id: order.buyer_id,
        p_note: '72-hour buyer handover window elapsed; policy requires review of the forfeiture.'
      });
      if (!error) forfeited++;
      else logger.warn({ orderId: order.id, code: error.code }, 'order_forfeit_transition_skipped');
    } catch (err) {
      logger.warn({ orderId: order.id, code: err.code }, 'order_forfeit_order_failed');
    }
  }

  return { expired, forfeited };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  expireOrders().then((result) => {
    logger.info(result, 'expiry_job_complete');
    process.exit(0);
  }).catch((error) => {
    logger.error({ err: error }, 'expiry_job_failed');
    process.exit(1);
  });
}
