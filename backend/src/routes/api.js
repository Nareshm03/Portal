import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getSupabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';
import { evaluateRequest, assertRequestMatchable } from '../services/duty.js';
import { getConfiguredRate, convertMinorUnits } from '../services/fx.js';
import { calculateOrderBreakdown } from '../services/money.js';
import { assertTransition } from '../services/stateMachine.js';
import { createRazorpayOrder, verifyCheckoutSignature, fetchRazorpayPayment } from '../services/razorpay.js';
import { generateOtp, hashOtp, verifyOtp } from '../services/otp.js';
import { postCollectionLedger, postSettlementLedger } from '../services/ledger.js';
import { logger } from '../config/logger.js';

export const apiRouter = Router();
const supabase = () => getSupabase();
const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const airportCode = z.string().regex(/^[A-Z]{3}$/);
const countryCode = z.string().regex(/^[A-Z]{2}$/);

const requestSchema = z.object({
  originCountry: countryCode,
  originAirportCode: airportCode,
  destinationCountry: countryCode,
  destinationAirportCode: airportCode,
  neededBy: z.string().datetime(),
  productTitle: z.string().trim().min(2).max(180),
  productCategory: z.string().trim().min(2).max(80),
  productUrl: z.string().url().max(1000).refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), { message: 'productUrl must use HTTP or HTTPS.' }).optional(),
  quantity: z.number().int().min(1).max(100).default(1),
  declaredValueMinor: z.number().int().nonnegative().safe().optional(),
  declaredCurrency: currencyCode.optional(),
  hsCode: z.string().regex(/^[0-9]{6,10}$/).optional(),
  fulfilmentMode: z.enum(['PASSENGER_BAGGAGE', 'FORMAL_IMPORT', 'LICENSED_COURIER', 'OTHER']).default('PASSENGER_BAGGAGE'),
  isForThirdParty: z.boolean().default(true)
}).refine((v) => v.originAirportCode !== v.destinationAirportCode, { message: 'Origin and destination airports must differ.' })
  .refine((v) => new Date(v.neededBy) > new Date(), { message: 'neededBy must be in the future.' });

const tripSchema = z.object({
  originCountry: countryCode,
  originAirportCode: airportCode,
  destinationCountry: countryCode,
  destinationAirportCode: airportCode,
  departureAt: z.string().datetime(),
  arrivalAt: z.string().datetime(),
  capacityKg: z.number().min(0).max(100).default(0)
}).refine((v) => new Date(v.arrivalAt) > new Date(v.departureAt), { message: 'Arrival must be later than departure.' })
  .refine((v) => new Date(v.departureAt) > new Date(), { message: 'Departure must be in the future.' });

const quoteSchema = z.object({
  tripId: z.string().uuid(),
  itemPriceMinor: z.number().int().positive().safe(),
  itemCurrency: currencyCode,
  // A separate reward the traveller chooses for the haul; frozen verbatim on acceptance. No reward formula is inferred.
  travellerRewardPaise: z.number().int().nonnegative().safe(),
  // Duty cannot be user-guessed; this field is intentionally omitted from traveler input.
  note: z.string().max(500).optional()
});

apiRouter.get('/health', (_req, res) => res.json({ status: 'ok', service: 'portal-api', time: new Date().toISOString() }));
apiRouter.get('/config', (_req, res) => res.json({
  currency: 'INR', supportedQuoteCurrencies: ['INR', ...Object.entries(env.fxRateTable).filter(([, pairs]) => typeof pairs?.INR === 'string').map(([code]) => code).sort()],
  mockPayments: env.MOCK_PAYMENTS, realPaymentsEnabled: env.PAYMENTS_ENABLED && !env.MOCK_PAYMENTS,
  complianceApprovalRequired: true
}));


apiRouter.get('/fx/convert', requireAuth, async (req, res) => {
  const query = z.object({ amountMinor: z.coerce.number().int().nonnegative().safe(), from: currencyCode }).parse(req.query);
  const rate = getConfiguredRate(query.from, 'INR');
  const result = convertMinorUnits({ amountMinor: query.amountMinor, fromCurrency: query.from, toCurrency: 'INR', ...rate });
  res.json({ data: { ...result, amountMinorInput: query.amountMinor, fromCurrency: query.from, note: 'Indicative server-configured rate. Not a foreign-exchange transaction or remittance quote.' } });
});

apiRouter.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabase().from('profiles').select('id, full_name, role, account_status, kyc_status, created_at').eq('id', req.user.id).single();
  if (error) throw error;
  res.json({ data });
});

