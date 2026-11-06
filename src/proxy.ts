import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 16 middleware convention (renamed from `middleware` to `proxy`).
 *
 * Route protection is intentionally NOT enforced yet. The middleware's only
 * job here is to refresh Supabase sessions: on every request it creates a
 * server Supabase client bound to the request/response cookies and calls
 * `auth.getClaims()`. If a valid refresh token is present, Supabase rotates
 * the access token and writes the new cookies back through `setAll`, which
 * we forward onto the response.
 *
 * This proxy is NOT the authorization layer. Each backend route validates
 * the bearer JWT itself via Express `requireAuth`/`requireRole`.
 */
export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh the session if a refresh token is present. getClaims() also
  // verifies the JWT signature server-side; we intentionally do not use the
  // result here to gate routes — the Express backend remains authoritative.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: ["/buyer/:path*", "/traveler/:path*", "/admin/:path*"],
};
