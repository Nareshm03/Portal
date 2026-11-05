import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getSupabase } from '../config/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';
import { logger } from '../config/logger.js';
import {
  EVIDENCE_BUCKET,
  KYC_EVIDENCE_CATEGORIES,
  KYC_ALLOWED_MIME_TYPES,
  KYC_MAX_FILE_BYTES,
  KYC_SIGNED_URL_TTL_SECONDS,
  SIGNED_URL_TTL_SECONDS,
  validateKycUploadRequest
} from '../services/uploads.js';

export const uploadRouter = Router();
const supabase = () => getSupabase();

/** Get a KYC submission by ID, checking ownership. */
async function getKycSubmissionOr404(submissionId, req) {
  const { data, error } = await supabase().from('kyc_submissions')
    .select('profile_id').eq('id', submissionId).single();
  if (error || !data) throw new HttpError(404, 'KYC_SUBMISSION_NOT_FOUND', 'KYC submission not found.');
  if (data.profile_id !== req.user.id) {
    throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this KYC submission.');
  }
  return data;
}

/** Authorize access to a KYC submission's evidence documents. */
function authoriseKycSubmission(submission, req) {
  if (submission.profile_id !== req.user.id) {
    throw new HttpError(403, 'FORBIDDEN', 'You do not have access to evidence for this KYC submission.');
  }
}

/** Server-generated storage path for KYC documents. */
function buildKycStoragePath(kycSubmissionId, uploadId) {
  return `kyc/${kycSubmissionId}/${uploadId}`;
}

// ============================================================================
// KYC Document Upload Routes
// ============================================================================

