import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchProfile, signIn, signOut, signUp } from "./supabase";
import type { SupabaseAuthResult, Profile } from "./types";
import { WORKSPACES } from "@/lib/workspaces";

function resolveClient(supabase?: SupabaseClient) {
  return supabase ?? createClient();
}

export function getBuyerClient() {
  return createClient();
}

export async function signInBuyer(
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
  if (profile.role !== "buyer" || profile.account_status !== "ACTIVE") {
    await signOut(client);
    return {
      ok: false,
      error: "not-authorized",
    };
  }
  return { ok: true, user: result.user };
}

export async function signUpBuyer(
  input: { name: string; email: string; password: string },
  supabase?: SupabaseClient
): Promise<SupabaseAuthResult & { requiresEmailConfirmation?: boolean }> {
  const client = resolveClient(supabase);
  return signUp(client, input.email, input.password, {
    data: { full_name: input.name },
  });
}

export function signOutBuyer(supabase?: SupabaseClient): Promise<void> {
  return signOut(resolveClient(supabase));
}

/** Server-component guard. Redirects to Buyer login when no valid buyer session. */
export async function requireBuyerSession(supabase?: SupabaseClient): Promise<{ user: { id: string; email: string | null } }> {
  const client = resolveClient(supabase);
  const result = await getUserFromClient(client);
  if (!result.ok) {
    redirect(WORKSPACES.buyer.loginPath);
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
 * Fetch the buyer profile from the backend. Returns null when not a buyer
 * or account not active (never throws).
 */
export async function getBuyerProfile(
  supabase?: SupabaseClient
): Promise<{ ok: boolean; profile?: Profile; error?: string }> {
  const client = resolveClient(supabase);
  const result = await fetchProfile(client);
  if (!result.ok || !result.profile) {
    return { ok: false, error: result.error ?? "No profile" };
  }
  const p = result.profile;
  if (p.role !== "buyer" || p.account_status !== "ACTIVE") {
    return { ok: false, error: "not-authorized" };
  }
  return { ok: true, profile: p };
}
