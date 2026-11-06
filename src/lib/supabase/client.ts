import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Create a browser Supabase client. Only call this in client components.
 * Throws if env vars are missing or called during SSR.
 */
export function createClient() {
  if (typeof window === 'undefined') {
    throw new Error("createClient() must not be called during SSR. Use createServerClient() from @/lib/supabase/server instead.");
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

// Only create client in browser environment with valid credentials
// This prevents build-time errors when env vars are not available
export const supabase =
  typeof window !== "undefined" && supabaseUrl && supabaseAnonKey
    ? createClient()
    : null;
