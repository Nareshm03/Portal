import { NextResponse } from "next/server";

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`.
 *
 * Route protection is intentionally NOT enforced yet. The mock auth layer has
 * no sign-in form, so redirecting here would make the placeholder dashboards
 * unreachable. When the forms land, switch this to:
 *
 *   const session = request.cookies.get(WORKSPACES.buyer.sessionCookie);
 *   if (!session) return NextResponse.redirect(new URL("/buyer/login", request.url));
 *
 * ...and repeat per workspace. Cookies are already path-scoped, so each
 * workspace's session is never sent to another workspace's routes.
 */
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/buyer/:path*", "/traveler/:path*", "/admin/:path*"],
};