apiRouter.post('/requests', requireAuth, requireRole('buyer'), async (req, res) => {
  const body = requestSchema.parse(req.body);
  const legality = evaluateRequest({
    productCategory: body.productCategory,
    isForThirdParty: body.isForThirdParty,
    fulfilmentMode: body.fulfilmentMode,
    hsCode: body.hsCode
  });
  const status = legality.status === 'REJECTED' ? 'REJECTED' : 'PENDING_REVIEW';
  const { data, error } = await supabase().from('requests').insert({
    buyer_id: req.user.id,
    origin_country: body.originCountry,
    origin_airport_code: body.originAirportCode,
    destination_country: body.destinationCountry,
    destination_airport_code: body.destinationAirportCode,
    needed_by: body.neededBy,
    product_title: body.productTitle,
    product_category: body.productCategory,
    product_url: body.productUrl ?? null,
    quantity: body.quantity,
    declared_value_minor: body.declaredValueMinor ?? null,
    declared_currency: body.declaredCurrency ?? null,
    hs_code: body.hsCode ?? null,
    fulfilment_mode: body.fulfilmentMode,
    is_for_third_party: body.isForThirdParty,
    compliance_status: legality.status,
    compliance_reason: legality.reasons,
    status
  }).select('*').single();
  if (error) throw error;
  res.status(201).json({ data, compliance: { status: legality.status, canMatch: false, reasons: legality.reasons } });
});

apiRouter.get('/requests/mine', requireAuth, requireRole('buyer'), async (req, res) => {
  const { data, error } = await supabase().from('requests').select('*').eq('buyer_id', req.user.id).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  res.json({ data });
});

apiRouter.post('/trips', requireAuth, requireRole('traveller'), async (req, res) => {
  if (req.profile.kyc_status !== 'VERIFIED') throw new HttpError(403, 'KYC_REQUIRED', 'Traveller KYC must be approved before a trip can be activated.');
  const body = tripSchema.parse(req.body);
  const { data, error } = await supabase().from('trips').insert({
    traveller_id: req.user.id,
    origin_country: body.originCountry,
    origin_airport_code: body.originAirportCode,
    destination_country: body.destinationCountry,
    destination_airport_code: body.destinationAirportCode,
    departure_at: body.departureAt,
    arrival_at: body.arrivalAt,
    capacity_kg: body.capacityKg,
    status: 'DRAFT'
  }).select('*').single();
  if (error) throw error;
  res.status(201).json({ data, message: 'Trip saved as DRAFT. It is not discoverable until verified and approved.' });
});

apiRouter.get('/trips/mine', requireAuth, requireRole('traveller'), async (req, res) => {
  const { data, error } = await supabase().from('trips').select('*').eq('traveller_id', req.user.id).order('departure_at', { ascending: true }).limit(100);
  if (error) throw error;
  res.json({ data });
});

apiRouter.get('/requests', requireAuth, requireRole('traveller'), async (req, res) => {
  if (req.query.matching !== 'me') throw new HttpError(400, 'MATCHING_FILTER_REQUIRED', 'Use matching=me.');
  if (req.profile.kyc_status !== 'VERIFIED') throw new HttpError(403, 'KYC_REQUIRED', 'Traveller KYC must be approved before matching.');
  const { data: trips, error: tripError } = await supabase().from('trips').select('*').eq('traveller_id', req.user.id).eq('status', 'ACTIVE').gte('departure_at', new Date().toISOString()).limit(30);
  if (tripError) throw tripError;
  if (!trips?.length) return res.json({ data: [] });
  const { data: requests, error } = await supabase().from('requests').select('*').eq('status', 'OPEN').eq('compliance_status', 'APPROVED').gte('needed_by', new Date().toISOString()).limit(200);
  if (error) throw error;
  const matches = requests.filter((request) => trips.some((trip) =>
    trip.origin_airport_code === request.origin_airport_code &&
    trip.destination_airport_code === request.destination_airport_code &&
    new Date(trip.departure_at) <= new Date(request.needed_by) && new Date(trip.arrival_at) <= new Date(request.needed_by) &&
    trip.origin_country === request.origin_country && trip.destination_country === request.destination_country
  ));
  res.json({ data: matches });
});

