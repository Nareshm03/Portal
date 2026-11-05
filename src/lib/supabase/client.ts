import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client.
 *
 * Used in client components and event handlers. Reads only the public
 * Next.js env vars (NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY). Never touches the service-role key.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
        'Create .env.local from the Supabase project public keys.'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
