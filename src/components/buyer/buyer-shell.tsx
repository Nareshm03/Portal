import Link from "next/link";
import {
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  PackageCheck,
  PackagePlus,
  Plane,
  ReceiptText,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { PortalMark } from "@/components/shared/portal-mark";
import { WorkspaceTheme } from "@/components/ui";
import {
  BUYER_DEMO_NOTICE,
  buyerProfile,
  buyerSnapshot,
  getInitials,
} from "@/lib/demo/buyer";
import { cn } from "@/lib/utils";

export type BuyerNavKey =
  | "overview"
  | "new-request"
  | "requests"
  | "travelers"
  | "quotes"
  | "messages"
  | "orders"
  | "account";

interface BuyerNavItem {
  key: BuyerNavKey;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

const NAV_GROUPS: readonly {
  label: string;
  items: readonly BuyerNavItem[];
}[] = [
  {
    label: "Workspace",
    items: [
      {
        key: "overview",
        label: "Overview",
        href: "/buyer/dashboard",
        icon: LayoutDashboard,
      },
      {
        key: "new-request",
        label: "New request",
        href: "/buyer/requests/new",
        icon: PackagePlus,
      },
    ],
  },
  {
    label: "Sourcing",
    items: [
      {
        key: "requests",
        label: "Active requests",
        href: "/buyer/dashboard#requests",
        icon: ClipboardList,
        badge: buyerSnapshot.activeRequests,
      },
      {
        key: "travelers",
        label: "Matched travelers",
        href: "/buyer/dashboard#travelers",
        icon: Plane,
      },
      {
        key: "quotes",
        label: "Quotes",
        href: "/buyer/dashboard#quotes",
        icon: ReceiptText,
        badge: buyerSnapshot.quotesToReview,
      },
      {
        key: "messages",
        label: "Messages",
        href: "/buyer/dashboard#messages",
        icon: MessagesSquare,
        badge: buyerSnapshot.unreadMessages,
      },
      {
        key: "orders",
        label: "Orders",
        href: "/buyer/dashboard#orders",
        icon: PackageCheck,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        key: "account",
        label: "Profile & settings",
        href: "/buyer/dashboard#account",
        icon: UserRound,
      },
    ],
  },
];

function NavItem({ item, active }: { item: BuyerNavItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors duration-200",
        active
          ? "border-champagne/25 bg-champagne/15 text-champagne"
          : "border-transparent text-ivory/65 hover:bg-white/5 hover:text-ivory",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active
            ? "text-champagne"
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
              ? "bg-champagne text-burgundy-deep"
              : "bg-white/10 text-ivory/70",
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function BuyerNav({ active }: { active?: BuyerNavKey }) {
  return (
    <nav aria-label="Buyer" className="grid gap-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-2 text-[0.5625rem] font-semibold uppercase tracking-[0.24em] text-ivory/60">
            {group.label}
          </p>
          <div className="grid gap-1">
            {group.items.map((item) => (
              <NavItem key={item.key} item={item} active={item.key === active} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function BuyerIdentity({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", compact ? "p-2" : "p-3")}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-champagne/40 bg-champagne/15 text-xs font-semibold text-champagne">
        {getInitials(buyerProfile.fullName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ivory">
          {buyerProfile.fullName}
        </p>
        <p className="truncate text-[0.625rem] uppercase tracking-[0.14em] text-champagne/70">
          Demo buyer
        </p>
      </div>
      <Link
        href="/buyer/login"
        aria-label="Sign out of the demo Buyer workspace"
        className="grid size-8 shrink-0 place-items-center rounded-md text-ivory/60 transition-colors hover:bg-white/10 hover:text-champagne"
      >
        <LogOut className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </Link>
    </div>
  );
}

/**
 * Chrome for the signed-in Buyer workspace.
 *
 * The mobile menu intentionally uses native <details> so the shell stays a
 * server component. No live session is read in this phase.
 */
export function BuyerShell({
  children,
  active,
}: Readonly<{ children: React.ReactNode; active?: BuyerNavKey }>) {
  return (
    <WorkspaceTheme workspace="buyer" className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col overflow-y-auto bg-burgundy-deep text-ivory lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(214,185,140,0.18),transparent_45%)]"
        />

        <div className="relative flex min-h-full flex-col">
          <div className="px-6 pb-6 pt-7">
            <PortalMark className="text-ivory" />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-champagne/30 bg-champagne/10 px-2.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-champagne">
                Buyer
              </span>
              <span className="text-[0.5625rem] uppercase tracking-[0.18em] text-ivory/60">
                Sourcing workspace
              </span>
            </div>
          </div>

          <div className="relative px-3">
            <BuyerNav active={active} />
          </div>

          <div className="mx-4 mt-8 rounded-xl border border-champagne/20 bg-[linear-gradient(145deg,rgba(214,185,140,0.18),rgba(214,185,140,0.03))] p-4">
            <Sparkles
              className="size-4 text-champagne"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <p className="mt-2 text-xs font-medium text-ivory">
              Sourcing concierge
            </p>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-ivory/60">
              A demo assistant would compare quotes and check customs here.
            </p>
          </div>

          <div className="mt-auto border-t border-white/10 p-4">
            <BuyerIdentity />
            <p className="mt-2 px-3 text-[0.5625rem] uppercase tracking-[0.18em] text-ivory/60">
              No live session
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

            <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-champagne/20 bg-burgundy-deep p-3 shadow-2xl">
              <BuyerNav active={active} />
              <div className="mt-3 border-t border-white/10 pt-2">
                <BuyerIdentity compact />
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
            Sample buyer data · no live backend
          </span>
        </div>

        <main className="mx-auto w-full max-w-[1380px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
          {children}
        </main>

        <footer className="mx-auto flex w-full max-w-[1380px] flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-6 text-[0.6875rem] text-muted-foreground sm:px-6 lg:px-10">
          <span className="uppercase tracking-[0.18em]">
            Portal · Buyer workspace
          </span>
          <span className="max-w-xl text-right">{BUYER_DEMO_NOTICE}</span>
        </footer>
      </div>
    </WorkspaceTheme>
  );
}
