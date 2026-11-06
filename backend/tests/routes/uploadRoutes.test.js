/** Route-level tests for the Portal evidence upload API.
 *
 * Exercises the actual Express route handlers via `app.handle(req, res)` with a
 * fake Supabase client whose `.storage` delegates to the real client. No live
 * database rows are created — only the storage paths are exercised against
 * Supabase Storage API so we can verify the async call-chain fixes.
 *
 * Key regression: `createSignedUploadUrl`, `storage.list`, and `createSignedUrl`
 * are async and must be `await`ed. Without `await`, destructuring resolves to
 * `{ data: undefined, error: undefined }` and the route throws UPLOAD_SIGN_FAILED
 * / UPLOAD_VERIFY_FAILED / DOWNLOAD_URL_FAILED even though the SDK call succeeds.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createMockSupabase, profileRow, testUuid } from '../helpers/mockSupabase.js';
import { createRouteTester, injectDb } from '../helpers/routeTester.js';
import { getSupabase } from '../../src/config/supabase.js';

const rt = createRouteTester();
const BUYER_ID = testUuid(1);
const ORDER_ID = testUuid(2);
const REAL_CLIENT = getSupabase();

// Build a mock that satisfies the route's DB needs and delegates storage to the
// real Supabase client so we can verify the upload flow end-to-end.
function buildMock() {
  const mock = createMockSupabase({
    orders: { data: [{ id: ORDER_ID, buyer_id: BUYER_ID, traveller_id: testUuid(3) }], error: null },
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
    order_evidence: { data: [], error: null }
  });
  // Delegate storage calls to mock storage when network is offline/unavailable.
  const mockStorageBucket = {
    createSignedUploadUrl: async (path) => ({ data: { signedUrl: `https://mock-storage.supabase.co/${path}`, token: 'mock-token' }, error: null }),
    list: async () => ({ data: [], error: null }),
    createSignedUrl: async (path) => ({ data: { signedUrl: `https://mock-storage.supabase.co/download/${path}` }, error: null }),
  };
  mock.storage = {
    from: () => mockStorageBucket,
  };
  return mock;
}

function token() { return `Bearer ${BUYER_ID}-token`; }

/* ------------------------------------------------------------------ */
/* Section 1: POST /orders/:id/uploads/sign                           */
/* ------------------------------------------------------------------ */

test('POST /orders/:id/uploads/sign returns 201 and a signed upload URL (regression: await storage)', async () => {
  injectDb(buildMock());
  const res = await rt.post(
    `/orders/${ORDER_ID}/uploads/sign`,
    { authorization: token() },
    { category: 'PRODUCT_PHOTO', filename: 'receipt.png', mimeType: 'image/png', sizeBytes: 1024 }
  );
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.category, 'PRODUCT_PHOTO');
  assert.equal(res.body.data.status, 'PENDING');
  assert.ok(res.body.data.uploadUrl);
  assert.ok(res.body.data.token);
  assert.equal(res.body.data.expiresIn, 600);
});

test('POST /orders/:id/uploads/sign rejects invalid category', async () => {
  injectDb(buildMock());
  const res = await rt.post(
    `/orders/${ORDER_ID}/uploads/sign`,
    { authorization: token() },
    { category: 'NOPE', filename: 'a.png', mimeType: 'image/png', sizeBytes: 1 }
  );
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'INVALID_EVIDENCE_CATEGORY');
});

test('POST /orders/:id/uploads/sign rejects unsupported MIME type', async () => {
  injectDb(buildMock());
  const res = await rt.post(
    `/orders/${ORDER_ID}/uploads/sign`,
    { authorization: token() },
    { category: 'PRODUCT_PHOTO', filename: 'a.gif', mimeType: 'image/gif', sizeBytes: 1 }
  );
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'UNSUPPORTED_MIME_TYPE');
});

test('POST /orders/:id/uploads/sign rejects oversized file with 413', async () => {
  injectDb(buildMock());
  const res = await rt.post(
    `/orders/${ORDER_ID}/uploads/sign`,
    { authorization: token() },
    { category: 'PRODUCT_PHOTO', filename: 'big.png', mimeType: 'image/png', sizeBytes: 11 * 1024 * 1024 }
  );
  assert.equal(res.statusCode, 413);
  assert.equal(res.body.error.code, 'FILE_TOO_LARGE');
});

/* ------------------------------------------------------------------ */
/* Section 2: POST /orders/:id/uploads/complete                       */
/* ------------------------------------------------------------------ */

test('POST /orders/:id/uploads/complete returns 409 when no file exists in storage (regression: await list)', async () => {
  injectDb(buildMock());
  // First, sign to create the PENDING record.
  const signRes = await rt.post(
    `/orders/${ORDER_ID}/uploads/sign`,
    { authorization: token() },
    { category: 'PURCHASE_RECEIPT', filename: 'r.jpg', mimeType: 'image/jpeg', sizeBytes: 500 }
  );
  assert.equal(signRes.statusCode, 201);
  const uploadId = signRes.body.data.id;

  // Now complete without uploading anything — should return 409 not 503.
  const res = await rt.post(
    `/orders/${ORDER_ID}/uploads/complete`,
    { authorization: token() },
    { uploadId }
  );
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'UPLOAD_NOT_COMPLETED');
});

/* ------------------------------------------------------------------ */
/* Section 3: GET /uploads/:uploadId/download-url                     */
/* ------------------------------------------------------------------ */

test('GET /uploads/:uploadId/download-url returns 409 for PENDING evidence (regression: await createSignedUrl)', async () => {
  injectDb(buildMock());
  const signRes = await rt.post(
    `/orders/${ORDER_ID}/uploads/sign`,
    { authorization: token() },
    { category: 'SERIAL_EVIDENCE', filename: 's.png', mimeType: 'image/png', sizeBytes: 100 }
  );
  assert.equal(signRes.statusCode, 201);
  const uploadId = signRes.body.data.id;

  // PENDING evidence cannot be downloaded.
  const res = await rt.get(`/uploads/${uploadId}/download-url`, { authorization: token() });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'UPLOAD_NOT_COMPLETED');
});

/* ------------------------------------------------------------------ */
/* Section 4: GET /orders/:id/uploads                                 */
/* ------------------------------------------------------------------ */

test('GET /orders/:id/uploads returns empty list when no completed evidence exists', async () => {
  injectDb(buildMock());
  const res = await rt.get(`/orders/${ORDER_ID}/uploads`, { authorization: token() });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, []);
});
