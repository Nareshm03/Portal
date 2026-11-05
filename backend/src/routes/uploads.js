import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getSupabase } from '../config/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';
import { logger } from '../config/logger.js';
import {
  EVIDENCE_BUCKET,
  EVIDENCE_CATEGORIES,
  SIGNED_URL_TTL_SECONDS,
  canAccessOrder,
  buildStoragePath,
  storageFolder,
  storageBasename,
  validateUploadRequest,
  isCompletedObject
} from '../services/uploads.js';

export const uploadRouter = Router();
const supabase = () => getSupabase();

async function getOrderOr404(orderId) {
  const { data, error } = await supabase().from('orders')
    .select('id, buyer_id, traveller_id').eq('id', orderId).single();
  if (error || !data) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  return data;
}

function authorizeOrder(order, req) {
  if (!canAccessOrder(order, req.user.id, req.profile?.role)) {
    throw new HttpError(403, 'FORBIDDEN', 'You do not have access to evidence for this order.');
  }
}

// Step 1: server generates a storage path and a signed upload URL. A PENDING
// evidence record is created so the subsequent /complete call can verify and persist.
uploadRouter.post('/orders/:id/uploads/sign', requireAuth, requireRole('buyer', 'traveller', 'admin'), async (req, res) => {
  const orderId = z.string().uuid().parse(req.params.id);
  const order = await getOrderOr404(orderId);
  authorizeOrder(order, req);

  const validated = validateUploadRequest(req.body ?? {});
  const uploadId = randomUUID();
  const storagePath = buildStoragePath(orderId, uploadId);

  const { data: signed, error: signError } = await supabase().storage.from(EVIDENCE_BUCKET).createSignedUploadUrl(storagePath);
  if (signError || !signed) {
    logger.error({ err: signError, orderId, storagePath, errorName: signError?.constructor?.name, errorMessage: signError?.message, errorStatus: signError?.statusCode, hasSigned: !!signed }, 'signed_upload_url_failed');
    throw new HttpError(503, 'UPLOAD_SIGN_FAILED', 'Could not create a signed upload URL.', { cause: signError?.message });
  }

  const { data: evidence, error: insertError } = await supabase().from('order_evidence').insert({
    id: uploadId,
    order_id: orderId,
    uploader_id: req.user.id,
    category: validated.category,
    original_filename: validated.filename,
    mime_type: validated.mimeType,
    size_bytes: validated.sizeBytes,
    storage_path: storagePath,
    status: 'PENDING'
  }).select('id, order_id, uploader_id, category, original_filename, mime_type, size_bytes, storage_path, status, created_at')
    .single();
  if (insertError) throw insertError;

  res.status(201).json({
    data: {
      ...evidence,
      bucket: EVIDENCE_BUCKET,
      path: signed.path ?? storagePath,
      token: signed.token,
      uploadUrl: signed.signedUrl,
      expiresIn: 600
    },
    warning: 'Upload directly to uploadUrl using the token (Storage SDK: uploadToSignedUrl(path, token, file)). No public URL is exposed.'
  });
});

// Step 2: verify the object actually landed in Storage, then mark the record COMPLETED.
uploadRouter.post('/orders/:id/uploads/complete', requireAuth, requireRole('buyer', 'traveller', 'admin'), async (req, res) => {
  const orderId = z.string().uuid().parse(req.params.id);
  const order = await getOrderOr404(orderId);
  authorizeOrder(order, req);

  const { uploadId } = z.object({ uploadId: z.string().uuid() }).parse(req.body ?? {});
  const { data: evidence, error: evError } = await supabase().from('order_evidence')
    .select('*').eq('id', uploadId).eq('order_id', orderId).eq('uploader_id', req.user.id).eq('status', 'PENDING').single();
  if (evError || !evidence) throw new HttpError(404, 'UPLOAD_NOT_FOUND', 'No pending upload found for this order and uploader.');

  const folder = storageFolder(evidence.storage_path);
  const baseName = storageBasename(evidence.storage_path);
  const { data: files, error: listError } = await supabase().storage.from(EVIDENCE_BUCKET).list(folder, { limit: 100, search: baseName });
  if (listError) {
    logger.error({ err: listError, orderId, storagePath: evidence.storage_path }, 'upload_verify_list_failed');
    throw new HttpError(503, 'UPLOAD_VERIFY_FAILED', 'Could not verify the uploaded object.', { cause: listError.message });
  }
  const obj = (files ?? []).find((f) => f.name === baseName);
  if (!isCompletedObject(obj, evidence.size_bytes)) {
    throw new HttpError(409, 'UPLOAD_NOT_COMPLETED', 'The file has not been uploaded to storage yet, or its size does not match the declared size.');
  }

  const { data: updated, error: updError } = await supabase().from('order_evidence')
    .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
    .eq('id', evidence.id).eq('status', 'PENDING')
    .select('id, order_id, uploader_id, category, original_filename, mime_type, size_bytes, storage_path, status, created_at, completed_at')
    .single();
  if (updError) throw new HttpError(409, 'UPLOAD_COMPLETE_CONFLICT', 'The upload could not be marked complete. It may have already been processed.');

  res.json({ data: updated });
});

// List completed evidence for an order (metadata only — never a public URL).
uploadRouter.get('/orders/:id/uploads', requireAuth, requireRole('buyer', 'traveller', 'admin'), async (req, res) => {
  const orderId = z.string().uuid().parse(req.params.id);
  const order = await getOrderOr404(orderId);
  authorizeOrder(order, req);

  const { data, error } = await supabase().from('order_evidence')
    .select('id, order_id, uploader_id, category, original_filename, mime_type, size_bytes, status, created_at, completed_at')
    .eq('order_id', orderId).eq('status', 'COMPLETED')
    .order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  res.json({ data });
});

// Short-lived signed download URL for a single evidence object.
uploadRouter.get('/uploads/:uploadId/download-url', requireAuth, requireRole('buyer', 'traveller', 'admin'), async (req, res) => {
  const uploadId = z.string().uuid().parse(req.params.uploadId);
  const { data: evidence, error } = await supabase().from('order_evidence')
    .select('id, order_id, storage_path, original_filename, status').eq('id', uploadId).single();
  if (error || !evidence) throw new HttpError(404, 'UPLOAD_NOT_FOUND', 'Upload not found.');
  if (evidence.status !== 'COMPLETED') throw new HttpError(409, 'UPLOAD_NOT_COMPLETED', 'Only completed uploads can be downloaded.');

  const order = await getOrderOr404(evidence.order_id);
  authorizeOrder(order, req);

  const { data: signed, error: signError } = await supabase().storage.from(EVIDENCE_BUCKET)
    .createSignedUrl(evidence.storage_path, SIGNED_URL_TTL_SECONDS, { download: evidence.original_filename });
  if (signError || !signed) {
    logger.error({ err: signError, uploadId }, 'signed_download_url_failed');
    throw new HttpError(503, 'DOWNLOAD_URL_FAILED', 'Could not create a signed download URL.', { cause: signError.message });
  }
  res.json({ data: { uploadId, downloadUrl: signed.signedUrl, filename: evidence.original_filename, expiresIn: SIGNED_URL_TTL_SECONDS }, warning: 'Short-lived signed URL. Do not share publicly; it expires shortly.' });
});
