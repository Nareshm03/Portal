import { HttpError } from '../utils/httpError.js';

/** Pure validation + authorization helpers for secure evidence uploads.
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

/** KYC-specific evidence categories (distinct from order evidence) */
export const KYC_EVIDENCE_CATEGORIES = [
  'IDENTITY_DOCUMENT',
  'RESIDENCY_PROOF',
  'TRAVEL_DOCUMENT',
  'HEALTH_CERTIFICATE',
  'ADDITIONAL_KYC'
];

export const KYC_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf'
];
export const KYC_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const KYC_SIGNED_URL_TTL_SECONDS = 300;
export const SIGNED_URL_TTL_SECONDS = 300;

/** Validate a KYC document upload request. Throws HttpError on failure.
 * Accepts an optional kycSubmissionId; if provided, the caller is responsible
 * for verifying that it belongs to the authenticated profile (route-level check).
 */
export function validateKycUploadRequest({ category, filename, mimeType, sizeBytes, kycSubmissionId } = {}) {
  if (!KYC_EVIDENCE_CATEGORIES.includes(category)) {
    throw new HttpError(400, 'INVALID_KYC_EVIDENCE_CATEGORY', `category must be one of: ${KYC_EVIDENCE_CATEGORIES.join(', ')}`);
  }
  const mime = String(mimeType ?? '').trim().toLowerCase();
  if (!KYC_ALLOWED_MIME_TYPES.includes(mime)) {
    throw new HttpError(400, 'UNSUPPORTED_KYC_MIME_TYPE', `MIME type ${mimeType} is not allowed for KYC documents.`);
  }
  const size = Number(sizeBytes);
  if (!Number.isInteger(size) || size <= 0) {
    throw new HttpError(400, 'INVALID_KYC_FILE_SIZE', 'sizeBytes must be a positive integer.');
  }
  if (size > KYC_MAX_FILE_BYTES) {
    throw new HttpError(413, 'KYC_FILE_TOO_LARGE', `File exceeds the ${KYC_MAX_FILE_BYTES} byte limit for KYC documents.`);
  }
  const name = String(filename ?? '').trim();
  if (name.length < 1 || name.length > 255) {
    throw new HttpError(400, 'INVALID_KYC_FILENAME', 'filename must be 1–255 characters.');
  }
  return { category, filename: name, mimeType: mime, sizeBytes: size, kycSubmissionId };
}

/** Validate an order evidence upload request. Normalizes MIME type to lowercase. */
export function validateUploadRequest({ category, filename, mimeType, sizeBytes } = {}) {
  if (!EVIDENCE_CATEGORIES.includes(category)) {
    throw new HttpError(400, 'INVALID_EVIDENCE_CATEGORY', `category must be one of: ${EVIDENCE_CATEGORIES.join(', ')}`);
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
  const name = String(filename ?? '').trim();
  if (name.length < 1 || name.length > 255) {
    throw new HttpError(400, 'INVALID_FILENAME', 'filename must be 1–255 characters.');
  }
  return { category, filename: name, mimeType: mime, sizeBytes: size };
}

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

/** Storage basename from a server-generated path. */
export function storageBasename(storagePath) {
  return String(storagePath).split('/').pop();
}

/** Confirm a Storage object exists and matches the declared size before the
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