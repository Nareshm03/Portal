import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Profile,
  ProfileResult,
  SupabaseAuthResult,
} from "./types";

const SUPABASE_AUTH_ERRORS: Record<string, string> = {
  invalid_login: "invalid-credentials",
  email_not_confirmed: "email-confirmation-required",
  email_already_in_use: "email-taken",
  signup_disabled: "invalid-input",
  too_many_requests: "invalid-input",
};

/** Map a Supabase Auth error message to a stable client-facing code. */
function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  for (const [key, code] of Object.entries(SUPABASE_AUTH_ERRORS)) {
    if (lower.includes(key)) return code;
  }
  return "invalid-input";
}

/**
 * Sign in with email + password using a Supabase client (browser or server).
 * Returns the authenticated user. Does NOT trust any client-provided role.
 */
export async function signIn(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<SupabaseAuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    return {
      ok: false,
      error: mapAuthError(error?.message ?? "Authentication failed."),
    };
  }
  return {
    ok: true,
    user: { id: data.user.id, email: data.user.email ?? null },
  };
}

/**
 * Sign up with email + password using a Supabase client.
 * The database trigger creates every profile as role='buyer',
 * account_status='PENDING'. The caller must NOT treat a new signup as an
 * approved traveller or admin.
 *
 * If email confirmation is enabled, `requiresEmailConfirmation` is true and
 * no session is established yet.
 */
export async function signUp(
  supabase: SupabaseClient,
  email: string,
  password: string,
  options?: { data?: Record<string, unknown> }
): Promise<SupabaseAuthResult & { requiresEmailConfirmation?: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options,
  });
  if (error || !data.user) {
    return {
      ok: false,
      error: mapAuthError(error?.message ?? "Signup failed."),
    };
  }
  return {
    ok: true,
    user: { id: data.user.id, email: data.user.email ?? null },
    requiresEmailConfirmation: !data.session,
  };
}

/** Sign out using a Supabase client. */
export async function signOut(supabase: SupabaseClient): Promise<void> {
  await supabase.auth.signOut();
}

/** Get the current auth user using a Supabase client. */
export async function getUser(
  supabase: SupabaseClient
): Promise<SupabaseAuthResult> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return {
      ok: false,
      error: error?.message ?? "No session",
    };
  }
  return {
    ok: true,
    user: { id: data.user.id, email: data.user.email ?? null },
  };
}

/** Get the current access token (for use with the Express backend /api/v1/me). */
export async function getAccessToken(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Fetch the authoritative profile from the Express backend.
 * The backend validates the JWT and returns the server-managed role/status.
 * Never trust frontend JWT claims for authorization.
 */
export async function fetchProfile(
  supabase: SupabaseClient
): Promise<ProfileResult> {
  const token = await getAccessToken(supabase);
  if (!token) {
    return { ok: false, error: "No access token" };
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) {
    return { ok: false, error: "NEXT_PUBLIC_API_URL is not set" };
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase.replace(/\/+$/, "")}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: `Backend responded ${res.status}`,
    };
  }

  const body = (await res.json()) as { data?: Profile };
  if (!body?.data) {
    return { ok: false, error: "No profile returned" };
  }
  return { ok: true, profile: body.data };
}
