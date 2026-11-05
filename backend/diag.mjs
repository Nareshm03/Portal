import { createClient } from '@supabase/supabase-js';
import { env } from './src/config/env.js';

const keyLen = (env.SUPABASE_SERVICE_ROLE_KEY || '').length;
const url = env.SUPABASE_URL;
console.log('SUPABASE_URL:', url);
console.log('SERVICE_ROLE_KEY length:', keyLen);
console.log('SERVICE_ROLE_KEY prefix chars:', (env.SUPABASE_SERVICE_ROLE_KEY || '').slice(0, 12));
console.log('SERVICE_ROLE_KEY suffix chars:', (env.SUPABASE_SERVICE_ROLE_KEY || '').slice(-6));

const client = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { headers: { 'X-Client-Info': 'portal-backend/0.1.0' } }
});

const { data: buckets, error: bErr } = await client.storage.listBuckets();
console.log('\n[listBuckets] error:', bErr ? { code: bErr.code, status: bErr.status, message: bErr.message } : 'none');
console.log('[listBuckets] data:', buckets ? buckets.map(b => b.name) : buckets);

const { data: bkt, error: bktErr } = await client.storage.getBucket('order_evidence');
console.log('[getBucket] error:', bktErr ? { code: bktErr.code, status: bktErr.status, message: bktErr.message } : 'none');
console.log('[getBucket] public:', bkt?.public);

const { data: signed, error: sErr } = await client.storage.from('order_evidence').createSignedUploadUrl('orders/test/test');
console.log('\n[createSignedUploadUrl] error:', sErr ? { code: sErr.code, status: sErr.status, message: sErr.message } : 'none');
console.log('[createSignedUploadUrl] data keys:', signed ? Object.keys(signed) : signed);

const client2 = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { headers: { 'X-Client-Info': 'portal-backend/0.1.0' } }
});
const { data: signed2, error: sErr2 } = await client2.storage.from('order_evidence').createSignedUploadUrl('orders/test/test');
console.log('\n[createSignedUploadUrl #2] error:', sErr2 ? { code: sErr2.code, status: sErr2.status, message: sErr2.message } : 'none');
console.log('[createSignedUploadUrl #2] data keys:', signed2 ? Object.keys(signed2) : signed2);