apiRouter.post('/requests/:id/quotes', requireAuth, requireRole('traveller'), async (req, res) => {
  const requestId = z.string().uuid().parse(req.params.id);
  if (req.profile.kyc_status !== 'VERIFIED') throw new HttpError(403, 'KYC_REQUIRED', 'Traveller KYC must be approved before creating quotes.');
  const body = quoteSchema.parse(req.body);
  const { data: request, error: requestError } = await supabase().from('requests').select('*').eq('id', requestId).single();
  if (requestError) throw requestError;
  assertRequestMatchable(request);
  if (request.status !== 'OPEN') throw new HttpError(409, 'REQUEST_NOT_OPEN', 'This request is not open for quotes.');
  const { data: trip, error: tripError } = await supabase().from('trips').select('*').eq('id', body.tripId).eq('traveller_id', req.user.id).eq('status', 'ACTIVE').single();
  if (tripError || !trip) throw new HttpError(404, 'ACTIVE_TRIP_REQUIRED', 'An active matching trip was not found.');
  const matches = trip.origin_airport_code === request.origin_airport_code && trip.destination_airport_code === request.destination_airport_code && trip.origin_country === request.origin_country && trip.destination_country === request.destination_country && new Date(trip.departure_at) <= new Date(request.needed_by) && new Date(trip.arrival_at) <= new Date(request.needed_by);
  if (!matches) throw new HttpError(409, 'TRIP_ROUTE_MISMATCH', 'This trip does not match the request route and date.');
  const fx = getConfiguredRate(body.itemCurrency);
  const converted = convertMinorUnits({ amountMinor: body.itemPriceMinor, fromCurrency: body.itemCurrency, toCurrency: 'INR', ...fx });
  const expiresAt = new Date(Date.now() + env.QUOTE_TTL_MINUTES * 60_000).toISOString();
  const { data, error } = await supabase().from('quotes').insert({
    request_id: requestId, trip_id: body.tripId, traveller_id: req.user.id,
    item_price_minor: body.itemPriceMinor, item_currency: body.itemCurrency, traveller_reward_paise: body.travellerRewardPaise,
    fx_rate: fx.rate, fx_source: fx.source, fx_timestamp: fx.rateTimestamp,
    indicative_duty_paise: null, duty_source: null, duty_reviewed_by: null, duty_reviewed_at: null, duty_assessment_reference: null,
    note: body.note ?? null, platform_fee_bps: env.PLATFORM_FEE_BPS,
    status: 'ACTIVE', expires_at: expiresAt
  }).select('*').single();
  if (error) throw error;
  res.status(201).json({ data, preview: { convertedItemPricePaise: converted.amountMinor, convertedCurrency: 'INR', fxSource: converted.source, fxTimestamp: converted.rateTimestamp, duty: 'PENDING_COMPLIANCE_REVIEW', canAccept: false } });
});

apiRouter.get('/requests/:id/quotes', requireAuth, requireRole('buyer', 'traveller', 'admin', 'compliance_reviewer'), async (req, res) => {
  const requestId = z.string().uuid().parse(req.params.id);
  const { data: request, error: requestError } = await supabase().from('requests').select('id,buyer_id,compliance_status').eq('id', requestId).single();
  if (requestError || !request) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
  const privileged = ['admin', 'compliance_reviewer'].includes(req.profile.role);
  const isBuyerOwner = request.buyer_id === req.user.id;
  if (!isBuyerOwner && !privileged && req.profile.role !== 'traveller') throw new HttpError(403, 'FORBIDDEN', 'You cannot view quotes for this request.');
  let quoteQuery = supabase().from('quotes').select('*').eq('request_id', requestId).order('created_at', { ascending: false }).limit(100);
  if (!isBuyerOwner && !privileged) quoteQuery = quoteQuery.eq('traveller_id', req.user.id);
  const { data, error } = await quoteQuery;
  if (error) throw error;
  res.json({ data });
});

