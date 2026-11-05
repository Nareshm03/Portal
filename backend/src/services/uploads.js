import { HttpError } from '../utils/httpError.js';

/**
 * Pure validation + authorization helpers for secure evidence uploads.
 * Storage paths are always generated server-side; the route layer performs
 * the actual Supabase Storage IO. These functions are unit-testable without a
 * live Supabase instance.
 */

export const EVIDENCE_BUCKET = 'order_evidence';
export const EVIDENCE_CATEGORIES = [
  'PURCHASE_RECEIPT',
  'PRODUCT_PHOTO',
  'SERIAL_EVIDENCE',
  'ADDITIONAL_EVIDENCE',
  'ARRIVAL_PROOF',
  'HANDOVER_EVIDENCE'
];
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf'
];
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const SIGNED_URL_TTL_SECONDS = 60;

/** Only the order's buyer/traveller, or an active admin, may touch order evidence. */
export function canAccessOrder(order, userId, role) {
  if (!order) return false;
  return order.buyer_id === userId || order.traveller_id === userId || role === 'admin';
}

/** Server-generated storage path. Never trust a client-supplied path. */
export function buildStoragePath(orderId, uploadId) {
  return `orders/${orderId}/${uploadId}`;
}

/** Parent folder for listing/verifying a single object. */
export function storageFolder(storagePath) {
  const parts = String(storagePath).split('/');
  return parts.slice(0, parts.length - 1).join('/') + '/';
}

export function storageBasename(storagePath) {
  return String(storagePath).split('/').pop();
}

/**
 * Validate a sign request. Throws HttpError with a specific code on any failure
 * (bad category, unsupported MIME, oversized file, invalid filename, etc.).
 */
export function validateUploadRequest({ category, filename, mimeType, sizeBytes } = {}) {
  if (!EVIDENCE_CATEGORIES.includes(category)) {
    throw new HttpError(400, 'INVALID_EVIDENCE_CATEGORY', `category must be one of: ${EVIDENCE_CATEGORIES.join(', ')}`);
  }
  const name = String(filename ?? '').trim();
  if (name.length < 1 || name.length > 255) {
    throw new HttpError(400, 'INVALID_FILENAME', 'filename must be 1–255 characters.');
  }
  const mime = String(mimeType ?? '').trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    throw new HttpError(400, 'UNSUPPORTED_MIME_TYPE', `MIME type ${mimeType} is not allowed.`);
  }
  const size = Number(sizeBytes);
  if (!Number.isInteger(size) || size <= 0) {
    throw new HttpError(400, 'INVALID_FILE_SIZE', 'sizeBytes must be a positive integer.');
  }
  if (size > MAX_FILE_BYTES) {
    throw new HttpError(413, 'FILE_TOO_LARGE', `File exceeds the ${MAX_FILE_BYTES} byte limit.`);
  }
  return { category, filename: name, mimeType: mime, sizeBytes: size };
}

/**
 * Confirm a Storage object exists and matches the declared size before the
 * evidence record is marked COMPLETED. `metadata.size` may be absent in some
 * responses; in that case we only confirm existence (not size).
 */
export function isCompletedObject(fileObject, expectedSize) {
  if (!fileObject) return false;
  const meta = fileObject.metadata;
  if (meta && meta.size != null) {
    return Number(meta.size) === Number(expectedSize);
  }
  return true; // object present, size unverifiable — accept existence only
}
