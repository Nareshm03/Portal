import type { Metadata } from "next";
import Link from "next/link";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { WORKSPACES } from "@/lib/workspaces";

export const metadata: Metadata = { title: "Admin sign in" };

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-white/10 bg-obsidian text-on-obsidian">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <span className="hidden text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-gold sm:inline-flex">
              Admin
            </span>
          </div>
          <nav aria-label="Admin" className="flex items-center gap-5 text-sm">
            <Link
              href={WORKSPACES.admin.loginPath}
              className="inline-flex items-center gap-1.5 text-on-obsidian/70 transition-colors hover:text-gold"
            >
              Sign in
            </Link>
            <Link
              href={WORKSPACES.admin.dashboardPath}
              className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 px-3 py-1.5 font-medium text-gold transition-colors hover:border-gold hover:bg-gold/10"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <AdminLoginForm />
      </main>
    </div>
  );
}