apiRouter.post('/quotes/:id/accept', requireAuth, requireRole('buyer'), async (req, res) => {
  const quoteId = z.string().uuid().parse(req.params.id);
  const { data: quote, error: quoteError } = await supabase().from('quotes').select('*, requests(*)').eq('id', quoteId).single();
  if (quoteError) throw quoteError;
  const request = quote.requests;
  if (!request || request.buyer_id !== req.user.id) throw new HttpError(404, 'QUOTE_NOT_FOUND', 'Quote not found.');
  assertRequestMatchable(request);
  if (quote.status !== 'ACTIVE' || new Date(quote.expires_at) <= new Date()) throw new HttpError(409, 'QUOTE_EXPIRED', 'This quote is no longer active.');
  if (quote.indicative_duty_paise === null ||
      !quote.duty_source?.trim() ||
      !quote.duty_reviewed_by ||
      !quote.duty_reviewed_at ||
      !quote.duty_assessment_reference?.trim()) {
    throw new HttpError(409, 'DUTY_REVIEW_REQUIRED', 'A completed compliance duty review (amount, source, reviewer and assessment reference) is required before acceptance.');
  }
  const converted = convertMinorUnits({
    amountMinor: Number(quote.item_price_minor), fromCurrency: quote.item_currency, toCurrency: 'INR',
    rate: String(quote.fx_rate), source: quote.fx_source, rateTimestamp: quote.fx_timestamp
  });
  const breakdown = calculateOrderBreakdown({
    productCostPaise: converted.amountMinor,
    dutyPaise: Number(quote.indicative_duty_paise),
    travellerRewardPaise: Number(quote.traveller_reward_paise),
    platformFeeBps: Number(quote.platform_fee_bps),
    depositBps: env.BUYER_DEPOSIT_BPS
  });
  const { data: orderId, error } = await supabase().rpc('accept_quote', {
    p_quote_id: quoteId,
    p_buyer_id: req.user.id,
    p_subtotal_paise: breakdown.subtotalPaise,
    p_platform_fee_paise: breakdown.platformFeePaise,
    p_total_paise: breakdown.totalPaise,
    p_deposit_paise: breakdown.depositPaise,
    p_duty_paise: breakdown.dutyPaise,
    p_traveller_reward_paise: breakdown.travellerRewardPaise,
    p_upfront_paise: breakdown.upfrontPaise,
    p_balance_paise: breakdown.balancePaise,
    p_payment_deadline: new Date(Date.now() + env.ORDER_PAYMENT_TTL_MINUTES * 60_000).toISOString()
  });
  if (error) throw new HttpError(409, 'QUOTE_ACCEPT_FAILED', 'The quote could not be accepted. It may have been taken or changed.', { cause: error.message });
  const { data: order, error: orderError } = await supabase().from('orders').select('*').eq('id', orderId).single();
  if (orderError) throw orderError;
  res.status(201).json({ data: order, priceBreakdown: breakdown, nextStep: 'Create a payment intent within the payment deadline.' });
});

apiRouter.post('/payments/create-order', requireAuth, requireRole('buyer'), async (req, res) => {
  const body = z.object({ orderId: z.string().uuid() }).parse(req.body);
  const idempotencyKey = req.get('idempotency-key');
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,120}$/.test(idempotencyKey)) throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Provide an Idempotency-Key header (8–120 safe characters).');
  const { data: order, error: orderError } = await supabase().from('orders').select('*').eq('id', body.orderId).eq('buyer_id', req.user.id).single();
  if (orderError || !order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  if (order.state !== 'ACCEPTED' || new Date(order.payment_deadline) <= new Date()) throw new HttpError(409, 'PAYMENT_WINDOW_CLOSED', 'This order is not accepting its initial payment.');

  const { data: existing } = await supabase().from('payment_intents').select('*').eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existing) {
    if (existing.order_id !== order.id || existing.buyer_id !== req.user.id) throw new HttpError(409, 'IDEMPOTENCY_KEY_REUSED', 'This idempotency key is already bound to another operation.');
    return res.json({ data: { id: existing.id, provider: existing.provider, providerOrderId: existing.provider_order_id, amountPaise: existing.amount_paise, status: existing.status, mock: existing.provider === 'MOCK' } });
  }

  const provider = env.MOCK_PAYMENTS ? 'MOCK' : 'RAZORPAY';
  if (provider === 'RAZORPAY' && (!env.PAYMENTS_ENABLED || env.NODE_ENV !== 'production')) {
    // Real provider calls are deliberately blocked in development until a deliberate production configuration is approved.
    throw new HttpError(503, 'REAL_PAYMENTS_DISABLED', 'Use the mock provider during development. Real payments require a production deployment and compliance sign-off.');
  }
  const intentId = randomUUID();
  const { data: intent, error: insertError } = await supabase().from('payment_intents').insert({
    id: intentId, order_id: order.id, buyer_id: req.user.id, provider,
    idempotency_key: idempotencyKey, amount_paise: order.upfront_paise, currency: 'INR', status: 'CREATING'
  }).select('*').single();
  if (insertError) {
    if (insertError.code === '23505') {
      const { data: retryIntent, error: retryLookupError } = await supabase().from('payment_intents')
        .select('id,order_id,buyer_id,provider,provider_order_id,amount_paise,status')
        .eq('idempotency_key', idempotencyKey).maybeSingle();
      if (retryLookupError) throw retryLookupError;
      if (retryIntent && retryIntent.order_id === order.id && retryIntent.buyer_id === req.user.id) {
        return res.status(200).json({ data: { id: retryIntent.id, provider: retryIntent.provider, providerOrderId: retryIntent.provider_order_id, amountPaise: retryIntent.amount_paise, status: retryIntent.status, mock: retryIntent.provider === 'MOCK' }, duplicate: true });
      }
      throw new HttpError(409, 'PAYMENT_ATTEMPT_EXISTS', 'Another payment attempt is already open for this order. Reuse its idempotency key or wait for reconciliation.');
    }
    throw insertError;
  }

  if (provider === 'MOCK') {
    const { data: updated, error } = await supabase().from('payment_intents').update({ provider_order_id: `mock_${intentId}`, status: 'CREATED' }).eq('id', intent.id).select('*').single();
    if (error) throw error;
    return res.status(201).json({ data: { id: updated.id, provider: 'MOCK', providerOrderId: updated.provider_order_id, amountPaise: updated.amount_paise, currency: 'INR', status: updated.status, mock: true }, warning: 'Demo-only payment intent. No money is collected.' });
  }

  try {
    const providerOrder = await createRazorpayOrder({ amountPaise: Number(order.upfront_paise), receipt: intentId, notes: { portal_order_id: order.id, portal_intent_id: intentId } });
    const { data: updated, error } = await supabase().from('payment_intents').update({ provider_order_id: providerOrder.id, status: 'CREATED', raw_provider_reference: { receipt: providerOrder.receipt } }).eq('id', intent.id).select('*').single();
    if (error) throw error;
    res.status(201).json({ data: { id: updated.id, provider: 'RAZORPAY', providerOrderId: updated.provider_order_id, amountPaise: updated.amount_paise, currency: 'INR', status: updated.status, keyId: env.RAZORPAY_KEY_ID, mock: false } });
  } catch (error) {
    await supabase().from('payment_intents').update({ status: 'FAILED' }).eq('id', intent.id);
    throw error;
  }
});

