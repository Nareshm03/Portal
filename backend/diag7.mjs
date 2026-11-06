import { createMockSupabase, profileRow, testUuid } from './tests/helpers/mockSupabase.js';
import { injectDb, createRouteTester } from './tests/helpers/routeTester.js';
import { getSupabase } from './src/config/supabase.js';

const BUYER_ID = testUuid(1);
const ORDER_ID = testUuid(2);
const realClient = getSupabase();

const mock = createMockSupabase({
  orders: { data: [{ id: ORDER_ID, buyer_id: BUYER_ID, traveller_id: testUuid(3) }], error: null },
  profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
  order_evidence: { data: [], error: null }
});
mock.storage = realClient.storage;
injectDb(mock);

const rt = createRouteTester();

// Step 1: sign
const signRes = await rt.post(
  `/orders/${ORDER_ID}/uploads/sign`,
  { authorization: `Bearer ${BUYER_ID}-token` },
  { category: 'PRODUCT_PHOTO', filename: 'test.png', mimeType: 'image/png', sizeBytes: 100 }
);
console.log('SIGN status:', signRes.statusCode);
const uploadId = signRes.body?.data?.id;
const storagePath = signRes.body?.data?.storage_path;
console.log('uploadId:', uploadId);
console.log('storagePath:', storagePath);

// Step 2: verify we can't complete without actual file
const completeRes = await rt.post(
  `/orders/${ORDER_ID}/uploads/complete`,
  { authorization: `Bearer ${BUYER_ID}-token` },
  { uploadId }
);
console.log('\nCOMPLETE (no file) status:', completeRes.statusCode);
console.log('COMPLETE body:', JSON.stringify(completeRes.body, null, 2));

// Step 3: now test download-url with a PENDING status (should fail)
const downloadRes = await rt.get(
  `/uploads/${uploadId}/download-url`,
  { authorization: `Bearer ${BUYER_ID}-token` }
);
console.log('\nDOWNLOAD (pending) status:', downloadRes.statusCode);
console.log('DOWNLOAD body:', JSON.stringify(downloadRes.body, null, 2));
