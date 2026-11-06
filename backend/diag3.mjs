// Reproduce the exact server-side code path: getSupabase() singleton.
import { getSupabase } from './src/config/supabase.js';

const sb = getSupabase();
console.log('client type:', sb?.constructor?.name);

const { data: buckets, error: bErr } = await sb.storage.listBuckets();
console.log('\n[listBuckets] err:', bErr ? { code: bErr.code, status: bErr.status, message: bErr.message } : 'none');
console.log('[listBuckets] data:', buckets ? buckets.map(b => b.name) : buckets);

const { data: bkt, error: bktErr } = await sb.storage.getBucket('order_evidence');
console.log('[getBucket] err:', bktErr ? { code: bktErr.code, status: bktErr.status, message: bktErr.message } : 'none');
console.log('[getBucket] public:', bkt?.public);

const { data: signed, error: sErr } = await sb.storage.from('order_evidence').createSignedUploadUrl('orders/test/test');
console.log('\n[createSignedUploadUrl] err:', sErr ? { code: sErr.code, status: sErr.status, message: sErr.message } : 'none');
console.log('[createSignedUploadUrl] data keys:', signed ? Object.keys(signed) : signed);

// Second call - same singleton, same path
const { data: signed2, error: sErr2 } = await sb.storage.from('order_evidence').createSignedUploadUrl('orders/test/test2');
console.log('\n[createSignedUploadUrl #2] err:', sErr2 ? { code: sErr2.code, status: sErr2.status, message: sErr2.message } : 'none');
console.log('[createSignedUploadUrl #2] data keys:', signed2 ? Object.keys(signed2) : signed2);
