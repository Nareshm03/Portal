import { redirect } from "next/navigation";
import { WORKSPACES } from "@/lib/workspaces";
import { mockSignIn, mockSignUp } from "./mock";
import { createSession, destroySession, getSession } from "./session";
import type { AuthResult, Session, SignInInput, SignUpInput } from "./types";

const WORKSPACE = "buyer" as const;

export function getBuyerSession(): Promise<Session | null> {
  return getSession(WORKSPACE);
}

export async function signInBuyer(input: SignInInput): Promise<AuthResult> {
  const result = mockSignIn(WORKSPACE, input);
  if (result.ok) await createSession(result.session);
  return result;
}

export async function signUpBuyer(input: SignUpInput): Promise<AuthResult> {
  const result = mockSignUp(WORKSPACE, input);
  if (result.ok) await createSession(result.session);
  return result;
}

export function signOutBuyer(): Promise<void> {
  return destroySession(WORKSPACE);
}

/** Server-component guard. Redirects to the Buyer login when unauthenticated. */
export async function requireBuyerSession(): Promise<Session> {
  const session = await getBuyerSession();
  if (!session) redirect(WORKSPACES.buyer.loginPath);
  return session;
}
