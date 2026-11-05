import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  LayoutDashboard,
  LogIn,
  MapPin,
  Plane,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { PortalMark } from "@/components/shared/portal-mark";
import { WorkspaceTheme } from "@/components/ui";
import { WORKSPACES } from "@/lib/workspaces";

const workspace = WORKSPACES.traveler;

/**
 * Public Traveler chrome. Deliberately mirrors BuyerAuthShell so the two
 * entrances feel like the same product, with the Traveler label and links.
 */
export function TravelerAuthShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <WorkspaceTheme workspace="traveler" className="flex min-h-dvh flex-col">
      <header className="border-b border-white/10 bg-obsidian text-on-obsidian">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <PortalMark />
            <span
              aria-hidden="true"
              className="hidden h-5 w-px bg-white/15 sm:block"
            />
            <span className="hidden text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-gold sm:inline">
              Traveler
            </span>
          </div>

          <nav aria-label="Traveler" className="flex items-center gap-5 text-sm">
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
            Portal · Traveler workspace
          </span>
          <span>Separate credentials, separate session. Demo accounts only.</span>
        </div>
      </footer>
    </WorkspaceTheme>
  );
}

interface TravelerAuthIntroProps {
  eyebrow: string;
  title: string;
  description: string;
  bullets: readonly string[];
  footnote?: string;
}

/**
 * Editorial side panel for Traveler auth screens. Static, server-rendered and
 * deliberately route-led rather than a generic illustration.
 */
export function TravelerAuthIntro({
  eyebrow,
  title,
  description,
  bullets,
  footnote = "Mock authentication and mock passport KYC. Nothing is verified or stored.",
}: TravelerAuthIntroProps) {
  return (
    <aside className="relative overflow-hidden rounded-2xl bg-burgundy-deep p-7 text-ivory sm:p-9">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_70%_at_85%_0%,rgba(214,185,140,0.22),transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 bottom-0 size-64 rounded-full border border-champagne/15"
      />

      <div className="relative">
        <p className="eyebrow text-champagne">{eyebrow}</p>
        <h2 className="mt-3 max-w-sm text-balance text-3xl leading-tight text-ivory sm:text-4xl">
          {title}
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-ivory/65">
          {description}
        </p>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-champagne/80">
                Your next route
              </p>
              <p className="mt-1 font-serif text-xl text-ivory">
                London to Mumbai
              </p>
            </div>
            <span className="grid size-9 place-items-center rounded-full border border-champagne/40 bg-champagne/10">
              <Plane
                className="size-4 text-champagne"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </span>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-[0.625rem] text-ivory/80">
              LHR
            </span>
            <span className="relative flex-1">
              <span className="block border-t border-dashed border-champagne/35" />
              <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-champagne" />
            </span>
            <span className="rounded-md border border-champagne/30 bg-champagne/10 px-2 py-1 font-mono text-[0.625rem] text-champagne">
              BOM
            </span>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-[0.6875rem] text-ivory/55">
            <MapPin
              className="size-3.5 shrink-0 text-champagne/70"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            12–14 December · 8 kg of shared luggage space
          </p>
        </div>

        <ul className="mt-7 grid gap-3">
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-3 text-sm text-ivory/72"
            >
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-champagne/40 bg-champagne/10">
                <BadgeCheck
                  className="size-3 text-champagne"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </span>
              {bullet}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex items-start gap-2 rounded-lg border border-champagne/20 bg-champagne/10 p-3 text-[0.6875rem] leading-relaxed text-ivory/60">
          <ShieldCheck
            className="mt-0.5 size-3.5 shrink-0 text-champagne"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          {footnote}
        </div>

        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-ivory/55 transition-colors hover:text-champagne"
        >
          Back to the Portal entrance
          <ArrowRight
            className="size-3.5"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </Link>
      </div>
    </aside>
  );
}
