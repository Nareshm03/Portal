import { createClient } from '@supabase/supabase-js';
import { env } from './src/config/env.js';

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
console.log('URL:', url);
console.log('KEY_LEN:', key.length);
console.log('KEY_PREFIX:', key.slice(0, 12));
console.log('KEY_SUFFIX:', key.slice(-6));

// The production singleton uses exactly this config:
const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { headers: { 'X-Client-Info': 'portal-backend/0.1.0' } }
});

// 1. listBuckets
const { data: buckets, error: bErr } = await client.storage.listBuckets();
console.log('\n[listBuckets] err:', bErr ? { code: bErr.code, status: bErr.status, message: bErr.message } : 'none');
console.log('[listBuckets] data:', buckets ? buckets.map(b => b.name) : buckets);

// 2. getBucket
const { data: bkt, error: bktErr } = await client.storage.getBucket('order_evidence');
console.log('[getBucket] err:', bktErr ? { code: bktErr.code, status: bktErr.status, message: bktErr.message } : 'none');
console.log('[getBucket] public:', bkt?.public);

// 3. createSignedUploadUrl
const { data: signed, error: sErr } = await client.storage.from('order_evidence').createSignedUploadUrl('orders/test/test');
console.log('\n[createSignedUploadUrl] err:', sErr ? { code: sErr.code, status: sErr.status, message: sErr.message } : 'none');
console.log('[createSignedUploadUrl] data keys:', signed ? Object.keys(signed) : signed);

// 4. A separate client with identical config
const client2 = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { headers: { 'X-Client-Info': 'portal-backend/0.1.0' } }
});
const { data: signed2, error: sErr2 } = await client2.storage.from('order_evidence').createSignedUploadUrl('orders/test/test');
console.log('\n[createSignedUploadUrl #2] err:', sErr2 ? { code: sErr2.code, status: sErr2.status, message: sErr2.message } : 'none');
console.log('[createSignedUploadUrl #2] data keys:', signed2 ? Object.keys(signed2) : signed2);

// 5. createSignedUrl (download)
const { data: dl, error: dlErr } = await client.storage.from('order_evidence').createSignedUrl('orders/test/test', 60);
console.log('\n[createSignedUrl] err:', dlErr ? { code: dlErr.code, status: dlErr.status, message: dlErr.message } : 'none');
console.log('[createSignedUrl] data keys:', dl ? Object.keys(dl) : dl);
