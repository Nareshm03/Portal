import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchProfile, signIn, signOut, signUp } from "./supabase";
import type { SupabaseAuthResult, Profile } from "./types";
import { WORKSPACES } from "@/lib/workspaces";

function resolveClient(supabase?: SupabaseClient) {
  return supabase ?? createClient();
}

export function getTravellerClient() {
  return createClient();
}

export async function signInTraveller(
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
  if (profile.role !== "traveller" || profile.account_status !== "ACTIVE") {
    await signOut(client);
    return {
      ok: false,
      error: "not-authorized",
    };
  }
  return { ok: true, user: result.user };
}

export async function signUpTraveller(
  input: { name: string; email: string; password: string },
  supabase?: SupabaseClient
): Promise<SupabaseAuthResult & { requiresEmailConfirmation?: boolean }> {
  const client = resolveClient(supabase);
  return signUp(client, input.email, input.password, {
    data: { full_name: input.name },
  });
}

export function signOutTraveller(supabase?: SupabaseClient): Promise<void> {
  return signOut(resolveClient(supabase));
}

/** Server-component guard. Redirects to Traveller login when no valid traveller session. */
export async function requireTravellerSession(supabase?: SupabaseClient): Promise<{ user: { id: string; email: string | null } }> {
  const client = resolveClient(supabase);
  const result = await getUserFromClient(client);
  if (!result.ok) {
    redirect(WORKSPACES.traveler.loginPath);
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
 * Fetch the traveller profile from the backend. Returns not-ok when not a
 * traveller or account not active (never throws).
 */
export async function getTravellerProfile(
  supabase?: SupabaseClient
): Promise<{ ok: boolean; profile?: Profile; error?: string }> {
  const client = resolveClient(supabase);
  const result = await fetchProfile(client);
  if (!result.ok || !result.profile) {
    return { ok: false, error: result.error ?? "No profile" };
  }
  const p = result.profile;
  if (p.role !== "traveller" || p.account_status !== "ACTIVE") {
    return { ok: false, error: "not-authorized" };
  }
  return { ok: true, profile: p };
}
