import { redirect } from "next/navigation";
import { WORKSPACES } from "@/lib/workspaces";
import { mockSignIn } from "./mock";
import { createSession, destroySession, getSession } from "./session";
import type { AuthResult, Session, SignInInput } from "./types";

const WORKSPACE = "admin" as const;

/**
 * Admin accounts are provisioned internally: there is intentionally no
 * `signUpAdmin` and no /admin/register route.
 */
export function getAdminSession(): Promise<Session | null> {
  return getSession(WORKSPACE);
}

export async function signInAdmin(input: SignInInput): Promise<AuthResult> {
  const result = mockSignIn(WORKSPACE, input);
  if (result.ok) await createSession(result.session);
  return result;
}

export function signOutAdmin(): Promise<void> {
  return destroySession(WORKSPACE);
}

/** Server-component guard. Redirects to the Admin login when unauthenticated. */
export async function requireAdminSession(): Promise<Session> {
  const session = await getAdminSession();
  if (!session) redirect(WORKSPACES.admin.loginPath);
  return session;
}
