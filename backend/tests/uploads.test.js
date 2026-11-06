import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVIDENCE_CATEGORIES,
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  canAccessOrder,
  buildStoragePath,
  storageFolder,
  storageBasename,
  validateUploadRequest,
  isCompletedObject
} from '../src/services/uploads.js';

const order = { id: 'o1', buyer_id: 'b', traveller_id: 't' };

test('canAccessOrder allows participants and admin, nobody else', () => {
  assert.equal(canAccessOrder(order, 'b', 'buyer'), true);
  assert.equal(canAccessOrder(order, 't', 'traveller'), true);
  assert.equal(canAccessOrder(order, 'admin1', 'admin'), true);
  assert.equal(canAccessOrder(order, 'x', 'buyer'), false);
  assert.equal(canAccessOrder(null, 'b', 'buyer'), false);
});

test('storage paths are server-generated and split correctly', () => {
  assert.equal(buildStoragePath('o1', 'u1'), 'orders/o1/u1');
  assert.equal(storageFolder('orders/o1/u1'), 'orders/o1/');
  assert.equal(storageBasename('orders/o1/u1'), 'u1');
});

test('validateUploadRequest accepts a valid request and normalizes MIME', () => {
  const out = validateUploadRequest({ category: 'PRODUCT_PHOTO', filename: 'a.jpg', mimeType: 'IMAGE/JPEG', sizeBytes: 1024 });
  assert.deepEqual(out, { category: 'PRODUCT_PHOTO', filename: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 1024 });
});

test('validateUploadRequest rejects unsupported categories', () => {
  assert.throws(() => validateUploadRequest({ category: 'NOPE', filename: 'a', mimeType: 'image/png', sizeBytes: 10 }), { code: 'INVALID_EVIDENCE_CATEGORY' });
});

test('validateUploadRequest rejects unsupported MIME types', () => {
  assert.throws(() => validateUploadRequest({ category: 'PRODUCT_PHOTO', filename: 'a', mimeType: 'image/gif', sizeBytes: 10 }), { code: 'UNSUPPORTED_MIME_TYPE' });
});

test('validateUploadRequest rejects oversized files with 413', () => {
  assert.throws(() => validateUploadRequest({ category: 'PRODUCT_PHOTO', filename: 'a', mimeType: 'image/png', sizeBytes: MAX_FILE_BYTES + 1 }), { statusCode: 413, code: 'FILE_TOO_LARGE' });
});

test('validateUploadRequest rejects non-positive or non-integer sizes', () => {
  assert.throws(() => validateUploadRequest({ category: 'PRODUCT_PHOTO', filename: 'a', mimeType: 'image/png', sizeBytes: 0 }), { code: 'INVALID_FILE_SIZE' });
  assert.throws(() => validateUploadRequest({ category: 'PRODUCT_PHOTO', filename: 'a', mimeType: 'image/png', sizeBytes: -5 }), { code: 'INVALID_FILE_SIZE' });
  assert.throws(() => validateUploadRequest({ category: 'PRODUCT_PHOTO', filename: 'a', mimeType: 'image/png', sizeBytes: 10.5 }), { code: 'INVALID_FILE_SIZE' });
});

test('validateUploadRequest rejects bad filenames', () => {
  assert.throws(() => validateUploadRequest({ category: 'PRODUCT_PHOTO', filename: '', mimeType: 'image/png', sizeBytes: 10 }), { code: 'INVALID_FILENAME' });
  assert.throws(() => validateUploadRequest({ category: 'PRODUCT_PHOTO', filename: 'x'.repeat(256), mimeType: 'image/png', sizeBytes: 10 }), { code: 'INVALID_FILENAME' });
});

test('every allowed category and MIME is accepted', () => {
  for (const category of EVIDENCE_CATEGORIES) {
    assert.doesNotThrow(() => validateUploadRequest({ category, filename: 'a.png', mimeType: 'image/png', sizeBytes: 1 }));
  }
  for (const mime of ALLOWED_MIME_TYPES) {
    assert.doesNotThrow(() => validateUploadRequest({ category: 'PRODUCT_PHOTO', filename: 'a', mimeType: mime, sizeBytes: 1 }));
  }
});

test('isCompletedObject confirms existence and size match', () => {
  assert.equal(isCompletedObject({ metadata: { size: 100 } }, 100), true);
  assert.equal(isCompletedObject({ metadata: { size: 99 } }, 100), false);
  assert.equal(isCompletedObject({ metadata: {} }, 100), true);      // size absent -> existence only
  assert.equal(isCompletedObject({ metadata: null }, 100), true);    // metadata absent -> existence only
  assert.equal(isCompletedObject(null, 100), false);                 // no object at all
});
