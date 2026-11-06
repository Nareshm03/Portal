import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  Globe2,
  MessagesSquare,
  PackageCheck,
  Plane,
  Plus,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { Badge, ButtonLink } from "@/components/ui";
import {
  buyerHeroImage,
  buyerProfile,
  buyerSnapshot,
} from "@/lib/demo/buyer";

export const metadata: Metadata = { title: "Buyer dashboard" };

const STATS = [
  {
    label: "Active requests",
    value: buyerSnapshot.activeRequests,
    note: "Tokyo · Paris · Amsterdam",
    href: "/buyer/requests",
    icon: ClipboardList,
  },
  {
    label: "Matched travelers",
    value: buyerSnapshot.matchedTravelers,
    note: "Verified demo profiles",
    href: "/buyer/travelers",
    icon: Plane,
  },
  {
    label: "Quotes to review",
    value: buyerSnapshot.quotesToReview,
    note: "One flagged best value",
    href: "/buyer/quotes",
    icon: ReceiptText,
  },
  {
    label: "In motion",
    value: buyerSnapshot.inTransit,
    note: "One flying · one at customs",
    href: "/buyer/orders",
    icon: PackageCheck,
  },
] as const;

export default function BuyerDashboardPage() {
  return (
    <BuyerShell active="overview">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Buyer overview · {buyerProfile.city}</p>
          <h1 className="mt-2.5 max-w-2xl text-4xl leading-tight sm:text-5xl">
            Good evening, {buyerProfile.firstName}.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            Three requests are moving, three travelers are already flying your
            way, and two orders are between cities. Here is the quiet view.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-[0.6875rem] text-muted sm:inline-flex">
            <span className="size-1.5 rounded-full bg-emerald" aria-hidden="true" />
            Mock KYC verified
          </span>
          <ButtonLink
            href="/buyer/requests/new"
            leadingIcon={
              <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
            }
          >
            New product request
          </ButtonLink>
        </div>
      </header>

      {/* ── Quick action + overview ─────────────────────────────────────── */}
      <div className="mt-8 grid gap-5 xl:grid-cols-12">
        <section className="relative isolate overflow-hidden rounded-2xl bg-burgundy-deep text-ivory xl:col-span-8">
          <Image
            src={buyerHeroImage}
            alt="A champagne-toned wristwatch photographed for a product request"
            fill
            priority
            sizes="(min-width: 1280px) 55vw, 100vw"
            className="object-cover opacity-40"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-burgundy-deep via-burgundy-deep/85 to-burgundy-deep/15"
          />

          <div className="relative z-10 flex min-h-[22rem] flex-col justify-between gap-8 p-6 sm:p-9">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant="champagne">Quick action</Badge>
              <span className="text-[0.625rem] uppercase tracking-[0.18em] text-ivory/60">
                Demo request flow
              </span>
            </div>

            <div className="max-w-xl">
              <h2 className="text-3xl leading-tight text-ivory sm:text-4xl">
                From a Tokyo boutique to your door.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-ivory/70">
                Name the piece, pin down the details, and set a budget. We will
                show you how a verified traveler match would look.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <ButtonLink
                  href="/buyer/requests/new"
                  variant="champagne"
                  size="lg"
                  trailingIcon={
                    <ArrowRight
                      className="size-4"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  }
                >
                  Create a product request
                </ButtonLink>
                <Link
                  href="/buyer/requests"
                  className="text-sm font-medium text-ivory/65 underline-offset-4 transition-colors hover:text-champagne hover:underline"
                >
                  Review active requests
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[0.625rem] uppercase tracking-[0.16em] text-ivory/60">
              <span className="inline-flex items-center gap-1.5">
                <Globe2
                  className="size-3.5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                Any storefront
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Plane
                  className="size-3.5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                Any major city
              </span>
            </div>
          </div>
        </section>

        <aside className="xl:col-span-4">
          <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(43,10,19,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">At a glance</p>
                <h2 className="mt-2 text-2xl">Your sourcing desk</h2>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-champagne-strong/40 bg-champagne/15">
                <Sparkles
                  className="size-4 text-champagne-strong"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </span>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
              {STATS.map((stat) => (
                <div key={stat.label} className="bg-surface p-4">
                  <dt className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {stat.label}
                  </dt>
                  <dd className="mt-2 font-serif text-3xl leading-none text-burgundy">
                    {String(stat.value).padStart(2, "0")}
                  </dd>
                  <dd className="mt-2">
                    <Link
                      href={stat.href}
                      className="inline-flex items-center gap-1 text-[0.625rem] text-muted transition-colors hover:text-burgundy"
                    >
                      {stat.note}
                      <ArrowUpRight
                        className="size-3"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </Link>
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-5 rounded-lg border border-champagne-strong/25 bg-champagne/10 p-3 text-[0.6875rem] leading-relaxed text-muted">
              <span className="font-medium text-burgundy">
                {buyerSnapshot.quotesToReview} quotes
              </span>{" "}
              are waiting for a decision. Use the sidebar to explore requests,
              travelers, and active orders.
            </p>
          </div>
        </aside>
      </div>

      {/* ── Quick links ─────────────────────────────────────────────────── */}
      <section className="mt-14">
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <div>
            <p className="eyebrow">Workspace navigation</p>
            <h2 className="mt-2 text-2xl">Explore your Buyer workspace</h2>
            <p className="mt-2 text-sm text-muted">
              Use the sidebar or quick links below to navigate to specific
              sections.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="group rounded-xl border border-border bg-surface-muted/40 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-champagne-strong/60 hover:bg-surface hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <Icon
                      className="size-5 text-champagne-strong transition-transform group-hover:scale-110"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <ArrowUpRight
                      className="size-4 text-muted transition-colors group-hover:text-burgundy"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-4 font-medium text-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-xs text-muted">{stat.note}</p>
                  <p className="mt-3 font-serif text-2xl text-burgundy">
                    {String(stat.value).padStart(2, "0")}
                  </p>
                </Link>
              );
            })}
          </div>

          <div className="mt-6 flex items-center gap-4 border-t border-border pt-6">
            <MessagesSquare
              className="size-5 text-champagne-strong"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {buyerSnapshot.unreadMessages} unread message
                {buyerSnapshot.unreadMessages === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Updates from travelers carrying your orders
              </p>
            </div>
            <Link
              href="/buyer/messages"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-burgundy transition-colors hover:text-burgundy-deep"
            >
              View messages
              <ArrowRight
                className="size-4"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>
      </section>
    </BuyerShell>
  );
}
