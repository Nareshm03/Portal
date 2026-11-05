import type { WorkspaceId } from "@/lib/workspaces";

/** The identity attached to a workspace session. */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  workspace: WorkspaceId;
}

export interface Session {
  user: SessionUser;
  /** Unix epoch milliseconds. */
  issuedAt: number;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export type AuthErrorCode =
  | "invalid-input"
  | "invalid-credentials"
  | "email-taken";

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; error: AuthErrorCode };

/**
 * Contract every future auth provider must satisfy.
 * Swapping the mock for Supabase / Clerk / Auth.js should not change callers.
 */
export interface AuthAdapter {
  readonly workspace: WorkspaceId;
  getSession(): Promise<Session | null>;
  signIn(input: SignInInput): Promise<AuthResult>;
  signUp?(input: SignUpInput): Promise<AuthResult>;
  signOut(): Promise<void>;
}
