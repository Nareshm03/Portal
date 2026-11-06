import { Router } from 'express';
import { createHash } from 'node:crypto';
import { getSupabase } from '../config/supabase.js';
import { verifyWebhookSignature } from '../services/razorpay.js';
import { logger } from '../config/logger.js';

export const webhookRouter = Router();

webhookRouter.post('/razorpay', async (req, res, next) => {
  try {
    const signature = req.get('x-razorpay-signature');
    if (!verifyWebhookSignature(req.body, signature)) return res.status(401).json({ error: { code: 'INVALID_WEBHOOK_SIGNATURE', message: 'Webhook signature verification failed.' } });

    const payload = JSON.parse(req.body.toString('utf8'));
    const providerEventId = req.get('x-razorpay-event-id');
    if (!providerEventId || providerEventId.length > 160) return res.status(400).json({ error: { code: 'EVENT_ID_REQUIRED', message: 'A valid webhook event ID is required.' } });

    const eventType = String(payload.event ?? 'unknown');
    const payloadHash = createHash('sha256').update(req.body).digest('hex');
    const supabase = getSupabase();
    const { error: insertError } = await supabase.from('webhook_events').insert({
      provider: 'RAZORPAY', provider_event_id: providerEventId, event_type: eventType, payload_hash: payloadHash
    });
    if (insertError?.code === '23505') {
      const { data: previous, error: lookupError } = await supabase.from('webhook_events').select('processed_at,payload_hash').eq('provider', 'RAZORPAY').eq('provider_event_id', providerEventId).single();
      if (lookupError) throw lookupError;
      if (previous.payload_hash !== payloadHash) return res.status(409).json({ error: { code: 'WEBHOOK_EVENT_MISMATCH', message: 'Event ID was reused with a different payload.' } });
      if (previous.processed_at) return res.status(200).json({ received: true, duplicate: true });
      // An earlier attempt failed mid-processing. Continue from the persisted, verified event.
    } else if (insertError) throw insertError;

    if (eventType === 'payment.captured') {
      const payment = payload.payload?.payment?.entity;
      if (payment?.order_id && payment?.id && payment?.amount && payment?.currency === 'INR') {
        const { data: intent, error: lookupError } = await supabase.from('payment_intents')
          .select('id, order_id, buyer_id, amount_paise, status')
          .eq('provider_order_id', payment.order_id).eq('provider', 'RAZORPAY').maybeSingle();
        if (lookupError) throw lookupError;
        if (intent && Number(payment.amount) === Number(intent.amount_paise) && payment.status === 'captured') {
          const { error: updateError } = await supabase.from('payment_intents').update({
            provider_payment_id: payment.id, status: 'CAPTURED', raw_provider_reference: { webhookEventId: providerEventId, paymentId: payment.id }
          }).eq('id', intent.id).neq('status', 'CAPTURED');
          if (updateError) throw updateError;
          const { error: transitionError } = await supabase.rpc('transition_order', {
            p_order_id: intent.order_id, p_to_state: 'LOCKED', p_actor_id: intent.buyer_id, p_note: 'Payment captured via verified Razorpay webhook.'
          });
          if (transitionError && !String(transitionError.message).includes('invalid transition')) throw transitionError;
        }
      }
    }

    await supabase.from('webhook_events').update({ processed_at: new Date().toISOString() })
      .eq('provider', 'RAZORPAY').eq('provider_event_id', providerEventId);
    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error({ err: error }, 'razorpay_webhook_processing_failed');
    next(error);
  }
});
