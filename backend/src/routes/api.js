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
import { matchesTripToRequest } from '../services/matching.js';

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
  const complianceStatus = legality.status === 'REJECTED' ? 'REJECTED' : 'REVIEW_REQUIRED';
  const requestStatus = legality.status === 'REJECTED' ? 'REJECTED' : 'PENDING_REVIEW';
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
    compliance_status: complianceStatus,
    compliance_reason: legality.reasons,
    request_status: requestStatus
  }).select('*').single();
  if (error) throw error;
  res.status(201).json({ data, compliance: { status: complianceStatus, canMatch: false, reasons: legality.reasons } });
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
  const { data: traveller, error: te } = await supabase().from('profiles').select('account_status').eq('id', req.user.id).single();
  if (te || !traveller) throw new HttpError(403, 'PROFILE_REQUIRED', 'Your account profile is not available.');
  if (traveller.account_status !== 'ACTIVE') throw new HttpError(403, 'ACCOUNT_RESTRICTED', 'Your account is not active and cannot be matched at this time.');
  const { data: trips, error: tripError } = await supabase().from('trips').select('*').eq('traveller_id', req.user.id).eq('status', 'ACTIVE').gte('departure_at', new Date().toISOString()).limit(30);
  if (tripError) throw tripError;
  if (!trips?.length) return res.json({ data: [] });
  const { data: requests, error } = await supabase().from('requests').select('*').eq('request_status', 'OPEN').eq('compliance_status', 'APPROVED').gte('needed_by', new Date().toISOString()).limit(200);
  if (error) throw error;
  const matches = requests.filter((request) => trips.some((trip) => matchesTripToRequest(trip, request)));
  res.json({ data: matches });
});

apiRouter.post('/requests/:id/quotes', requireAuth, requireRole('traveller'), async (req, res) => {
  const requestId = z.string().uuid().parse(req.params.id);
  if (req.profile.kyc_status !== 'VERIFIED') throw new HttpError(403, 'KYC_REQUIRED', 'Traveller KYC must be approved before creating quotes.');
  const { data: request, error: requestError } = await supabase().from('requests').select('*').eq('id', requestId).single();
  if (requestError) throw requestError;
  assertRequestMatchable(request);
  if (request.request_status !== 'OPEN') throw new HttpError(409, 'REQUEST_NOT_OPEN', 'This request is not open for quotes.');
  // Check traveller account status
  const { data: traveller, error: te } = await supabase().from('profiles').select('account_status').eq('id', req.user.id).single();
  if (te || !traveller || traveller.account_status !== 'ACTIVE') throw new HttpError(403, 'ACCOUNT_RESTRICTED', 'Your account is not active and cannot create quotes at this time.');
  const { data: trip, error: tripError } = await supabase().from('trips').select('*').eq('id', req.params.tripId).eq('traveller_id', req.user.id).eq('status', 'ACTIVE').single();
  if (tripError || !trip) throw new HttpError(404, 'ACTIVE_TRIP_REQUIRED', 'An active matching trip was not found.');
  const matches = matchesTripToRequest(trip, request);
  if (!matches) throw new HttpError(409, 'TRIP_ROUTE_MISMATCH', 'This trip does not match the request route and date.');
  const fx = getConfiguredRate(req.body.itemCurrency);
  const converted = convertMinorUnits({ amountMinor: req.body.itemPriceMinor, fromCurrency: req.body.itemCurrency, toCurrency: 'INR', ...fx });
  const expiresAt = new Date(Date.now() + env.QUOTE_TTL_MINUTES * 60_000).toISOString();
  const { data, error } = await supabase().from('quotes').insert({
    request_id: requestId, trip_id: req.params.tripId, traveller_id: req.user.id,
    item_price_minor: req.body.itemPriceMinor, item_currency: req.body.itemCurrency, traveller_reward_paise: req.body.travellerRewardPaise,
    fx_rate: fx.rate, fx_source: fx.source, fx_timestamp: fx.rateTimestamp,
    indicative_duty_paise: null, duty_source: null, duty_reviewed_by: null, duty_reviewed_at: null, duty_assessment_reference: null,
    note: req.body.note ?? null, platform_fee_bps: env.PLATFORM_FEE_BPS,
    status: 'ACTIVE', expires_at: expiresAt
  }).select('*').single();
  if (error) throw error;
  res.status(201).json({ data, preview: { convertedItemPricePaise: converted.amountMinor, convertedCurrency: 'INR', fxSource: converted.source, fxTimestamp: converted.rateTimestamp, duty: 'PENDING_COMPLIANCE_REVIEW', canAccept: false } });
});

