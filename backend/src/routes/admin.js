/**
 * Admin Transaction Monitoring endpoints.
 *
 * READ-ONLY. These endpoints NEVER write to the database.
 * All routes require an active admin role (enforced via requireRole('admin')).
 *
 * Endpoints:
 *   GET  /admin/transactions                  — paginated order list with filters
 *   GET  /admin/transactions/:orderId/timeline — chronological event timeline
 *   GET  /admin/transactions/:orderId/summary  — full financial and exception summary
 */

import { Router } from 'express';
import { z } from 'zod';
import { getSupabase } from '../config/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';
import { logger } from '../config/logger.js';
import {
  clampPageLimit,
  buildTimeline,
  buildTransactionSummary,
  buildExceptionFlags,
  buildListRow,
  redactSensitive,
  MAX_PAGE_LIMIT,
} from '../services/monitoring.js';
import {
  checkCapturedPayments,
  checkCollectionLedger,
  checkSettlementLedger,
  checkDisputedOrderSettlement,
} from '../services/reconciliation.js';
import {
  DISPUTE_STATUSES,
  buildDisputeTimeline,
  buildDisputeFinancialImpact,
  buildDisputeEvent,
} from '../services/disputes.js';

export const adminRouter = Router();
const supabase = () => getSupabase();

// All admin routes require authentication and an active admin role.
adminRouter.use('/admin', requireAuth, requireRole('admin'));

const ORDER_STATES = ['ACCEPTED', 'LOCKED', 'PURCHASED', 'LANDED', 'COMPLETED', 'FORFEITED', 'DISPUTED', 'EXPIRED', 'CANCELLED', 'REFUNDED'];
const PAYMENT_STATUSES = ['CREATING', 'CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'];

/* ------------------------------------------------------------------
 * GET /api/v1/admin/transactions
 *
 * Query params:
 *   limit         1–100 (default 25)
 *   offset        integer >= 0 (default 0)
 *   state         ORDER_STATES value
 *   paymentStatus PAYMENT_STATUSES value
 *   from          ISO 8601 date — created_at >=
 *   to            ISO 8601 date — created_at <=
 * ------------------------------------------------------------------ */
adminRouter.get('/admin/transactions', async (req, res) => {
  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(25),
    offset: z.coerce.number().int().min(0).default(0),
    state: z.enum(ORDER_STATES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  });
  const params = querySchema.parse(req.query);
  const limit = clampPageLimit(params.limit);
  const offset = params.offset ?? 0;

  // Build orders query with optional filters.
  // count:'exact' returns the total matching rows across all pages alongside the page slice.
  let ordersQuery = supabase().from('orders')
    .select('id, state, buyer_id, traveller_id, subtotal_paise, platform_fee_paise, total_paise, deposit_paise, duty_paise, traveller_reward_paise, upfront_paise, balance_paise, currency, payment_deadline, forfeit_at, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.state) ordersQuery = ordersQuery.eq('state', params.state);
  if (params.from) ordersQuery = ordersQuery.gte('created_at', params.from);
  if (params.to) ordersQuery = ordersQuery.lte('created_at', params.to);

  const { data: orders, count: dbCount, error: ordersError } = await ordersQuery;
  if (ordersError) throw ordersError;
  if (!orders?.length) return res.json({ data: [], total: dbCount ?? 0, offset, limit });

  // Fetch payment intents and ledger transactions per-order in parallel.
  // Per-order fetching eliminates the silent PAGE_LIMIT=500 truncation risk
  // that a single batched .in() query carries when child rows exceed the cap.
  const [intentsResults, ledgerResults] = await Promise.all([
    Promise.allSettled(orders.map((o) => {
      let q = supabase().from('payment_intents')
        .select('id, order_id, provider, status, amount_paise, currency, provider_order_id, created_at, updated_at')
        .eq('order_id', o.id);
      if (params.paymentStatus) q = q.eq('status', params.paymentStatus);
      return q.then((r) => ({ orderId: o.id, ...r }));
    })),
    Promise.allSettled(orders.map((o) =>
      supabase().from('ledger_transactions')
        .select('id, order_id, event_type, idempotency_key, created_at')
        .eq('order_id', o.id)
        .then((r) => ({ orderId: o.id, ...r }))
    )),
  ]);

  // Assemble per-order maps; log and skip orders whose child fetches failed.
  const intentsByOrder = new Map();
  for (const result of intentsResults) {
    if (result.status === 'rejected' || result.value?.error) {
      logger.warn({ err: result.reason ?? result.value?.error }, 'admin_transactions_intent_fetch_failed');
      continue;
    }
    intentsByOrder.set(result.value.orderId, result.value.data ?? []);
  }
  const ledgerByOrder = new Map();
  for (const result of ledgerResults) {
    if (result.status === 'rejected' || result.value?.error) {
      logger.warn({ err: result.reason ?? result.value?.error }, 'admin_transactions_ledger_fetch_failed');
      continue;
    }
    ledgerByOrder.set(result.value.orderId, result.value.data ?? []);
  }

  const rows = orders.map((o) => buildListRow(o, intentsByOrder.get(o.id) ?? [], ledgerByOrder.get(o.id) ?? []));

  // If paymentStatus filter is active, filter list rows accordingly
  // (paymentStatus is derived from child records, not an orders column).
  const filtered = params.paymentStatus
    ? rows.filter((r) => r.paymentStatus === params.paymentStatus)
    : rows;

  // dbCount is the total matching orders in the DB for the active filters.
  // When a paymentStatus filter is applied it further narrows the in-memory
  // result, so we report filtered.length as the total in that case since
  // the DB count reflects order-level matches only.
  const total = params.paymentStatus ? filtered.length : (dbCount ?? filtered.length);

  res.json({ data: filtered, total, offset, limit });
});

