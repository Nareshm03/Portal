import type { Metadata } from "next";
import Link from "next/link";
import { LayoutDashboard, LogIn, ShieldCheck } from "lucide-react";
import { PortalMark } from "@/components/shared/portal-mark";
import { WORKSPACES } from "@/lib/workspaces";

const workspace = WORKSPACES.admin;

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Portal" },
  description: workspace.tagline,
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-white/10 bg-obsidian text-on-obsidian">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <PortalMark />
            <span aria-hidden="true" className="hidden h-5 w-px bg-white/15 sm:block" />
            <span className="hidden items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-gold sm:inline-flex">
              <ShieldCheck
                className="size-3.5"
                strokeWidth={2}
                aria-hidden="true"
              />
              Admin
            </span>
          </div>

          <nav aria-label="Admin" className="flex items-center gap-5 text-sm">
            <Link
              href={workspace.loginPath}
              className="inline-flex items-center gap-1.5 text-on-obsidian/70 transition-colors hover:text-gold"
            >
              <LogIn className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Sign in
            </Link>
            <Link
              href={workspace.dashboardPath}
              className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 px-3 py-1.5 font-medium text-gold transition-colors hover:border-gold hover:bg-gold/10"
            >
              <LayoutDashboard
                className="size-4"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-muted">
          <span className="uppercase tracking-[0.18em] text-muted-foreground">
            Portal · Admin workspace
          </span>
          <span>Invite-only access.</span>
        </div>
      </footer>
    </div>
  );
}
