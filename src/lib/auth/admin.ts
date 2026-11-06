import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchProfile, signIn, signOut } from "./supabase";
import type { SupabaseAuthResult, Profile } from "./types";
import { WORKSPACES } from "@/lib/workspaces";

function resolveClient(supabase?: SupabaseClient) {
  return supabase ?? createClient();
}

export function getAdminClient() {
  return createClient();
}

/** Admin accounts are provisioned internally: there is no public registration. */
export async function signInAdmin(
  input: { email: string; password: string },
  supabase?: SupabaseClient
): Promise<SupabaseAuthResult & { profileRequired?: boolean }> {
  const client = resolveClient(supabase);
  const result = await signIn(client, input.email, input.password);
  if (!result.ok) return result;

  // Role is authoritative from the backend /me endpoint — never from JWT claims.
  const profileResult = await fetchProfile(client);
  if (!profileResult.ok || !profileResult.profile) {
    await signOut(client);
    return { ok: false, error: "not-authorized" };
  }
  const profile = profileResult.profile;
  if (profile.role !== "admin" || profile.account_status !== "ACTIVE") {
    await signOut(client);
    return {
      ok: false,
      error: "not-authorized",
    };
  }
  return { ok: true, user: result.user };
}

/** No public admin signup. Admin roles are provisioned by an existing admin. */
export function signUpAdmin(): never {
  throw new Error("Admin registration is not available. Admin accounts are invite-only.");
}

export function signOutAdmin(supabase?: SupabaseClient): Promise<void> {
  return signOut(resolveClient(supabase));
}

/** Server-component guard. Redirects to Admin login when no valid admin session. */
export async function requireAdminSession(supabase?: SupabaseClient): Promise<{ user: { id: string; email: string | null } }> {
  const client = resolveClient(supabase);
  const result = await getUserFromClient(client);
  if (!result.ok) {
    redirect(WORKSPACES.admin.loginPath);
  }
  return { user: result.user ?? { id: "", email: null } };
}

async function getUserFromClient(client: SupabaseClient): Promise<SupabaseAuthResult> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return { ok: false, error: "No session" };
  }
  return { ok: true, user: { id: data.user.id, email: data.user.email ?? null } };
}

/**
 * Fetch the admin profile from the backend. Returns not-ok when not an admin
 * or account not active (never throws).
 */
export async function getAdminProfile(
  supabase?: SupabaseClient
): Promise<{ ok: boolean; profile?: Profile; error?: string }> {
  const client = resolveClient(supabase);
  const result = await fetchProfile(client);
  if (!result.ok || !result.profile) {
    return { ok: false, error: result.error ?? "No profile" };
  }
  const p = result.profile;
  if (p.role !== "admin" || p.account_status !== "ACTIVE") {
    return { ok: false, error: "not-authorized" };
  }
  return { ok: true, profile: p };
}