// Step 1: server generates a storage path and a signed upload URL. A PENDING
// evidence record is created so the subsequent /complete call can verify and persist.
uploadRouter.post('/kyc-submissions/:submissionId/uploads/sign', requireAuth, async (req, res) => {
  const submissionId = z.string().uuid().parse(req.params.submissionId);
  const submission = await getKycSubmissionOr404(submissionId, req);

  const validated = validateKycUploadRequest(req.body ?? {});
  const category = validated.category;
  const filename = validated.filename;
  const mimeType = validated.mimeType;
  const sizeBytes = validated.sizeBytes;

  const uploadId = randomUUID();
  const storagePath = buildKycStoragePath(submissionId, uploadId);

  const { data: signed, error: signError } = supabase().storage.from(EVIDENCE_BUCKET).createSignedUploadUrl(storagePath);
  if (signError || !signed) {
    logger.error({ err: signError, submissionId, storagePath }, 'signed_upload_url_failed');
    throw new HttpError(503, 'UPLOAD_SIGN_FAILED', 'Could not create a signed upload URL.', { cause: signError?.message });
  }

  const { data: evidence, error: insertError } = await supabase().from('kyc_documents').insert({
    id: uploadId,
    kyc_submission_id: submissionId,
    uploader_id: req.user.id,
    category: category,
    original_filename: filename,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    storage_path: storagePath,
    status: 'PENDING'
  }).select('id, kyc_submission_id, uploader_id, category, original_filename, mime_type, size_bytes, storage_path, status, created_at')
    .single();
  if (insertError) throw insertError;

  // Increment document_count atomically using a subquery that only counts COMPLETED documents
  // We'll recalculate below rather than incrementing on sign

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
uploadRouter.post('/kyc-submissions/:submissionId/uploads/complete', requireAuth, async (req, res) => {
  const submissionId = z.string().uuid().parse(req.params.submissionId);
  const submission = await getKycSubmissionOr404(submissionId, req);

  const { uploadId } = z.object({ uploadId: z.string().uuid() }).parse(req.body ?? {});

  const { data: evidence, error: evError } = await supabase().from('kyc_documents')
    .select('*').eq('id', uploadId).eq('kyc_submission_id', submissionId).eq('status', 'PENDING').single();
  if (evError || !evidence) throw new HttpError(404, 'UPLOAD_NOT_FOUND', 'No pending upload found for this KYC submission.');

  const folder = 'kyc/' + submissionId;
  const baseName = evidence.storage_path.split('/').pop();
  const { data: files, error: listError } = supabase().storage.from(EVIDENCE_BUCKET).list(folder, { limit: 100, search: baseName });
  if (listError) {
    logger.error({ err: listError, submissionId, storagePath: evidence.storage_path }, 'upload_verify_list_failed');
    throw new HttpError(503, 'UPLOAD_VERIFY_FAILED', 'Could not verify the uploaded object.', { cause: listError.message });
  }
  const obj = (files ?? []).find((f) => f.name === baseName);
  if (!isCompletedObject(obj, evidence.size_bytes)) {
    throw new HttpError(409, 'UPLOAD_NOT_COMPLETED', 'The file has not been uploaded to storage yet, or its size does not match the declared size.');
  }

  // Mark the document COMPLETED
  const { data: updated, error: updError } = await supabase().from('kyc_documents')
    .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
    .eq('id', uploadId).eq('kyc_submission_id', submissionId).eq('status', 'PENDING')
    .select('id, kyc_submission_id, uploader_id, category, original_filename, mime_type, size_bytes, storage_path, status, created_at, completed_at')
    .single();
  if (updError) throw new HttpError(409, 'UPLOAD_COMPLETE_CONFLICT', 'The upload could not be marked complete. It may have already been processed.');

  // Recalculate document_count: count only COMPLETED documents for this submission
  const { data: countData, error: countError } = await supabase().from('kyc_documents')
    .select('id', { count: 'exact', head: true }).eq('kyc_submission_id', submissionId).eq('status', 'COMPLETED');
  if (countError) throw countError;
  const exactCount = countData || 0;

  // Update the submission's document_count
  await supabase().from('kyc_submissions').update({ document_count: exactCount }).eq('id', submissionId);

  res.json({ data: updated });
});

// List completed KYC evidence documents for a submission (metadata only — never a public URL).
uploadRouter.get('/kyc-submissions/:submissionId/uploads', requireAuth, async (req, res) => {
  const submissionId = z.string().uuid().parse(req.params.submissionId);
  const submission = await getKycSubmissionOr404(submissionId, req);

  const { data, error } = await supabase().from('kyc_documents')
    .select('id, kyc_submission_id, uploader_id, category, original_filename, mime_type, size_bytes, status, created_at, completed_at')
    .eq('kyc_submission_id', submissionId).eq('status', 'COMPLETED')
    .order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  res.json({ data });
});

// Short-lived signed download URL for a single KYC evidence object.
uploadRouter.get('/kyc-submissions/:submissionId/uploads/:uploadId/download-url', requireAuth, async (req, res) => {
  const submissionId = z.string().uuid().parse(req.params.submissionId);
  const uploadId = z.string().uuid().parse(req.params.uploadId);

  // Verify the submission exists and belongs to the authenticated user
  const submission = await getKycSubmissionOr404(submissionId, req);

  const { data: evidence, error } = await supabase().from('kyc_documents')
    .select('id, kyc_submission_id, storage_path, original_filename, status').eq('id', uploadId).eq('kyc_submission_id', submissionId).single();
  if (error || !evidence) throw new HttpError(404, 'UPLOAD_NOT_FOUND', 'Upload not found.');
  if (evidence.status !== 'COMPLETED') throw new HttpError(409, 'UPLOAD_NOT_COMPLETED', 'Only completed uploads can be downloaded.');

  const { data: signed, error: signError } = supabase().storage.from(EVIDENCE_BUCKET)
    .createSignedUrl(evidence.storage_path, SIGNED_URL_TTL_SECONDS, { download: evidence.original_filename });
  if (signError || !signed) {
    logger.error({ err: signError, uploadId, submissionId }, 'signed_download_url_failed');
    throw new HttpError(503, 'DOWNLOAD_URL_FAILED', 'Could not create a signed download URL.', { cause: signError.message });
  }
  res.json({ data: { uploadId, downloadUrl: signed.signedUrl, filename: evidence.original_filename, expiresIn: SIGNED_URL_TTL_SECONDS }, warning: 'Short-lived signed URL. Do not share publicly; it expires shortly.' });
});

// ============================================================================
// Order Evidence Routes (preserved unchanged)
// ============================================================================

// Step 1: server generates a storage path and a signed upload URL. A PENDING
// evidence record is created so the subsequent /complete call can verify and persist.
uploadRouter.post('/orders/:id/uploads/sign', requireAuth, requireRole('buyer', 'traveller', 'admin'), async (req, res) => {
  const orderId = z.string().uuid().parse(req.params.id);
  const order = await getOrderOr404(orderId);
  authorizeOrder(order, req);

  const validated = validateUploadRequest(req.body ?? {});
  const uploadId = randomUUID();
  const storagePath = buildStoragePath(orderId, uploadId);

  const { data: signed, error: signError } = supabase().storage.from(EVIDENCE_BUCKET).createSignedUploadUrl(storagePath);
  if (signError || !signed) {
    logger.error({ err: signError, orderId, storagePath }, 'signed_upload_url_failed');
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
  const { data: files, error: listError } = supabase().storage.from(EVIDENCE_BUCKET).list(folder, { limit: 100, search: baseName });
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
uploadRouter.get('/orders/:id/uploads/:uploadId/download-url', requireAuth, requireRole('buyer', 'traveller', 'admin'), async (req, res) => {
  const uploadId = z.string().uuid().parse(req.params.uploadId);
  const { data: evidence, error } = await supabase().from('order_evidence')
    .select('id, order_id, storage_path, original_filename, status').eq('id', uploadId).single();
  if (error || !evidence) throw new HttpError(404, 'UPLOAD_NOT_FOUND', 'Upload not found.');
  if (evidence.status !== 'COMPLETED') throw new HttpError(409, 'UPLOAD_NOT_COMPLETED', 'Only completed uploads can be downloaded.');

  const order = await getOrderOr404(evidence.order_id);
  authorizeOrder(order, req);

  const { data: signed, error: signError } = supabase().storage.from(EVIDENCE_BUCKET)
    .createSignedUrl(evidence.storage_path, SIGNED_URL_TTL_SECONDS, { download: evidence.original_filename });
  if (signError || !signed) {
    logger.error({ err: signError, uploadId }, 'signed_download_url_failed');
    throw new HttpError(503, 'DOWNLOAD_URL_FAILED', 'Could not create a signed download URL.', { cause: signError.message });
  }
  res.json({ data: { uploadId, downloadUrl: signed.signedUrl, filename: evidence.original_filename, expiresIn: SIGNED_URL_TTL_SECONDS }, warning: 'Short-lived signed URL. Do not share publicly; it expires shortly.' });
});