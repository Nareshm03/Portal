import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`.
 * 
 * This proxy enforces authentication for Buyer and Traveler workspaces.
 * Each workspace has its own session cookie, path-scoped to prevent cross-workspace access.
 */

// Cookie names for workspace sessions (must match src/lib/workspaces.ts)
const BUYER_SESSION_COOKIE = 'portal_buyer_session';
const TRAVELER_SESSION_COOKIE = 'portal_traveler_session';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Buyer workspace routes
  if (pathname.startsWith('/buyer')) {
    // Allow access to login and register pages
    if (pathname === '/buyer/login' || pathname === '/buyer/register') {
      return NextResponse.next();
    }

    // Check for buyer session
    const buyerSession = request.cookies.get(BUYER_SESSION_COOKIE);
    
    if (!buyerSession) {
      // Redirect to login if no session
      const loginUrl = new URL('/buyer/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Session exists, allow access
    return NextResponse.next();
  }

  // Traveler workspace routes
  if (pathname.startsWith('/traveler')) {
    // Allow access to login and register pages
    if (pathname === '/traveler/login' || pathname === '/traveler/register') {
      return NextResponse.next();
    }

    // Check for traveler session
    const travelerSession = request.cookies.get(TRAVELER_SESSION_COOKIE);
    
    if (!travelerSession) {
      // Redirect to login if no session
      const loginUrl = new URL('/traveler/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Session exists, allow access
    return NextResponse.next();
  }

  // All other routes (including admin) pass through
  return NextResponse.next();
}

export const config = {
  matcher: ["/buyer/:path*", "/traveler/:path*", "/admin/:path*"],
};