apiRouter.post('/payments/verify', requireAuth, requireRole('buyer'), async (req, res) => {
  const body = z.object({ paymentIntentId: z.string().uuid(), providerOrderId: z.string().min(4).max(100), paymentId: z.string().min(4).max(100).optional(), signature: z.string().optional() }).parse(req.body);
  const { data: intent, error } = await supabase().from('payment_intents').select('*').eq('id', body.paymentIntentId).eq('buyer_id', req.user.id).single();
  if (error || !intent) throw new HttpError(404, 'PAYMENT_INTENT_NOT_FOUND', 'Payment intent not found.');
  if (intent.provider_order_id !== body.providerOrderId) throw new HttpError(400, 'PAYMENT_ORDER_MISMATCH', 'Payment order does not match this intent.');
  if (intent.status === 'CAPTURED') {
    const { data: existingOrder } = await supabase().from('orders').select('state').eq('id', intent.order_id).single();
    if (existingOrder?.state === 'ACCEPTED') {
      const { error: retryError } = await supabase().rpc('transition_order', { p_order_id: intent.order_id, p_to_state: 'LOCKED', p_actor_id: req.user.id, p_note: 'Idempotent retry: payment already captured.' });
      if (retryError) throw new HttpError(409, 'ORDER_LOCK_RETRY_FAILED', 'Payment is captured, but the order still needs support review.');
    }
    return res.json({ data: { status: 'CAPTURED', orderId: intent.order_id, duplicate: true } });
  }

  if (intent.provider === 'MOCK') {
    if (env.NODE_ENV === 'production') throw new HttpError(403, 'MOCK_PAYMENT_FORBIDDEN', 'Mock payment verification is disabled in production.');
    const { error: updateError } = await supabase().from('payment_intents').update({ status: 'CAPTURED', raw_provider_reference: { mode: 'DEMO', verifiedAt: new Date().toISOString() } }).eq('id', intent.id);
    if (updateError) throw updateError;
  } else {
    if (!body.paymentId || !body.signature || !verifyCheckoutSignature({ orderId: body.providerOrderId, paymentId: body.paymentId, signature: body.signature })) {
      throw new HttpError(400, 'PAYMENT_SIGNATURE_INVALID', 'Payment signature verification failed.');
    }
    const payment = await fetchRazorpayPayment(body.paymentId);
    if (payment.order_id !== body.providerOrderId || Number(payment.amount) !== Number(intent.amount_paise) || payment.currency !== 'INR' || payment.status !== 'captured') {
      throw new HttpError(409, 'PAYMENT_NOT_CAPTURED', 'The provider payment does not match the expected amount or is not captured.');
    }
    const { error: updateError } = await supabase().from('payment_intents').update({ provider_payment_id: payment.id, status: 'CAPTURED', raw_provider_reference: { paymentId: payment.id, status: payment.status } }).eq('id', intent.id);
    if (updateError) throw updateError;
  }
  const { data: lockedOrder, error: transitionError } = await supabase().rpc('transition_order', {
    p_order_id: intent.order_id, p_to_state: 'LOCKED', p_actor_id: req.user.id, p_note: 'Initial payment verified.'
  });
  if (transitionError) throw new HttpError(409, 'ORDER_LOCK_FAILED', 'Payment was verified but the order could not be locked. Contact support with the request ID.');
  if (lockedOrder) await postCollectionLedger(supabase(), lockedOrder, req.user.id).catch((e) => logger.error({ err: e, orderId: intent.order_id }, 'collection_ledger_failed'));
  res.json({ data: { status: 'CAPTURED', orderId: intent.order_id, orderState: 'LOCKED' }, warning: intent.provider === 'MOCK' ? 'Demo payment only. No money moved.' : undefined });
});

