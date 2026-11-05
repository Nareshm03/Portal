import { redirect } from "next/navigation";
import { WORKSPACES } from "@/lib/workspaces";
import { mockSignIn, mockSignUp } from "./mock";
import { createSession, destroySession, getSession } from "./session";
import type { AuthResult, Session, SignInInput, SignUpInput } from "./types";

const WORKSPACE = "traveler" as const;

export function getTravelerSession(): Promise<Session | null> {
  return getSession(WORKSPACE);
}

export async function signInTraveler(input: SignInInput): Promise<AuthResult> {
  const result = mockSignIn(WORKSPACE, input);
  if (result.ok) await createSession(result.session);
  return result;
}

export async function signUpTraveler(input: SignUpInput): Promise<AuthResult> {
  const result = mockSignUp(WORKSPACE, input);
  if (result.ok) await createSession(result.session);
  return result;
}

export function signOutTraveler(): Promise<void> {
  return destroySession(WORKSPACE);
}

/** Server-component guard. Redirects to the Traveler login when unauthenticated. */
export async function requireTravelerSession(): Promise<Session> {
  const session = await getTravelerSession();
  if (!session) redirect(WORKSPACES.traveler.loginPath);
  return session;
}
