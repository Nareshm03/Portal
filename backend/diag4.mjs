// Reproduce the exact server-side route path via the test framework,
// but with a mock DB whose .storage delegates to the REAL supabase client.
import { createMockSupabase, profileRow, testUuid } from './tests/helpers/mockSupabase.js';
import { createRouteTester, injectDb } from './tests/helpers/routeTester.js';
import { getSupabase } from './src/config/supabase.js';
import { env } from './src/config/env.js';

const BUYER_ID = testUuid(1);
const ORDER_ID = testUuid(2);

// Real client for storage delegation
const realClient = getSupabase();

// Build a mock that satisfies the route's DB needs and delegates storage to real.
const mock = createMockSupabase({
  orders: { data: [{ id: ORDER_ID, buyer_id: BUYER_ID, traveller_id: testUuid(3) }], error: null },
  profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
  order_evidence: { data: [], error: null }
});

// Inject storage proxy onto the mock so supabase().storage.from(bucket) works.
mock.storage = realClient.storage;

injectDb(mock);

const rt = createRouteTester();
const res = await rt.post(
  `/orders/${ORDER_ID}/uploads/sign`,
  { authorization: `Bearer ${BUYER_ID}-token` },
  { category: 'PRODUCT_PHOTO', filename: 'test.png', mimeType: 'image/png', sizeBytes: 100 }
);
console.log('status:', res.statusCode);
console.log('body:', JSON.stringify(res.body, null, 2));
