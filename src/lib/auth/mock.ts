import type { WorkspaceId } from "@/lib/workspaces";
import type { AuthResult, SessionUser, SignInInput, SignUpInput } from "./types";

/**
 * Prototype-only mock account store.
 *
 * Accounts live in module memory, so they reset whenever the dev server
 * restarts and are not shared between processes. That is acceptable for a
 * hackathon demo; replace this module with a real provider later.
 */

interface MockAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  workspace: WorkspaceId;
}

export interface DemoCredentials {
  email: string;
  password: string;
}

export const DEMO_CREDENTIALS: Readonly<Record<WorkspaceId, DemoCredentials>> = {
  buyer: { email: "buyer@portal.demo", password: "portal-demo" },
  traveler: { email: "traveler@portal.demo", password: "portal-demo" },
  admin: { email: "admin@portal.demo", password: "portal-demo" },
};

const accounts = new Map<string, MockAccount>();

function accountKey(workspace: WorkspaceId, email: string): string {
  return `${workspace}:${email.trim().toLowerCase()}`;
}

function seed(workspace: WorkspaceId): void {
  const demo = DEMO_CREDENTIALS[workspace];
  const key = accountKey(workspace, demo.email);
  if (accounts.has(key)) return;

  accounts.set(key, {
    id: `${workspace}_demo`,
    name: workspace.charAt(0).toUpperCase() + workspace.slice(1),
    email: demo.email,
    password: demo.password,
    workspace,
  });
}

function toSessionUser(account: MockAccount): SessionUser {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    workspace: account.workspace,
  };
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function mockSignIn(
  workspace: WorkspaceId,
  input: SignInInput,
): AuthResult {
  seed(workspace);

  if (!isNonEmpty(input?.email) || !isNonEmpty(input?.password)) {
    return { ok: false, error: "invalid-input" };
  }

  const account = accounts.get(accountKey(workspace, input.email));
  if (!account || account.password !== input.password) {
    return { ok: false, error: "invalid-credentials" };
  }

  return {
    ok: true,
    session: {
      user: toSessionUser(account),
      issuedAt: Date.now(),
    },
  };
}

export function mockSignUp(
  workspace: WorkspaceId,
  input: SignUpInput,
): AuthResult {
  seed(workspace);

  if (
    !isNonEmpty(input?.name) ||
    !isNonEmpty(input?.email) ||
    !isNonEmpty(input?.password)
  ) {
    return { ok: false, error: "invalid-input" };
  }

  if (input.password.length < 8) {
    return { ok: false, error: "invalid-input" };
  }

  const key = accountKey(workspace, input.email);
  if (accounts.has(key)) {
    return { ok: false, error: "email-taken" };
  }

  const account: MockAccount = {
    id: `${workspace}_${Date.now().toString(36)}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    workspace,
  };

  accounts.set(key, account);

  return {
    ok: true,
    session: {
      user: toSessionUser(account),
      issuedAt: Date.now(),
    },
  };
}