apiRouter.get('/orders/:id', requireAuth, async (req, res) => {
  const orderId = z.string().uuid().parse(req.params.id);
  const { data, error } = await supabase().from('orders').select('*').eq('id', orderId).or(`buyer_id.eq.${req.user.id},traveller_id.eq.${req.user.id}`).single();
  if (error || !data) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  const { data: events, error: eventsError } = await supabase().from('order_events').select('from_state,to_state,note,created_at').eq('order_id', orderId).order('created_at');
  if (eventsError) throw eventsError;
  res.json({ data, events });
});

apiRouter.post('/orders/:id/purchased', requireAuth, requireRole('traveller'), async (req, res) => transitionOrder(req, res, 'PURCHASED'));
apiRouter.post('/orders/:id/landed', requireAuth, requireRole('traveller'), async (req, res) => transitionOrder(req, res, 'LANDED'));
apiRouter.post('/orders/:id/dispute', requireAuth, async (req, res) => transitionOrder(req, res, 'DISPUTED'));

// Handover completion is gated by a one-time OTP issued to the buyer. Completion is buyer-authorized,
// so the buyer verifies the code; in production the code reaches the buyer out-of-band, never via this API.
apiRouter.post('/orders/:id/handover/issue-otp', requireAuth, requireRole('buyer', 'traveller'), async (req, res) => {
  const orderId = z.string().uuid().parse(req.params.id);
  const { data: order, error } = await supabase().from('orders').select('*').eq('id', orderId)
    .or(`buyer_id.eq.${req.user.id},traveller_id.eq.${req.user.id}`).single();
  if (error || !order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  if (order.state !== 'LANDED') throw new HttpError(409, 'HANDOVER_NOT_READY', 'OTP handover is only available once the traveller has confirmed arrival.');
  // Invalidate any prior unconsumed challenges for this order + buyer before issuing a fresh code.
  await supabase().from('otp_challenges').delete().eq('order_id', orderId).eq('recipient_user_id', order.buyer_id).is('consumed_at', null);
  const code = generateOtp();
  const otpHash = hashOtp({ orderId, userId: order.buyer_id, code });
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const { data: challenge, error: insertError } = await supabase().from('otp_challenges').insert({
    order_id: orderId, recipient_user_id: order.buyer_id, otp_hash: otpHash, expires_at: expiresAt, attempts: 0
  }).select('id,expires_at').single();
  if (insertError) throw insertError;
  res.json({
    data: { challengeId: challenge.id, expiresAt: challenge.expires_at, recipient: 'buyer' },
    code, demo: true,
    warning: 'Demo only: the OTP code is returned here for testing. In production it is delivered to the buyer out-of-band and never exposed to the traveller.'
  });
});

apiRouter.post('/orders/:id/handover/verify', requireAuth, requireRole('buyer'), async (req, res) => {
  const orderId = z.string().uuid().parse(req.params.id);
  const body = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(req.body);
  const { data: order, error } = await supabase().from('orders').select('*').eq('id', orderId).eq('buyer_id', req.user.id).single();
  if (error || !order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  if (order.state === 'COMPLETED') return res.json({ data: { orderId, state: 'COMPLETED' }, duplicate: true });
  if (order.state !== 'LANDED') throw new HttpError(409, 'HANDOVER_NOT_READY', 'OTP verification requires a landed order.');
  const { data: challenges, error: challengeError } = await supabase().from('otp_challenges')
    .select('*').eq('order_id', orderId).eq('recipient_user_id', req.user.id).is('consumed_at', null)
    .gte('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(5);
  if (challengeError) throw challengeError;
  if (!challenges?.length) throw new HttpError(409, 'OTP_REQUIRED', 'Request a handover OTP first.');
  const matched = challenges.find((c) => c.attempts < 5 && verifyOtp({ orderId, userId: req.user.id, code: body.code, expectedHash: c.otp_hash }));
  if (!matched) {
    await supabase().from('otp_challenges').update({ attempts: (challenges[0].attempts ?? 0) + 1 }).eq('id', challenges[0].id);
    throw new HttpError(401, 'OTP_INVALID', 'The OTP is incorrect or expired. Request a new code and try again.');
  }
  await supabase().from('otp_challenges').update({ consumed_at: new Date().toISOString() }).eq('id', matched.id);
  const { data: completed, error: transitionError } = await supabase().rpc('transition_order', {
    p_order_id: orderId, p_to_state: 'COMPLETED', p_actor_id: req.user.id, p_note: 'Handover confirmed via OTP.'
  });
  if (transitionError) throw new HttpError(409, 'ORDER_COMPLETE_FAILED', 'Handover OTP was verified but the order could not be completed.');
  await postSettlementLedger(supabase(), completed ?? order, req.user.id).catch((e) => logger.error({ err: e, orderId }, 'settlement_ledger_failed'));
  res.json({ data: { orderId, state: 'COMPLETED', order: completed ?? null }, warning: 'Demo settlement posted to the internal ledger only. No real money moved.' });
});

async function transitionOrder(req, res, targetState) {
  const orderId = z.string().uuid().parse(req.params.id);
  const body = z.object({ note: z.string().max(500).optional() }).parse(req.body ?? {});
  const { data: current, error: fetchError } = await supabase().from('orders').select('id,state,buyer_id,traveller_id').eq('id', orderId).single();
  if (fetchError || !current) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  if (targetState === 'DISPUTED' && ![current.buyer_id, current.traveller_id].includes(req.user.id)) throw new HttpError(403, 'FORBIDDEN', 'Only order participants can dispute.');
  if (targetState === 'PURCHASED' && current.traveller_id !== req.user.id) throw new HttpError(403, 'FORBIDDEN', 'Only the assigned traveller can confirm purchase.');
  if (targetState === 'LANDED' && current.traveller_id !== req.user.id) throw new HttpError(403, 'FORBIDDEN', 'Only the assigned traveller can confirm arrival.');
  if (targetState === 'COMPLETED' && current.buyer_id !== req.user.id) throw new HttpError(403, 'FORBIDDEN', 'Only the buyer can confirm handover.');
  assertTransition(current.state, targetState);
  const { data, error } = await supabase().rpc('transition_order', { p_order_id: orderId, p_to_state: targetState, p_actor_id: req.user.id, p_note: body.note ?? null });
  if (error) throw new HttpError(409, 'ORDER_TRANSITION_FAILED', 'Order state could not be changed.');
  res.json({ data });
}

apiRouter.post('/kyc/submit', requireAuth, async (req, res) => {
  // Mock onboarding only. Never grant VERIFIED status without a real KYC provider decision.
  const body = z.object({ providerReference: z.string().min(6).max(120).optional() }).parse(req.body ?? {});
  const { data, error } = await supabase().from('profiles').update({ kyc_status: 'SUBMITTED' }).eq('id', req.user.id)
    .select('id, kyc_status').single();
  if (error) throw error;
  logger.info({ userId: req.user.id, hasProviderReference: Boolean(body.providerReference) }, 'kyc_demo_submitted');
  res.status(202).json({ data, message: 'Demo submission recorded. This does not verify identity or enable traveller payments.' });
});


// Compliance review is an explicit privileged operation. Matching stays closed otherwise.
apiRouter.post('/admin/requests/:id/review', requireAuth, requireRole('admin', 'compliance_reviewer'), async (req, res) => {
  const requestId = z.string().uuid().parse(req.params.id);
  const body = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), reason: z.string().trim().min(10).max(1000), complianceReference: z.string().trim().min(6).max(160) }).parse(req.body);
  const { data: request, error: fetchError } = await supabase().from('requests').select('id,hs_code,compliance_status,status,fulfilment_mode,is_for_third_party').eq('id', requestId).single();
  if (fetchError || !request) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
  if (request.compliance_status !== 'REVIEW_REQUIRED') throw new HttpError(409, 'ALREADY_REVIEWED', 'This request has already been reviewed.');
  if (body.decision === 'APPROVED' && !request.hs_code) throw new HttpError(409, 'HS_CODE_REQUIRED', 'A validated HS code is required before approval.');
  if (body.decision === 'APPROVED' && request.fulfilment_mode === 'PASSENGER_BAGGAGE' && request.is_for_third_party) {
    throw new HttpError(409, 'THIRD_PARTY_BAGGAGE_NOT_SUPPORTED', 'A third-party commercial request cannot be approved under passenger-baggage fulfilment. Select a lawful formal-import or licensed-courier route and submit it for review.');
  }
  const { data, error } = await supabase().from('requests').update({
    compliance_status: body.decision,
    compliance_reason: [body.reason],
    compliance_reviewed_by: req.user.id,
    compliance_reviewed_at: new Date().toISOString(),
    compliance_reference: body.complianceReference,
    status: body.decision === 'APPROVED' ? 'OPEN' : 'REJECTED'
  }).eq('id', requestId).eq('compliance_status', 'REVIEW_REQUIRED').select('*').single();
  if (error) throw new HttpError(409, 'COMPLIANCE_REVIEW_CONFLICT', 'The request changed during review. Refresh and retry.');
  await supabase().from('audit_logs').insert({ actor_id: req.user.id, action: `REQUEST_${body.decision}`, target_type: 'request', target_id: requestId, request_id: req.id, metadata: { complianceReference: body.complianceReference } });
  res.json({ data });
});