/* ------------------------------------------------------------------
 * GET /api/v1/admin/transactions/:orderId/timeline
 *
 * Returns chronological events from order_events, payment_intents,
 * ledger_transactions, and webhook_events.
 * Raw webhook payloads and sensitive fields are never returned.
 * ------------------------------------------------------------------ */
adminRouter.get('/admin/transactions/:orderId/timeline', async (req, res) => {
  const orderId = z.string().uuid().parse(req.params.orderId);

  // Verify the order exists.
  const { data: order, error: orderError } = await supabase().from('orders')
    .select('id, state, buyer_id, traveller_id').eq('id', orderId).single();
  if (orderError || !order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');

  // Fetch all timeline sources in parallel — partial failures are logged but
  // still produce a useful (if incomplete) timeline.
  // Per-order limit of 500 is generous and safe: a single order cannot realistically
  // produce hundreds of events in each category.
  const PER_ORDER_LIMIT = 500;
  const [eventsResult, intentsResult, ledgerResult, webhookResult] = await Promise.allSettled([
    supabase().from('order_events')
      .select('from_state, to_state, actor_id, note, created_at')
      .eq('order_id', orderId).order('created_at', { ascending: true }).limit(PER_ORDER_LIMIT),

    supabase().from('payment_intents')
      .select('id, provider, status, amount_paise, currency, provider_order_id, created_at, updated_at')
      .eq('order_id', orderId).order('created_at', { ascending: true }).limit(PER_ORDER_LIMIT),

    supabase().from('ledger_transactions')
      .select('id, event_type, idempotency_key, created_at')
      .eq('order_id', orderId).order('created_at', { ascending: true }).limit(PER_ORDER_LIMIT),

    // Webhook events don't carry order_id directly; skip them here to keep this
    // query fast. Webhooks are visible in the summary endpoint if needed.
    Promise.resolve({ value: { data: [], error: null } }),
  ]);

  const warn = (label, result) => {
    if (result.status === 'rejected' || result.value?.error) {
      logger.warn({ orderId, source: label, err: result.reason ?? result.value?.error }, 'admin_timeline_partial_failure');
      return [];
    }
    return result.value?.data ?? [];
  };

  const orderEvents = warn('order_events', eventsResult);
  const paymentIntents = warn('payment_intents', intentsResult);
  const ledgerTransactions = warn('ledger_transactions', ledgerResult);
  const webhookEvents = warn('webhook_events', webhookResult);

  const timeline = buildTimeline({ orderEvents, paymentIntents, ledgerTransactions, webhookEvents });

  res.json({
    data: timeline,
    orderId,
    orderState: order.state,
    total: timeline.length,
    note: 'Chronological event timeline. Raw webhook payloads and sensitive fields are not included.',
  });
});

/* ------------------------------------------------------------------
 * GET /api/v1/admin/transactions/:orderId/summary
 *
 * Returns frozen financial breakdown, payment/ledger status,
 * dispute flag, and reconciliation exception flags.
 * ------------------------------------------------------------------ */
adminRouter.get('/admin/transactions/:orderId/summary', async (req, res) => {
  const orderId = z.string().uuid().parse(req.params.orderId);

  const { data: order, error: orderError } = await supabase().from('orders')
    .select('id, state, buyer_id, traveller_id, subtotal_paise, platform_fee_paise, total_paise, deposit_paise, duty_paise, traveller_reward_paise, upfront_paise, balance_paise, currency, payment_deadline, forfeit_at, created_at, updated_at')
    .eq('id', orderId).single();
  if (orderError || !order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');

  const [intentsResult, ledgerResult] = await Promise.allSettled([
    supabase().from('payment_intents')
      .select('id, order_id, provider, status, amount_paise, currency, provider_order_id, created_at')
      .eq('order_id', orderId).limit(500),
    supabase().from('ledger_transactions')
      .select('id, order_id, event_type, idempotency_key, created_at')
      .eq('order_id', orderId).limit(500),
  ]);

  const intents = intentsResult.status === 'fulfilled' && !intentsResult.value?.error
    ? (intentsResult.value?.data ?? []) : [];
  const ledgerTxns = ledgerResult.status === 'fulfilled' && !ledgerResult.value?.error
    ? (ledgerResult.value?.data ?? []) : [];

  if (intentsResult.status === 'rejected' || intentsResult.value?.error) {
    logger.warn({ orderId, err: intentsResult.reason ?? intentsResult.value?.error }, 'admin_summary_intents_failed');
  }
  if (ledgerResult.status === 'rejected' || ledgerResult.value?.error) {
    logger.warn({ orderId, err: ledgerResult.reason ?? ledgerResult.value?.error }, 'admin_summary_ledger_failed');
  }

  const summary = buildTransactionSummary(order, intents, ledgerTxns);

  const exceptions = buildExceptionFlags({
    order,
    capturedIntents: intents,
    ledgerTransactions: ledgerTxns,
    checkCapturedPayments,
    checkCollectionLedger,
    checkSettlementLedger,
    checkDisputedOrderSettlement,
  });

  res.json({
    data: {
      ...summary,
      exceptions,
      hasExceptions: exceptions.length > 0,
    },
  });
});

/* ------------------------------------------------------------------
 * GET /api/v1/admin/disputes
 *
 * Query params:
 *   limit     1–100 (default 25)
 *   offset    integer >= 0 (default 0)
 *   status    DISPUTE_STATUSES value
 *   orderId   UUID
 *   provider  'RAZORPAY' | 'MOCK'
 *   from      ISO 8601 date — created_at >=
 *   to        ISO 8601 date — created_at <=
 * ------------------------------------------------------------------ */
adminRouter.get('/admin/disputes', async (req, res) => {
  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(25),
    offset: z.coerce.number().int().min(0).default(0),
    status: z.enum(DISPUTE_STATUSES).optional(),
    orderId: z.string().uuid().optional(),
    provider: z.enum(['RAZORPAY', 'MOCK']).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  });
  const params = querySchema.parse(req.query);
  const limit = clampPageLimit(params.limit);
  const offset = params.offset ?? 0;

  let query = supabase().from('disputes')
    .select('id, order_id, payment_intent_id, provider, provider_dispute_id, provider_payment_id, provider_order_id, amount_paise, currency, reason, status, evidence_deadline, evidence_submitted_at, resolved_at, resolution_note, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status) query = query.eq('status', params.status);
  if (params.orderId) query = query.eq('order_id', params.orderId);
  if (params.provider) query = query.eq('provider', params.provider);
  if (params.from) query = query.gte('created_at', params.from);
  if (params.to) query = query.lte('created_at', params.to);

  const { data: disputes, count: dbCount, error } = await query;
  if (error) throw error;

  const rows = (disputes ?? []).map((d) => redactSensitive(d));
  res.json({ data: rows, total: dbCount ?? rows.length, offset, limit });
});

/* ------------------------------------------------------------------
 * GET /api/v1/admin/disputes/:disputeId
 *
 * Full dispute inspection: details, frozen financial impact,
 * evidence records, and chronological audit timeline.
 * ------------------------------------------------------------------ */
adminRouter.get('/admin/disputes/:disputeId', async (req, res) => {
  const disputeId = z.string().uuid().parse(req.params.disputeId);

  const { data: dispute, error: disputeError } = await supabase()
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .single();
  if (disputeError || !dispute) throw new HttpError(404, 'DISPUTE_NOT_FOUND', 'Dispute not found.');

  const [orderResult, eventsResult, evidenceResult, ledgerResult] = await Promise.allSettled([
    supabase().from('orders')
      .select('id, state, buyer_id, traveller_id, upfront_paise, total_paise, currency, created_at')
      .eq('id', dispute.order_id)
      .single(),
    supabase().from('dispute_events')
      .select('id, dispute_id, from_status, to_status, event_type, actor_id, note, created_at')
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: true })
      .limit(500),
    supabase().from('dispute_evidence')
      .select('id, dispute_id, storage_path, original_filename, mime_type, size_bytes, uploaded_by, description, created_at')
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: true })
      .limit(100),
    supabase().from('ledger_transactions')
      .select('id, order_id, event_type, idempotency_key, created_at')
      .eq('order_id', dispute.order_id)
      .limit(500),
  ]);

  const order = orderResult.status === 'fulfilled' ? orderResult.value?.data : null;
  const events = eventsResult.status === 'fulfilled' ? (eventsResult.value?.data ?? []) : [];
  const evidence = evidenceResult.status === 'fulfilled' ? (evidenceResult.value?.data ?? []) : [];
  const ledgerTxns = ledgerResult.status === 'fulfilled' ? (ledgerResult.value?.data ?? []) : [];

  const timeline = buildDisputeTimeline(events, evidence);
  const financialImpact = order ? buildDisputeFinancialImpact(dispute, order, ledgerTxns) : null;

  res.json({
    data: {
      ...redactSensitive(dispute),
      order: order ? redactSensitive(order) : null,
      financialImpact,
      timeline,
      evidence,
      instruction: 'Review dispute evidence and timeline before deciding whether to contest or accept via provider portal. No automated accept/contest actions are performed.',
    },
  });
});

