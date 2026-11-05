/**
 * Shared typed API client for the Express backend.
 *
 * Reads NEXT_PUBLIC_API_URL, attaches the bearer token from a token
 * provider, supports GET/POST/PATCH/DELETE with JSON bodies and an
 * optional Idempotency-Key header, and preserves backend error codes
 * and request IDs. Never logs tokens or secrets.
 */
export interface ApiClientConfig {
  baseUrl?: string;
  idempotencyKey?: string;
}

/** Normalized API error. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | null,
    public message: string,
    public requestId: string | null,
    public details: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestInit extends RequestInit {
  idempotencyKey?: string;
  token?: string | null;
}

/**
 * Create an API client bound to a token provider. The provider is called
 * on every request so the current Supabase access token is always used.
 */
export function createApiClient(config: ApiClientConfig = {}) {
  const baseUrl = config.baseUrl ?? process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Create .env.local with NEXT_PUBLIC_API_URL."
    );
  }

  const base = baseUrl.replace(/\/+$/, "");

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
  ): Promise<{ status: number; body: unknown; ok: boolean }> {
    const url = `${base}${path}`;
    const token = init.token ?? null;
    const hdrs = await headersFor({ ...init, token });

    let res: Response;
    try {
      res = await fetch(url, { ...init, headers: hdrs });
    } catch (err) {
      throw new ApiError(
        0,
        null,
        err instanceof Error ? err.message : "Network error",
        null,
        null
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

    return { status: res.status, body, ok: res.ok };
  }

  function throwIfNotOk(result: { status: number; body: unknown; ok: boolean }): void {
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
      body?.error?.details ?? null
    );
  }

  return {
    baseUrl: base,

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

    ApiError,
  };
}
