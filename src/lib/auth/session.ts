import { cookies } from "next/headers";
import { WORKSPACES, type WorkspaceId } from "@/lib/workspaces";
import type { Session } from "./types";

/**
 * Cookie-backed session transport for the mock auth flow.
 *
 * The payload is base64url-encoded JSON and is NOT signed or encrypted.
 * It exists to demo per-workspace isolation, not to secure anything.
 * Replace with HttpOnly signed sessions when a real provider is added.
 */

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function encodeSession(session: Session): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

function decodeSession(raw: string | undefined | null): Session | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("user" in parsed) ||
      !("issuedAt" in parsed)
    ) {
      return null;
    }

    const candidate = parsed as Session;
    const { user } = candidate;

    if (
      typeof user?.id !== "string" ||
      typeof user?.email !== "string" ||
      typeof user?.name !== "string" ||
      typeof user?.workspace !== "string" ||
      !(user.workspace in WORKSPACES) ||
      typeof candidate.issuedAt !== "number"
    ) {
      return null;
    }

    return candidate;
  } catch {
    return null;
  }
}

export async function getSession(
  workspace: WorkspaceId,
): Promise<Session | null> {
  const store = await cookies();
  const session = decodeSession(
    store.get(WORKSPACES[workspace].sessionCookie)?.value,
  );

  // A Buyer cookie must never satisfy a Traveler or Admin request.
  if (!session || session.user.workspace !== workspace) return null;

  return session;
}

export async function createSession(session: Session): Promise<void> {
  const workspace = WORKSPACES[session.user.workspace];
  const store = await cookies();

  store.set({
    name: workspace.sessionCookie,
    value: encodeSession(session),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Scoped to /buyer, /traveler or /admin so it is never sent elsewhere.
    path: workspace.basePath,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(workspace: WorkspaceId): Promise<void> {
  const store = await cookies();

  store.set({
    name: WORKSPACES[workspace].sessionCookie,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: WORKSPACES[workspace].basePath,
    maxAge: 0,
  });
}
