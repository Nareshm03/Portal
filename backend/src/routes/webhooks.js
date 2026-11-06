import { Router } from 'express';
import { createHash } from 'node:crypto';
import { getSupabase } from '../config/supabase.js';
import { verifyWebhookSignature } from '../services/razorpay.js';
import { postCollectionLedger, postRefundLedger } from '../services/ledger.js';
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
          .eq('provider_order_id', payment.order_id)
          .in('provider', ['RAZORPAY', 'RAZORPAY_TEST'])
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (intent && Number(payment.amount) === Number(intent.amount_paise) && payment.status === 'captured') {
          const { error: updateError } = await supabase.from('payment_intents').update({
            provider_payment_id: payment.id, status: 'CAPTURED', raw_provider_reference: { webhookEventId: providerEventId, paymentId: payment.id }
          }).eq('id', intent.id).neq('status', 'CAPTURED');
          if (updateError) throw updateError;
          const { data: lockedOrder, error: transitionError } = await supabase.rpc('transition_order', {
            p_order_id: intent.order_id, p_to_state: 'LOCKED', p_actor_id: intent.buyer_id, p_note: 'Payment captured via verified Razorpay webhook.'
          });
          if (transitionError && !String(transitionError.message).includes('invalid transition')) throw transitionError;
          if (lockedOrder) await postCollectionLedger(supabase, lockedOrder, intent.buyer_id).catch((e) => logger.error({ err: e, orderId: intent.order_id }, 'webhook_collection_ledger_failed'));
        }
      }
    }

    if (eventType === 'refund.processed') {
      const refund = payload.payload?.refund?.entity;
      if (refund?.id && refund?.amount && refund?.currency === 'INR') {
        // Find the refund record by provider_refund_id
        const { data: refundRecord, error: lookupError } = await supabase.from('refunds')
          .select('*').eq('provider_refund_id', refund.id).maybeSingle();
        if (lookupError) throw lookupError;
        if (refundRecord && refundRecord.status !== 'COMPLETED') {
          const refundAmountPaise = Number(refund.amount);
          const recordAmountPaise = Number(refundRecord.amount_paise ?? 0);
          if (refundAmountPaise === recordAmountPaise) {
            const { error: updateError } = await supabase.from('refunds').update({
              status: 'COMPLETED',
              updated_at: new Date().toISOString(),
            }).eq('id', refundRecord.id);
            if (updateError) throw updateError;

            // Post reversal ledger if not already posted.
            const { data: order, error: orderLookupError } = await supabase.from('orders')
              .select('id, state, buyer_id, upfront_paise, provider').eq('id', refundRecord.order_id).single();
            if (orderLookupError) throw orderLookupError;
            if (order) {
              // Check if reversal ledger already posted for this refund
              const { data: existingLedger, error: ledgerError } = await supabase.from('ledger_transactions')
                .select('id').eq('order_id', order.id).eq('event_type', 'PAYMENT_REFUNDED').maybeSingle();
              if (ledgerError) throw ledgerError;
              if (!existingLedger) {
                await postRefundLedger(supabase, order, refundRecord.buyer_id, refundAmountPaise);
              }

              // Transition order to REFUNDED if not already.
              if (order.state !== 'REFUNDED' && order.state !== 'COMPLETED') {
                const { error: transitionError } = await supabase.rpc('transition_order', {
                  p_order_id: refundRecord.order_id,
                  p_to_state: 'REFUNDED',
                  p_actor_id: refundRecord.buyer_id,
                  p_note: 'Refund processed via Razorpay webhook.',
                });
                if (transitionError && !String(transitionError.message).includes('invalid transition')) throw transitionError;
              }
            }
          }
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