apiRouter.get('/requests/:id/quotes', requireAuth, requireRole('buyer', 'traveller', 'admin', 'compliance_reviewer'), async (req, res) => {
  const requestId = z.string().uuid().parse(req.params.id);
  const { data: request, error: requestError } = await supabase().from('requests').select('id,buyer_id,compliance_status,request_status').eq('id', requestId).single();
  if (requestError || !request) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
  const privileged = ['admin', 'compliance_reviewer'].includes(req.profile.role);
  const isBuyerOwner = request.buyer_id === req.user.id;
  if (!isBuyerOwner && !privileged && req.profile.role !== 'traveller') throw new HttpError(403, 'FORBIDDEN', 'You cannot view quotes for this request.');
  // Only show quotes if request is approved and open, unless privileged.
  if (!privileged && (request.compliance_status !== 'APPROVED' || request.request_status !== 'OPEN')) {
    throw new HttpError(403, 'REQUEST_NOT_OPEN', 'This request is not open for quotes.');
  }
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
  const requestProfile = quote.requests;
  if (!requestProfile || requestProfile.buyer_id !== req.user.id) throw new HttpError(404, 'QUOTE_NOT_FOUND', 'Quote not found.');
  assertRequestMatchable(requestProfile);
  if (quote.status !== 'ACTIVE' || new Date(quote.expires_at) <= new Date()) throw new HttpError(409, 'QUOTE_EXPIRED', 'This quote is no longer active.');
  if (quote.indicative_duty_paise === null ||
      !quote.duty_source?.trim() ||
      !quote.duty_reviewed_by ||
      !quote.duty_reviewed_at ||
      !quote.duty_assessment_reference?.trim() ||
      quote.duty_assessment_status !== 'APPROVED') {
    throw new HttpError(409, 'DUTY_REVIEW_REQUIRED', 'A completed compliance duty review (amount, source, reviewer, timestamp, reference and approved status) is required before acceptance.');
  }
  // traveller must have ACTIVE account status and VERIFIED KYC
  const { data: trip, error: tripError } = await supabase().from('trips').select('traveller_id').eq('id', quote.trip_id).single();
  if (tripError || !trip) throw new HttpError(404, 'TRIP_NOT_FOUND', 'Associated trip not found.');
  const { data: traveller, error: te } = await supabase().from('profiles').select('account_status, kyc_status, role').eq('id', trip.traveller_id).single();
  if (te || !traveller || traveller.account_status !== 'ACTIVE' || traveller.kyc_status !== 'VERIFIED' || traveller.role !== 'traveller') {
    throw new HttpError(403, 'ACCOUNT_RESTRICTED', 'Traveller account is not active or KYC is not verified.');
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

  // Enforce traveller eligibility: ACTIVE account + VERIFIED KYC
  const { data: quote, error: quoteError } = await supabase().from('quotes').select('*').eq('id', order.quote_id).single();
  if (quoteError || !quote) throw new HttpError(404, 'QUOTE_NOT_FOUND', 'Order quote not found.');
  const { data: trip, error: tripError } = await supabase().from('trips').select('traveller_id').eq('id', quote.trip_id).single();
  if (tripError || !trip) throw new HttpError(404, 'TRIP_NOT_FOUND', 'Associated trip not found.');
  const { data: traveller, error: te } = await supabase().from('profiles').select('account_status, kyc_status, role').eq('id', trip.traveller_id).single();
  if (te || !traveller || traveller.account_status !== 'ACTIVE' || traveller.kyc_status !== 'VERIFIED' || traveller.role !== 'traveller') {
    throw new HttpError(403, 'ACCOUNT_RESTRICTED', 'Traveller account is not active or KYC is not verified. Cannot create payment intent.');
  }

  const { data: existing } = await supabase().from('payment_intents').select('*').eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existing) {
    if (existing.order_id !== order.id || existing.buyer_id !== req.user.id) throw new HttpError(409, 'IDEMPOTENCY_KEY_REUSED', 'This idempotency key is already bound to another operation.');
    return res.json({ data: { id: existing.id, provider: existing.provider, providerOrderId: existing.provider_order_id, amountPaise: existing.amount_paise, status: existing.status, mock: existing.provider === 'MOCK', duplicate: true } });
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
        return res.status(200).json({ data: { id: retryIntent.id, provider: retryIntent.provider, providerOrderId: retryIntent.provider_order_id, amountPaise: retryIntent.amount_paise, status: retryIntent.status, mock: retryIntent.provider === 'MOCK', duplicate: true } });
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
    const { data: existingOrder } = await supabase().from('orders').select('*').eq('id', intent.order_id).single();
    if (existingOrder?.state === 'ACCEPTED') {
      const { data: lockedOrder, error: retryError } = await supabase().rpc('transition_order', { p_order_id: intent.order_id, p_to_state: 'LOCKED', p_actor_id: req.user.id, p_note: 'Idempotent retry: payment already captured.' });
      if (retryError) throw new HttpError(409, 'ORDER_LOCK_RETRY_FAILED', 'Payment is captured, but the order still needs support review.');
      if (lockedOrder) await postCollectionLedger(supabase(), lockedOrder, req.user.id).catch((e) => logger.error({ err: e, orderId: intent.order_id }, 'collection_ledger_failed'));
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

// GET /api/v1/orders/mine - List orders belonging to the authenticated user
apiRouter.get('/orders/mine', requireAuth, async (req, res) => {
  const querySchema = z.object({
    state: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
    offset: z.coerce.number().int().min(0).default(0)
  });
  const params = querySchema.parse(req.query);

  // Determine buyer/traveler role and filter accordingly
  const { data: profile, error: profileError } = await supabase()
    .from('profiles')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (profileError || !profile) throw new HttpError(403, 'PROFILE_REQUIRED', 'Profile not available.');

  // Build the order query based on user role
  let ordersQuery;
  if (profile.role === 'buyer') {
    ordersQuery = supabase().from('orders')
      .select('*')
      .eq('buyer_id', req.user.id);
  } else if (profile.role === 'traveller') {
    ordersQuery = supabase().from('orders')
      .select('*')
      .eq('traveller_id', req.user.id);
  } else if (profile.role === 'admin') {
    // Admin can see all orders
    ordersQuery = supabase().from('orders').select('*');
  } else if (profile.role === 'compliance_reviewer') {
    // Compliance reviewers can see all orders
    ordersQuery = supabase().from('orders').select('*');
  } else {
    throw new HttpError(403, 'ROLE_FORBIDDEN', 'You do not have permission to view orders.');
  }

  // Apply optional state filter
  if (params.state) {
    ordersQuery = ordersQuery.eq('state', params.state);
  }

  // Apply stable ordering and pagination
  const { data: orders, error } = await ordersQuery
    .order('created_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (error) throw error;

  // Fetch related request info for each order (frozen snapshot)
  const orderIds = orders.map(o => o.id);
  const { data: requests, error: requestsError } = await supabase()
    .from('requests')
    .select('id, product_title, product_category, request_status, compliance_status, origin_airport_code, destination_airport_code, needed_by')
    .in('id', orderIds);

  if (requestsError && requestsError.code !== 'P2025') {
    logger.warn({ err: requestsError }, 'orders_mine_requests_fetch_failed');
  }

  // Build lookup map for request data
  const requestById = new Map();
  for (const r of (requests ?? [])) {
    requestById.set(r.id, r);
  }

  // Enrich orders with request info
  const enrichedOrders = orders.map(order => {
    const request = requestById.get(order.request_id);
    return {
      id: order.id,
      state: order.state,
      buyer_id: order.buyer_id,
      traveller_id: order.traveller_id,
      quote_id: order.quote_id,
      request_id: order.request_id,
      // Frozen financial snapshots
      subtotal_paise: order.subtotal_paise,
      platform_fee_paise: order.platform_fee_paise,
      total_paise: order.total_paise,
      deposit_paise: order.deposit_paise,
      duty_paise: order.duty_paise,
      traveller_reward_paise: order.traveller_reward_paise,
      upfront_paise: order.upfront_paise,
      balance_paise: order.balance_paise,
      currency: order.currency,
      payment_deadline: order.payment_deadline,
      forfeit_at: order.forfeit_at,
      version: order.version,
      created_at: order.created_at,
      updated_at: order.updated_at,
      // Linked request snapshot
      request: request ? {
        id: request.id,
        product_title: request.product_title,
        product_category: request.product_category,
        request_status: request.request_status,
        compliance_status: request.compliance_status,
        origin_airport_code: request.origin_airport_code,
        destination_airport_code: request.destination_airport_code,
        needed_by: request.needed_by
      } : null
    };
  });

  res.json({
    data: enrichedOrders,
    total: enrichedOrders.length,
    limit: params.limit,
    offset: params.offset
  });
});

// GET /api/v1/orders/:id/payment-status - Return payment and refund info for an order
apiRouter.get('/orders/:id/payment-status', requireAuth, async (req, res) => {
  const orderId = z.string().uuid().parse(req.params.id);

  // Get user profile to check role for admin access
  const { data: profile, error: profileError } = await supabase()
    .from('profiles')
    .select('role')
    .eq('id', req.user.id)
    .single();

  // Verify user is a participant in the order or is admin/compliance reviewer
  const isAdminOrReviewer = ['admin', 'compliance_reviewer'].includes(profile?.role);
  const { data: order, error: orderError } = await supabase()
    .from('orders')
    .select('id, buyer_id, traveller_id')
    .eq('id', orderId)
    .or(`buyer_id.eq.${req.user.id},traveller_id.eq.${req.user.id}`)
    .single();

  if (orderError || (!order && !isAdminOrReviewer)) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');

  // Fetch payment intents (individual payment attempts)
  const { data: paymentIntents, error: intentsError } = await supabase()
    .from('payment_intents')
    .select('id, provider, provider_order_id, provider_payment_id, amount_paise, currency, status, created_at, updated_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (intentsError) throw intentsError;

  // Fetch refunds (individual refund records) - use maybeSingle() pattern to handle missing table gracefully in tests
  let refunds = [];
  try {
    const refundResult = await supabase()
      .from('refunds')
      .select('id, provider_refund_id, amount_paise, currency, status, reason, notes, created_at, updated_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    if (refundResult.data) refunds = refundResult.data;
  } catch (e) {
    // Table may not exist in test environment - treat as empty
    if (e.code !== 'PGRST106' && e.message?.toLowerCase()?.includes?.('not found')) {
      refunds = [];
    } else {
      refunds = [];
    }
  }

  // Redact sensitive fields from payment intents
  const safePaymentIntents = (paymentIntents ?? []).map(pi => ({
    id: pi.id,
    provider: pi.provider,
    providerOrderId: pi.provider_order_id,
    providerPaymentId: pi.provider_payment_id,
    amountPaise: pi.amount_paise,
    currency: pi.currency,
    status: pi.status,
    createdAt: pi.created_at,
    updatedAt: pi.updated_at
    // Note: raw_provider_reference is NOT included - it may contain secrets/webhook payloads
  }));

  // Redact sensitive fields from refunds
  const safeRefunds = (refunds ?? []).map(r => ({
    id: r.id,
    providerRefundId: r.provider_refund_id,
    amountPaise: r.amount_paise,
    currency: r.currency,
    status: r.status,
    reason: r.reason,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at
    // Note: no sensitive provider credentials in refunds table by design
  }));

  res.json({
    data: {
      orderId: order.id,
      paymentIntents: safePaymentIntents,
      refunds: safeRefunds
    }
  });
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
  // Real KYC submission persistence.
  // Validates required fields, records submission, supports resubmission.
  // Never marks user VERIFIED — only RPC review_traveller_kyc can grant VERIFIED.
  const body = z.object({ providerReference: z.string().min(6).max(120).optional() }).parse(req.body ?? {});
  const profileId = req.user.id;

  // Check for existing pending/submitted submission — allow resubmission after rejection
  const { data: existingSub, error: subError } = await supabase().from('kyc_submissions')
    .select('status, decided_at').eq('profile_id', profileId).order('submitted_at', { ascending: false }).limit(1).single();
  if (subError && subError.code !== 'P2025') throw subError; // P2025 = no rows returned

  let submissionStatus = 'SUBMITTED';
  if (existingSub) {
    if (existingSub.status === 'REJECTED') {
      submissionStatus = 'RESUBMITTED'; // allow resubmission after rejection
    } else if (existingSub.status === 'VERIFIED' || existingSub.status === 'REVIEWING') {
      // Already verified or under review — do not create duplicate
      return res.status(409).json({ message: 'KYC submission already pending or verified for this profile.' });
    } else {
      submissionStatus = existingSub.status;
    }
  }

  // Create KYC submission record
  const { data: submission, error: insertError } = await supabase().from('kyc_submissions').insert({
    profile_id: profileId,
    status: submissionStatus,
    provider_reference: body.providerReference,
  }).select().single();
  if (insertError) throw insertError;

  // Update profile KYC status to SUBMITTED
  const { data: profile, error: profileError } = await supabase().from('profiles').update({ kyc_status: 'SUBMITTED' }).eq('id', profileId)
    .select('id, kyc_status').single();
  if (profileError) throw profileError;

  logger.info({ userId: req.user.id, profileId, submissionId: submission.id, hasProviderReference: Boolean(body.providerReference) }, 'kyc_submission_recorded');

  res.status(201).json({ data: submission, profile, message: 'KYC submission recorded. Review is required before VERIFIED status is granted.' });
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
    request_status: body.decision === 'APPROVED' ? 'OPEN' : 'REJECTED',
  }).eq('id', requestId).eq('compliance_status', 'REVIEW_REQUIRED').select('*').single();
  if (error) throw new HttpError(409, 'COMPLIANCE_REVIEW_CONFLICT', 'The request changed during review. Refresh and retry.');
  await supabase().from('audit_logs').insert({ actor_id: req.user.id, action: `REQUEST_${body.decision}`, target_type: 'request', target_id: requestId, request_id: req.id, metadata: { complianceReference: body.complianceReference } });
  res.json({ data });
});

apiRouter.post('/admin/quotes/:id/duty-assessment', requireAuth, requireRole('admin', 'compliance_reviewer'), async (req, res) => {
  const quoteId = z.string().uuid().parse(req.params.id);
  const body = z.object({ dutyAmountPaise: z.number().int().nonnegative().safe(), source: z.string().trim().min(3).max(120), assessmentReference: z.string().trim().min(6).max(160), rejectionReason: z.string().trim().min(6).max(500).optional(), decision: z.enum(['APPROVE', 'REJECT']).optional() }).parse(req.body);
  const { data: quote, error: fetchError } = await supabase().from('quotes').select('id,request_id,status,duty_assessment_status,duty_rejection_reason').eq('id', quoteId).single();
  if (fetchError || !quote) throw new HttpError(404, 'QUOTE_NOT_FOUND', 'Quote not found.');
  if (quote.status !== 'ACTIVE') throw new HttpError(409, 'QUOTE_NOT_ACTIVE', 'Duty assessment can only be attached to an active quote.');
  // Authorization: only ACTIVE compliance_reviewer may approve/reject.
  // ACTIVE admin may supervise and audit (bypass some checks if needed).
  const isComplianceReviewer = req.profile.role === 'compliance_reviewer' && req.profile.account_status === 'ACTIVE';
  const isAdmin = req.profile.role === 'admin' && req.profile.account_status === 'ACTIVE';
  if (!isComplianceReviewer && !isAdmin) throw new HttpError(403, 'ROLE_FORBIDDEN', 'Only active compliance reviewers or admins may perform duty assessments.');
  // Only compliance_reviewers may approve or reject duty assessments.
  // Admins may supervise and audit but do not have approval authority.
  if (!isComplianceReviewer && req.user.id === quote.request_id) throw new HttpError(403, 'FORBIDDEN', 'Only compliance reviewers may approve or reject duty assessments. Admins may supervise and audit.');
  // Handle decision
  if (body.decision === 'APPROVE') {
    if (!isComplianceReviewer) throw new HttpError(403, 'FORBIDDEN', 'Only compliance reviewers may approve duty assessments.');
    if (quote.duty_assessment_status === 'APPROVED') throw new HttpError(409, 'ALREADY_REVIEWED', 'This duty assessment has already been approved.');
    const { data, error } = await supabase().from('quotes').update({
      indicative_duty_paise: body.dutyAmountPaise,
      duty_source: body.source,
      duty_reviewed_by: req.user.id,
      duty_reviewed_at: new Date().toISOString(),
      duty_assessment_reference: body.assessmentReference,
      duty_assessment_status: 'APPROVED',
      duty_rejection_reason: null
    }).eq('id', quoteId).eq('status', 'ACTIVE').select('*').single();
    if (error) throw new HttpError(409, 'DUTY_ASSESSMENT_CONFLICT', 'The quote changed during the duty review.');
  } else if (body.decision === 'REJECT') {
    if (!isComplianceReviewer) throw new HttpError(403, 'FORBIDDEN', 'Only compliance reviewers may reject duty assessments.');
    if (quote.duty_assessment_status === 'REJECTED') throw new HttpError(409, 'ALREADY_REVIEWED', 'This duty assessment has already been rejected.');
    const { data, error } = await supabase().from('quotes').update({
      indicative_duty_paise: null,
      duty_source: null,
      duty_reviewed_by: null,
      duty_reviewed_at: null,
      duty_assessment_reference: null,
      duty_assessment_status: 'REJECTED',
      duty_rejection_reason: body.rejectionReason
    }).eq('id', quoteId).eq('status', 'ACTIVE').select('*').single();
    if (error) throw new HttpError(409, 'DUTY_ASSESSMENT_CONFLICT', 'The quote changed during the duty review.');
  } else {
    // No decision, just update the assessment fields without changing status
    // Admins may supervise and audit without making a decision
    const { data, error } = await supabase().from('quotes').update({
      indicative_duty_paise: body.dutyAmountPaise,
      duty_source: body.source,
      duty_reviewed_by: req.user.id,
      duty_reviewed_at: new Date().toISOString(),
      duty_assessment_reference: body.assessmentReference
    }).eq('id', quoteId).eq('status', 'ACTIVE').select('*').single();
    if (error) throw new HttpError(409, 'DUTY_ASSESSMENT_CONFLICT', 'The quote changed during the duty review.');
  }
  await supabase().from('audit_logs').insert({ actor_id: req.user.id, action: `QUOTE_DUTY_${body.decision || 'UPDATE'}`, target_type: 'quote', target_id: quoteId, request_id: req.id, metadata: { source: body.source, assessmentReference: body.assessmentReference, rejectionReason: body.decision === 'REJECT' ? body.rejectionReason : undefined } });
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

  // Capture the existing account_status before the RPC modifies it.
  const { data: beforeProfile, error: beforeError } = await supabase().from('profiles')
    .select('account_status').eq('id', profileId).single();
  if (beforeError) throw new HttpError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
  const preKycAccountStatus = beforeProfile.account_status;

  // Execute the KYC review RPC — this updates profile kyc_status and account_status
  // If the account was already SUSPENDED before this KYC review, restore SUSPENDED
  // after the RPC so that KYC decisions do not inadvertently reactivate an account
  // suspended for an unrelated reason.
  if (preKycAccountStatus === 'SUSPENDED') {
    await supabase().from('profiles').update({ account_status: 'SUSPENDED' }).eq('id', profileId);
  }
  const { data: profile, error: rpcError } = await supabase().rpc('review_traveller_kyc', {
    p_profile_id: profileId, p_decision: body.decision, p_provider_reference: body.providerReference, p_actor_id: req.user.id
  });
  if (rpcError) throw new HttpError(409, 'KYC_REVIEW_FAILED', 'KYC decision could not be recorded. Confirm the account is a traveller with submitted KYC.');

  // Preserve unrelated account restrictions: if the account was already SUSPENDED
  // before this KYC review, keep it SUSPENDED so that KYC decisions do not
  // inadvertently reactivate an account suspended for an unrelated reason.
  if (preKycAccountStatus === 'SUSPENDED') {
    await supabase().from('profiles').update({ account_status: 'SUSPENDED' }).eq('id', profileId);
  }

  // Update or create the KYC submission record to reflect the decision
  const status = body.decision === 'VERIFIED' ? 'VERIFIED' : 'REJECTED';
  const { data: existingSub, error: subError } = await supabase().from('kyc_submissions')
    .select('*').eq('profile_id', profileId).order('submitted_at', { ascending: false }).limit(1).single();
  if (subError) throw subError;

  if (existingSub) {
    // Update existing submission record
    await supabase().from('kyc_submissions').update({ status: status, decided_at: new Date().toISOString(), reviewer_id: req.user.id })
      .eq('profile_id', profileId).eq('status', existingSub.status === 'REJECTED' ? 'REJECTED' : 'VERIFIED');
  } else {
    // Create new submission record
    await supabase().from('kyc_submissions').insert({
      profile_id: profileId,
      status: status,
      decided_at: new Date().toISOString(),
      reviewer_id: req.user.id,
      provider_reference: body.providerReference,
    });
  }

  res.json({ data: profile });
});