apiRouter.post('/admin/quotes/:id/duty-assessment', requireAuth, requireRole('admin', 'compliance_reviewer'), async (req, res) => {
  const quoteId = z.string().uuid().parse(req.params.id);
  const body = z.object({ dutyAmountPaise: z.number().int().nonnegative().safe(), source: z.string().trim().min(3).max(120), assessmentReference: z.string().trim().min(6).max(160) }).parse(req.body);
  const { data: quote, error: fetchError } = await supabase().from('quotes').select('id,request_id,status').eq('id', quoteId).single();
  if (fetchError || !quote) throw new HttpError(404, 'QUOTE_NOT_FOUND', 'Quote not found.');
  if (quote.status !== 'ACTIVE') throw new HttpError(409, 'QUOTE_NOT_ACTIVE', 'Duty assessment can only be attached to an active quote.');
  const { data, error } = await supabase().from('quotes').update({
    indicative_duty_paise: body.dutyAmountPaise,
    duty_source: body.source,
    duty_reviewed_by: req.user.id,
    duty_reviewed_at: new Date().toISOString(),
    duty_assessment_reference: body.assessmentReference
  }).eq('id', quoteId).eq('status', 'ACTIVE').select('*').single();
  if (error) throw new HttpError(409, 'DUTY_ASSESSMENT_CONFLICT', 'The quote changed during the duty review.');
  await supabase().from('audit_logs').insert({ actor_id: req.user.id, action: 'QUOTE_DUTY_ASSESSED', target_type: 'quote', target_id: quoteId, request_id: req.id, metadata: { source: body.source, assessmentReference: body.assessmentReference } });
  res.json({ data });
});

