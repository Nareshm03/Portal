import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Supabase client.
 *
 * Used in Server Components and route handlers. Reads only the public
 * Next.js env vars. Cookies are read/written via Next.js 16's async
 * `cookies()` API so Supabase can refresh the session and propagate
 * updated access/refresh tokens back to the client.
 *
 * Never touches the service-role key.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        'Create .env.local from the Supabase project public keys.'
    );
  }

  const cookieStore = cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      async getAll() {
        return (await cookieStore).getAll();
      },
      async setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            await (await cookieStore).set(name, value, options);
          }
        } catch {
          // `setAll` was called from a Server Component where cookies
          // cannot be mutated. This is safe to ignore: the refresh
          // token cookie will be updated on the next client navigation.
        }
      },
    },
  });
}