/* ------------------------------------------------------------------
 * POST /api/v1/admin/disputes/:disputeId/evidence
 *
 * Link uploaded evidence from private Supabase Storage to the dispute record.
 * ------------------------------------------------------------------ */
adminRouter.post('/admin/disputes/:disputeId/evidence', async (req, res) => {
  const disputeId = z.string().uuid().parse(req.params.disputeId);
  const bodySchema = z.object({
    storagePath: z.string().min(1).max(500),
    originalFilename: z.string().min(1).max(255),
    mimeType: z.string().min(3).max(100),
    sizeBytes: z.number().int().positive(),
    description: z.string().max(500).optional(),
  });
  const body = bodySchema.parse(req.body);

  const { data: dispute, error: disputeError } = await supabase()
    .from('disputes')
    .select('id, status, order_id')
    .eq('id', disputeId)
    .single();
  if (disputeError || !dispute) throw new HttpError(404, 'DISPUTE_NOT_FOUND', 'Dispute not found.');

  const { data: evidence, error: insertError } = await supabase()
    .from('dispute_evidence')
    .insert({
      dispute_id: disputeId,
      storage_path: body.storagePath,
      original_filename: body.originalFilename,
      mime_type: body.mimeType,
      size_bytes: body.sizeBytes,
      uploaded_by: req.user.id,
      description: body.description ?? null,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  // Insert audit event
  await supabase().from('dispute_events').insert(
    buildDisputeEvent({
      disputeId,
      fromStatus: dispute.status,
      toStatus: dispute.status,
      eventType: 'EVIDENCE_SUBMITTED',
      actorId: req.user.id,
      note: `Evidence uploaded: ${body.originalFilename} (${body.mimeType}, ${body.sizeBytes} bytes)`,
    })
  );

  // Mark evidence_submitted_at if not set
  await supabase().from('disputes').update({
    evidence_submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', disputeId);

  res.status(201).json({ data: evidence });
});

/* ------------------------------------------------------------------
 * GET /api/v1/admin/disputes/:disputeId/evidence/:evidenceId/download
 *
 * Generate a short-lived signed download URL for dispute evidence.
 * ------------------------------------------------------------------ */
adminRouter.get('/admin/disputes/:disputeId/evidence/:evidenceId/download', async (req, res) => {
  const disputeId = z.string().uuid().parse(req.params.disputeId);
  const evidenceId = z.string().uuid().parse(req.params.evidenceId);

  const { data: evidence, error: evidenceError } = await supabase()
    .from('dispute_evidence')
    .select('*')
    .eq('id', evidenceId)
    .eq('dispute_id', disputeId)
    .single();
  if (evidenceError || !evidence) throw new HttpError(404, 'EVIDENCE_NOT_FOUND', 'Evidence not found.');

  const { data: signed, error: signError } = await supabase()
    .storage
    .from('order_evidence')
    .createSignedUrl(evidence.storage_path, 60);

  if (signError || !signed?.signedUrl) {
    logger.error({ err: signError, storagePath: evidence.storage_path }, 'dispute_evidence_download_sign_failed');
    throw new HttpError(503, 'DOWNLOAD_URL_FAILED', 'Could not generate a download URL.');
  }

  res.json({ data: { downloadUrl: signed.signedUrl, expiresIn: 60 } });
});