apiRouter.post('/admin/trips/:id/activate', requireAuth, requireRole('admin'), async (req, res) => {
  const tripId = z.string().uuid().parse(req.params.id);
  const { data: trip, error: fetchError } = await supabase().from('trips').select('id,traveller_id,status').eq('id', tripId).single();
  if (fetchError || !trip) throw new HttpError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
  const { data: traveller, error: profileError } = await supabase().from('profiles').select('account_status,kyc_status,role').eq('id', trip.traveller_id).single();
  if (profileError || !traveller || traveller.account_status !== 'ACTIVE' || traveller.kyc_status !== 'VERIFIED' || traveller.role !== 'traveller') throw new HttpError(409, 'TRAVELLER_NOT_CLEARED', 'Traveller account and KYC must be approved before activation.');
  if (trip.status !== 'DRAFT') throw new HttpError(409, 'TRIP_NOT_DRAFT', 'Only draft trips can be activated.');
  const { data, error } = await supabase().from('trips').update({ status: 'ACTIVE' }).eq('id', tripId).eq('status', 'DRAFT').select('*').single();
  if (error) throw error;
  await supabase().from('audit_logs').insert({ actor_id: req.user.id, action: 'TRIP_ACTIVATED', target_type: 'trip', target_id: tripId, request_id: req.id, metadata: {} });
  res.json({ data });
});

apiRouter.post('/admin/profiles/:id/role', requireAuth, requireRole('admin'), async (req, res) => {
  const profileId = z.string().uuid().parse(req.params.id);
  const body = z.object({ role: z.enum(['buyer', 'traveller']) }).parse(req.body);
  const { data, error } = await supabase().rpc('provision_profile_role', {
    p_profile_id: profileId, p_new_role: body.role, p_actor_id: req.user.id
  });
  if (error) throw new HttpError(409, 'PROFILE_PROVISION_FAILED', 'Profile role could not be provisioned. Check the profile state and retry.');
  res.json({ data, message: body.role === 'traveller' ? 'Traveller role assigned; KYC review is still required.' : 'Buyer role assigned and buyer account activated.' });
});

apiRouter.post('/admin/profiles/:id/kyc-review', requireAuth, requireRole('admin'), async (req, res) => {
  const profileId = z.string().uuid().parse(req.params.id);
  const body = z.object({ decision: z.enum(['VERIFIED', 'REJECTED']), providerReference: z.string().trim().min(6).max(160) }).parse(req.body);
  const { data, error } = await supabase().rpc('review_traveller_kyc', {
    p_profile_id: profileId, p_decision: body.decision, p_provider_reference: body.providerReference, p_actor_id: req.user.id
  });
  if (error) throw new HttpError(409, 'KYC_REVIEW_FAILED', 'KYC decision could not be recorded. Confirm the account is a traveller with submitted KYC.');
  res.json({ data });
});
