import Link from "next/link";
import { LogIn, UserPlus } from "lucide-react";
import { PortalMark } from "@/components/shared/portal-mark";
import { WorkspaceTheme } from "@/components/ui";
import { WORKSPACES } from "@/lib/workspaces";

const workspace = WORKSPACES.buyer;

/**
 * The original Buyer header/footer, kept for the public auth screens so they
 * look unchanged while the dashboard moves to its own sidebar shell.
 */
export function BuyerAuthShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <WorkspaceTheme workspace="buyer" className="flex min-h-dvh flex-col">
      <header className="border-b border-white/10 bg-obsidian text-on-obsidian">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <PortalMark />
            <span
              aria-hidden="true"
              className="hidden h-5 w-px bg-white/15 sm:block"
            />
            <span className="hidden text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-gold sm:inline">
              Buyer
            </span>
          </div>

          <nav aria-label="Buyer" className="flex items-center gap-5 text-sm">
            <Link
              href={workspace.loginPath}
              className="inline-flex items-center gap-1.5 text-on-obsidian/70 transition-colors hover:text-gold"
            >
              <LogIn className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Sign in
            </Link>
            {workspace.registerPath && (
              <Link
                href={workspace.registerPath}
                className="inline-flex items-center gap-1.5 text-on-obsidian/70 transition-colors hover:text-gold"
              >
                <UserPlus
                  className="size-4"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                Register
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-muted">
          <span className="uppercase tracking-[0.18em] text-muted-foreground">
            Portal · Buyer workspace
          </span>
          <span>Separate credentials, separate session.</span>
        </div>
      </footer>
    </WorkspaceTheme>
  );
}
