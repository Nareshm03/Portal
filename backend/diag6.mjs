import { createMockSupabase, profileRow, testUuid } from './tests/helpers/mockSupabase.js';
import { injectDb, createRouteTester } from './tests/helpers/routeTester.js';
import { getSupabase } from './src/config/supabase.js';

const BUYER_ID = testUuid(1);
const ORDER_ID = testUuid(2);

// Create real client BEFORE injecting mock
const realClient = getSupabase();

const mock = createMockSupabase({
  orders: { data: [{ id: ORDER_ID, buyer_id: BUYER_ID, traveller_id: testUuid(3) }], error: null },
  profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
  order_evidence: { data: [], error: null }
});

// Attach real storage to mock
mock.storage = realClient.storage;

// NOW inject mock
injectDb(mock);

// Now test what getSupabase().storage.from('order_evidence').createSignedUploadUrl(...) does:
const sb = getSupabase(); // Returns mock
console.log('sb === mock:', sb === mock);
console.log('sb.storage:', sb.storage ? 'present' : 'absent');

const res1 = sb.storage.from('order_evidence');
console.log('res1 type:', res1?.constructor?.name);

const { data: signed, error: signError } = await sb.storage.from('order_evidence').createSignedUploadUrl(`orders/${ORDER_ID}/test1`);
console.log('signError:', signError ? JSON.stringify(signError, null, 2) : 'none');
console.log('signed:', signed ? Object.keys(signed) : signed);

// Now run through the actual route!
const rt = createRouteTester();
const res = await rt.post(
  `/orders/${ORDER_ID}/uploads/sign`,
  { authorization: `Bearer ${BUYER_ID}-token` },
  { category: 'PRODUCT_PHOTO', filename: 'test.png', mimeType: 'image/png', sizeBytes: 100 }
);
console.log('route statusCode:', res.statusCode);
console.log('route body:', JSON.stringify(res.body, null, 2));
