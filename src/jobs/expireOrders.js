import { getSupabase } from '../config/supabase.js';
import { logger } from '../config/logger.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Run from a scheduler (for example Render Cron) every 1–5 minutes. */
export async function expireOrders(now = new Date()) {
  const db = getSupabase();
  const nowIso = now.toISOString();
  const { data: unpaidOrders, error: unpaidError } = await db.from('orders')
    .select('id,buyer_id').eq('state', 'ACCEPTED').lte('payment_deadline', nowIso).limit(100);
  if (unpaidError) throw unpaidError;
  let expired = 0;
  for (const order of unpaidOrders ?? []) {
    const { data: intents, error: intentError } = await db.from('payment_intents')
      .select('id,provider,status').eq('order_id', order.id);
    if (intentError) throw intentError;
    if ((intents ?? []).some((intent) => intent.status === 'CAPTURED')) continue;

    // Mock intents can be safely closed after the deadline. A real provider intent
    // must be reconciled/cancelled before expiry; never expire against an in-flight charge.
    const unresolvedRealIntent = (intents ?? []).some((intent) =>
      intent.provider !== 'MOCK' && ['CREATING', 'CREATED', 'AUTHORIZED'].includes(intent.status)
    );
    if (unresolvedRealIntent) {
      logger.warn({ orderId: order.id }, 'order_expiry_waiting_for_payment_reconciliation');
      continue;
    }

    if ((intents ?? []).some((intent) => intent.provider === 'MOCK' && ['CREATING', 'CREATED', 'AUTHORIZED'].includes(intent.status))) {
      const { error: closeError } = await db.from('payment_intents').update({ status: 'FAILED' })
        .eq('order_id', order.id).eq('provider', 'MOCK').in('status', ['CREATING', 'CREATED', 'AUTHORIZED']);
      if (closeError) throw closeError;
    }
    const { error } = await db.rpc('transition_order', { p_order_id: order.id, p_to_state: 'EXPIRED', p_actor_id: order.buyer_id, p_note: 'Initial payment window elapsed; no unresolved provider payment remains.' });
    if (!error) expired++;
    else logger.warn({ orderId: order.id, code: error.code }, 'order_expiry_transition_skipped');
  }

  const { data: landedOrders, error: landedError } = await db.from('orders')
    .select('id,buyer_id').eq('state', 'LANDED').lte('forfeit_at', nowIso).limit(100);
  if (landedError) throw landedError;
  let forfeited = 0;
  for (const order of landedOrders ?? []) {
    const { error } = await db.rpc('transition_order', { p_order_id: order.id, p_to_state: 'FORFEITED', p_actor_id: order.buyer_id, p_note: '72-hour buyer handover window elapsed; policy requires review of the forfeiture.' });
    if (!error) forfeited++;
    else logger.warn({ orderId: order.id, code: error.code }, 'order_forfeit_transition_skipped');
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
