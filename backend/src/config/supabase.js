import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

let client;
export function getSupabase() {
  // Test injection: allow a fake Supabase client to be substituted for unit/route testing.
  // This global is only set by test files and has no effect in production.
  const testDb = globalThis.__portal_test_db__;
  if (testDb) return testDb;

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    const error = new Error('Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.');
    error.statusCode = 503;
    error.code = 'SUPABASE_NOT_CONFIGURED';
    throw error;
  }
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: { 'X-Client-Info': 'portal-backend/0.1.0' } }
    });
  }
  return client;
}
