/**
 * Shared typed API client for the Portal Express backend.
 *
 * Supports two modes:
 *
 * 1. Live mode — proxies requests through the Next.js API route at
 *    /api/v1/* which forwards to the Express backend (NEXT_PUBLIC_API_URL).
 *    Authorization headers, query params and bodies are preserved.
 *
 * 2. Demo mode — when the backend is unreachable (or NEXT_PUBLIC_DEMO_MODE
 *    is set), calls fail gracefully and the caller is expected to use demo
 *    data from src/lib/demo/*. Demo mode is clearly signalled via the
 *    `demo` property on the client.
 *
 * Never logs tokens or secrets.
 */

export interface ApiClientConfig {
  baseUrl?: string;
  idempotencyKey?: string;
  demo?: boolean;
}

/** Normalized API error. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | null,
    public message: string,
    public requestId: string | null,
    public details: unknown,
    public demo: boolean = false
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestInit extends RequestInit {
  idempotencyKey?: string;
  token?: string | null;
}

/** Result of a backend availability probe. */
interface BackendProbe {
  available: boolean;
  lastChecked: number;
}

/** Cache the backend availability probe for a short window. */
let probeCache: BackendProbe | null = null;
const PROBE_CACHE_TTL_MS = 10_000;

/**
 * Probe the backend health endpoint to determine if it is reachable.
 * Results are cached briefly to avoid hammering a down backend.
 */
async function probeBackend(baseUrl: string): Promise<boolean> {
  const now = Date.now();
  if (probeCache && now - probeCache.lastChecked < PROBE_CACHE_TTL_MS) {
    return probeCache.available;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const available = res.ok;
    probeCache = { available, lastChecked: now };
    return available;
  } catch {
    probeCache = { available: false, lastChecked: now };
    return false;
  }
}

/**
 * Create an API client bound to a token provider. The provider is called
 * on every request so the current Supabase access token is always used.
 */
export function createApiClient(config: ApiClientConfig = {}) {
  const explicitDemo = config.demo === true;
  const baseUrl = config.baseUrl ?? process.env.NEXT_PUBLIC_API_URL;
  const base = baseUrl ? baseUrl.replace(/\/+$/, "") : "";

  const demoMode = explicitDemo || !baseUrl;

  const backendProbe = demoMode
    ? Promise.resolve(false)
    : probeBackend(base);

  async function headersFor(init: ApiRequestInit): Promise<HeadersInit> {
    const headers: Record<string, string> = {};
    if (init.body && !(init.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (init.idempotencyKey) {
      headers["Idempotency-Key"] = init.idempotencyKey;
    } else if (config.idempotencyKey) {
      headers["Idempotency-Key"] = config.idempotencyKey;
    }
    if (init.token) {
      headers["Authorization"] = `Bearer ${init.token}`;
    }
    return headers;
  }

  async function request(
    path: string,
    init: ApiRequestInit = {}
  ): Promise<{ status: number; body: unknown; ok: boolean; demo: boolean }> {
    const token = init.token ?? null;

    // In demo mode (forced or no backend URL), skip the network entirely.
    if (demoMode) {
      return {
        status: 0,
        body: null,
        ok: false,
        demo: true,
      };
    }

    // If we haven't probed yet, do it now.
    const available = await backendProbe;
    if (!available) {
      return {
        status: 0,
        body: null,
        ok: false,
        demo: true,
      };
    }

    // Build the full URL. When base ends with /api/v1 and path starts with /,
    // the result is base + path (e.g. http://localhost:4000/api/v1/me).
    // When using the Next.js proxy, base should be "" and path is /api/v1/me.
    const url = base ? `${base}${path}` : path;

    const hdrs = await headersFor({ ...init, token });

    let res: Response;
    try {
      res = await fetch(url, { ...init, headers: hdrs });
    } catch (err) {
      // Backend became unavailable mid-request — signal demo mode.
      probeCache = { available: false, lastChecked: Date.now() };
      throw new ApiError(
        0,
        null,
        err instanceof Error ? err.message : "Network error",
        null,
        null,
        true
      );
    }

    let body: unknown = null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        body = await res.json();
      } catch {
        body = null;
      }
    } else {
      body = await res.text();
    }

    return { status: res.status, body, ok: res.ok, demo: false };
  }

  function throwIfNotOk(result: {
    status: number;
    body: unknown;
    ok: boolean;
    demo: boolean;
  }): void {
    if (result.ok) return;
    const body = result.body as
      | {
          error?: {
            code?: string;
            message?: string;
            requestId?: string;
            details?: unknown;
          };
        }
      | undefined;
    throw new ApiError(
      result.status,
      body?.error?.code ?? null,
      body?.error?.message ?? `Request failed with status ${result.status}`,
      body?.error?.requestId ?? null,
      body?.error?.details ?? null,
      result.demo
    );
  }

  return {
    baseUrl: base,
    demo: demoMode,

    async GET(path: string, init: ApiRequestInit = {}) {
      const result = await request(path, { ...init, method: "GET" });
      throwIfNotOk(result);
      return result.body;
    },

    async POST(path: string, body: unknown, init: ApiRequestInit = {}) {
      const result = await request(path, {
        ...init,
        method: "POST",
        body: JSON.stringify(body),
      });
      throwIfNotOk(result);
      return result.body;
    },

    async PATCH(path: string, body: unknown, init: ApiRequestInit = {}) {
      const result = await request(path, {
        ...init,
        method: "PATCH",
        body: JSON.stringify(body),
      });
      throwIfNotOk(result);
      return result.body;
    },

    async DELETE(path: string, init: ApiRequestInit = {}) {
      const result = await request(path, { ...init, method: "DELETE" });
      throwIfNotOk(result);
      return result.body;
    },

    /**
     * Low-level request that returns the raw result including demo flag.
     * Callers can check `result.demo` to decide whether to show demo data.
     */
    async request(path: string, init: ApiRequestInit = {}) {
      const result = await request(path, init);
      return result;
    },

    ApiError,
  };
}

/**
 * Create an API client that uses the Next.js API proxy (relative /api/v1/* URLs).
 * Requests go through src/app/api/v1/[[...path]]/route.ts which forwards to
 * the Express backend. This avoids CORS issues and centralises error handling.
 *
 * Paths are automatically normalised to start with /api/v1 so existing call
 * sites that pass "/requests/mine" still work through the proxy.
 */
export function createProxiedApiClient(config: ApiClientConfig = {}) {
  const client = createApiClient({ ...config, baseUrl: "" });

  const normalisePath = (path: string): string =>
    path.startsWith("/api/v1") ? path : `/api/v1${path}`;

  const originalGet = client.GET.bind(client);
  const originalPost = client.POST.bind(client);
  const originalPatch = client.PATCH.bind(client);
  const originalDelete = client.DELETE.bind(client);

  return {
    ...client,
    GET: (path: string, init?: ApiRequestInit) =>
      originalGet(normalisePath(path), init),
    POST: (path: string, body: unknown, init?: ApiRequestInit) =>
      originalPost(normalisePath(path), body, init),
    PATCH: (path: string, body: unknown, init?: ApiRequestInit) =>
      originalPatch(normalisePath(path), body, init),
    DELETE: (path: string, init?: ApiRequestInit) =>
      originalDelete(normalisePath(path), init),
  };
}
