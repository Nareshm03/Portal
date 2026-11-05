import type { WorkspaceId } from "@/lib/workspaces";

/** The identity attached to a workspace session (legacy mock session). */
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
  | "email-taken"
  | "not-authorized"
  | "email-confirmation-required";

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; error: AuthErrorCode };

/** Profile returned by the Express backend GET /api/v1/me (authoritative for roles). */
export interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  account_status: string;
  kyc_status: string;
  created_at: string | null;
}

/** Result of a Supabase auth operation. */
export interface SupabaseAuthResult {
  ok: boolean;
  error?: string;
  user?: { id: string; email: string | null };
  requiresEmailConfirmation?: boolean;
}

/** Result of fetching a profile from the backend. */
export interface ProfileResult {
  ok: boolean;
  profile?: Profile;
  error?: string;
}

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
