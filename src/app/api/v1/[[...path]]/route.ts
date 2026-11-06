import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js API proxy for the Portal Express backend.
 *
 * All frontend /api/v1/* calls are proxied to the configured backend URL
 * (NEXT_PUBLIC_API_URL or http://localhost:4000/api/v1). The proxy:
 *
 * - Forwards method, headers (incl. Authorization), query params and body
 * - Returns backend status codes and response bodies accurately
 * - Never exposes backend secrets (service-role key, etc. stay on the server)
 * - Only proxies to the configured backend base URL — no arbitrary destinations
 * - Strips the leading /api/v1 so the backend receives /api/v1/... correctly
 */

const DEFAULT_BACKEND = "http://localhost:4000/api/v1";

function backendBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return DEFAULT_BACKEND;
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const base = backendBaseUrl();
  const { pathname, searchParams } = req.nextUrl;

  // Path is like /api/v1/users/123 -> strip /api/v1 -> /users/123
  // The backend base URL already includes /api/v1, so we append the remainder.
  const rest = pathname.replace(/^\/api\/v1/, "");
  const url = new URL(`${base}${rest}`);

  // Forward all query parameters.
  searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  // Build headers to forward. Exclude hop-by-hop and Next.js-specific headers.
  const headers: Record<string, string> = {};
  const excludedHeaders = new Set([
    "host",
    "content-length",
    "connection",
    "transfer-encoding",
    "upgrade",
    "next-url",
    "x-nextjs-data",
    "x-middleware-rewrite",
    "x-middleware-precedence",
  ]);

  req.headers.forEach((value, key) => {
    if (!excludedHeaders.has(key.toLowerCase())) {
      headers[key] = value;
    }
  });

  // Always accept JSON responses from the backend.
  headers["Accept"] = "application/json, */*";

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  // Forward body for methods that can have one.
  const method = req.method?.toUpperCase();
  if (method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE") {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      // Forward FormData as-is (file uploads).
      init.body = req.body as any;
    } else if (contentType.includes("application/json")) {
      try {
        init.body = JSON.stringify(await req.json());
        init.headers = { ...init.headers, "Content-Type": "application/json" };
      } catch {
        // If body isn't valid JSON, send without body.
      }
    } else if (req.body) {
      init.body = req.body as any;
      if (contentType) {
        init.headers = { ...init.headers, "Content-Type": contentType };
      }
    }
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(url.toString(), init);
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNREACHABLE",
          message:
            err instanceof Error ? err.message : "Could not reach the backend.",
        },
      },
      { status: 502 }
    );
  }

  // Read the backend response body.
  const contentType = backendRes.headers.get("content-type") ?? "";
  let body: unknown = null;
  if (contentType.includes("application/json")) {
    try {
      body = await backendRes.json();
    } catch {
      body = null;
    }
  } else {
    body = await backendRes.text();
  }

  // Build response headers, forwarding relevant backend headers.
  const responseHeaders: Record<string, string> = {};
  const forwardHeaders = ["content-type", "cache-control", "etag", "last-modified"];
  backendRes.headers.forEach((value, key) => {
    if (forwardHeaders.includes(key.toLowerCase())) {
      responseHeaders[key] = value;
    }
  });

  return NextResponse.json(body, {
    status: backendRes.status,
    statusText: backendRes.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
