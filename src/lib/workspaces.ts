/**
 * Single source of truth for the three Portal workspaces.
 *
 * Nothing else should hardcode workspace paths or cookie names.
 */
export const WORKSPACE_IDS = ["buyer", "traveler", "admin"] as const;

export type WorkspaceId = (typeof WORKSPACE_IDS)[number];

export interface Workspace {
  readonly id: WorkspaceId;
  readonly label: string;
  readonly tagline: string;
  readonly basePath: `/${WorkspaceId}`;
  readonly loginPath: string;
  /** `null` when self-registration is not offered (Admin). */
  readonly registerPath: string | null;
  readonly dashboardPath: string;
  /** Each workspace owns a distinct cookie, scoped to its own path. */
  readonly sessionCookie: string;
}

export const WORKSPACES: Readonly<Record<WorkspaceId, Workspace>> = {
  buyer: {
    id: "buyer",
    label: "Buyer",
    tagline: "Discover and acquire exceptional stays.",
    basePath: "/buyer",
    loginPath: "/buyer/login",
    registerPath: "/buyer/register",
    dashboardPath: "/buyer/dashboard",
    sessionCookie: "portal_buyer_session",
  },
  traveler: {
    id: "traveler",
    label: "Traveler",
    tagline: "Curate journeys worth remembering.",
    basePath: "/traveler",
    loginPath: "/traveler/login",
    registerPath: "/traveler/register",
    dashboardPath: "/traveler/dashboard",
    sessionCookie: "portal_traveler_session",
  },
  admin: {
    id: "admin",
    label: "Admin",
    tagline: "Oversee the platform with clarity.",
    basePath: "/admin",
    loginPath: "/admin/login",
    registerPath: null,
    dashboardPath: "/admin/dashboard",
    sessionCookie: "portal_admin_session",
  },
} as const;

export const WORKSPACE_LIST: readonly Workspace[] = WORKSPACE_IDS.map(
  (id) => WORKSPACES[id],
);

export function isWorkspaceId(value: string): value is WorkspaceId {
  return (WORKSPACE_IDS as readonly string[]).includes(value);
}

export function getWorkspace(id: WorkspaceId): Workspace {
  return WORKSPACES[id];
}
