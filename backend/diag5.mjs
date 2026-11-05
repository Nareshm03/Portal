import { createMockSupabase, profileRow, testUuid } from './tests/helpers/mockSupabase.js';
import { injectDb } from './tests/helpers/routeTester.js';
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

const storagePath = `orders/${ORDER_ID}/test-upload-id`;
const { data: signed, error: signError } = await realClient.storage.from('order_evidence').createSignedUploadUrl(storagePath);
console.log('signError:', signError ? JSON.stringify(signError, null, 2) : 'none');
console.log('signed:', signed ? Object.keys(signed) : signed);

const bucket = realClient.storage.from('order_evidence');
console.log('bucket url:', bucket.url);
console.log('bucket headers:', bucket.headers);
