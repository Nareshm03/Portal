import Link from "next/link";
import {
  CalendarDays,
  Camera,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  PackageCheck,
  Plane,
  QrCode,
  ReceiptText,
  Sparkles,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { signOutTravelerAction } from "@/app/traveler/actions";
import { PortalMark } from "@/components/shared/portal-mark";
import { WorkspaceTheme } from "@/components/ui";
import {
  TRAVELER_DEMO_NOTICE,
  getInitials,
  travelerProfile,
  travelerSnapshot,
} from "@/lib/demo/traveler";
import { cn } from "@/lib/utils";

export type TravelerNavKey =
  | "overview"
  | "new-trip"
  | "trips"
  | "requests"
  | "quotes"
  | "messages"
  | "orders"
  | "proof"
  | "handover"
  | "earnings"
  | "profile";

interface TravelerNavItem {
  key: TravelerNavKey;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

const NAV_GROUPS: readonly {
  label: string;
  items: readonly TravelerNavItem[];
}[] = [
  {
    label: "Workspace",
    items: [
      {
        key: "overview",
        label: "Overview",
        href: "/traveler/dashboard",
        icon: LayoutDashboard,
      },
      {
        key: "new-trip",
        label: "Register a trip",
        href: "/traveler/trips/new",
        icon: CalendarDays,
      },
    ],
  },
  {
    label: "Journeys",
    items: [
      {
        key: "trips",
        label: "My trips",
        href: "/traveler/dashboard#trips",
        icon: Plane,
        badge: travelerSnapshot.upcomingTrips,
      },
      {
        key: "requests",
        label: "Available requests",
        href: "/traveler/requests",
        icon: ClipboardList,
        badge: travelerSnapshot.openRequests,
      },
      {
        key: "quotes",
        label: "My quotes",
        href: "/traveler/dashboard#quotes",
        icon: ReceiptText,
        badge: travelerSnapshot.pendingQuotes,
      },
      {
        key: "messages",
        label: "Messages",
        href: "/traveler/dashboard#messages",
        icon: MessagesSquare,
        badge: travelerSnapshot.unreadMessages,
      },
      {
        key: "orders",
        label: "Active orders",
        href: "/traveler/dashboard#orders",
        icon: PackageCheck,
        badge: travelerSnapshot.activeOrders,
      },
    ],
  },
  {
    label: "Fulfilment",
    items: [
      {
        key: "proof",
        label: "Purchase proof",
        href: "/traveler/dashboard#proof",
        icon: Camera,
      },
      {
        key: "handover",
        label: "Arrival & handover",
        href: "/traveler/dashboard#handover",
        icon: QrCode,
      },
      {
        key: "earnings",
        label: "Earnings",
        href: "/traveler/dashboard#earnings",
        icon: Wallet,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        key: "profile",
        label: "Profile & passport KYC",
        href: "/traveler/dashboard#profile",
        icon: UserRound,
      },
    ],
  },
];

function NavItem({
  item,
  active,
}: {
  item: TravelerNavItem;
  active: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors duration-200",
        active
          ? "border-champagne/40 bg-champagne text-burgundy-deep"
          : "border-transparent text-ivory/65 hover:bg-white/5 hover:text-ivory",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active
            ? "text-burgundy-deep"
            : "text-ivory/70 group-hover:text-champagne",
        )}
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span
          className={cn(
            "grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold",
            active
              ? "bg-burgundy-deep text-champagne"
              : "bg-white/10 text-ivory/70",
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function TravelerNav({ active }: { active?: TravelerNavKey }) {
  return (
    <nav aria-label="Traveler" className="grid gap-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-2 text-[0.5625rem] font-semibold uppercase tracking-[0.24em] text-ivory/60">
            {group.label}
          </p>
          <div className="grid gap-1">
            {group.items.map((item) => (
              <NavItem
                key={item.key}
                item={item}
                active={item.key === active}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function TravelerIdentity({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", compact ? "p-2" : "p-3")}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-champagne/40 bg-champagne/15 text-xs font-semibold text-champagne">
        {getInitials(travelerProfile.fullName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ivory">
          {travelerProfile.fullName}
        </p>
        <p className="truncate text-[0.625rem] uppercase tracking-[0.14em] text-champagne/70">
          Demo traveler
        </p>
      </div>
      <form action={signOutTravelerAction}>
        <button
          type="submit"
          aria-label="Sign out of the demo Traveler workspace"
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-ivory/60 transition-colors hover:bg-white/10 hover:text-champagne"
        >
          <LogOut className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

/**
 * Chrome for the signed-in Traveler workspace.
 *
 * Mirrors the Buyer shell deliberately: same burgundy sidebar, same mobile
 * <details> menu, but champagne-led active states so the two workspaces read as
 * siblings. No live session is required in this demo phase.
 */
export function TravelerShell({
  children,
  active,
}: Readonly<{ children: React.ReactNode; active?: TravelerNavKey }>) {
  return (
    <WorkspaceTheme workspace="traveler" className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col overflow-y-auto bg-burgundy-deep text-ivory lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(214,185,140,0.2),transparent_45%)]"
        />

        <div className="relative flex min-h-full flex-col">
          <div className="px-6 pb-6 pt-7">
            <PortalMark className="text-ivory" />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-champagne/30 bg-champagne/10 px-2.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-champagne">
                Traveler
              </span>
              <span className="text-[0.5625rem] uppercase tracking-[0.18em] text-ivory/60">
                Fulfilment workspace
              </span>
            </div>
          </div>

          <div className="relative px-3">
            <TravelerNav active={active} />
          </div>

          <div className="mx-4 mt-8 rounded-xl border border-champagne/20 bg-[linear-gradient(145deg,rgba(214,185,140,0.18),rgba(214,185,140,0.03))] p-4">
            <Sparkles
              className="size-4 text-champagne"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <p className="mt-2 text-xs font-medium text-ivory">Trip desk</p>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-ivory/60">
              A demo assistant would line up requests with your route, dates
              and luggage space.
            </p>
          </div>

          <div className="mt-auto border-t border-white/10 p-4">
            <TravelerIdentity />
            <p className="mt-2 px-3 text-[0.5625rem] uppercase tracking-[0.18em] text-ivory/60">
              Demo profile · no live session
            </p>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-burgundy-deep text-ivory lg:hidden">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <PortalMark className="text-ivory" />

          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-xs font-medium text-ivory/80 transition-colors hover:border-champagne/50 hover:text-champagne [&::-webkit-details-marker]:hidden">
              <Menu className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Menu
            </summary>

            <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 max-h-[calc(100dvh-6rem)] w-[min(19rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-champagne/20 bg-burgundy-deep p-3 shadow-2xl">
              <TravelerNav active={active} />
              <div className="mt-3 border-t border-white/10 pt-2">
                <TravelerIdentity compact />
                <p className="px-2 text-[0.5625rem] uppercase tracking-[0.18em] text-ivory/60">
                  Demo workspace
                </p>
              </div>
            </div>
          </details>
        </div>
      </header>

      <div className="lg:pl-72">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-champagne-strong/25 bg-champagne/10 px-4 py-2 sm:px-6 lg:px-10">
          <span className="inline-flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-champagne-ink">
            <FlaskConical
              className="size-3.5"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            Demo preview
          </span>
          <span className="text-[0.625rem] text-muted">
            Sample traveler data · no live backend, passport or payment checks
          </span>
        </div>

        <main className="mx-auto w-full max-w-[1380px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
          {children}
        </main>

        <footer className="mx-auto flex w-full max-w-[1380px] flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-6 text-[0.6875rem] text-muted-foreground sm:px-6 lg:px-10">
          <span className="uppercase tracking-[0.18em]">
            Portal · Traveler workspace
          </span>
          <span className="max-w-xl text-right">{TRAVELER_DEMO_NOTICE}</span>
        </footer>
      </div>
    </WorkspaceTheme>
  );
}
