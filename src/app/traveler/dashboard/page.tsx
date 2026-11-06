import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Camera,
  MapPin,
  Plane,
  Plus,
  QrCode,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { Badge, ButtonLink, SectionHeading, StatusBadge } from "@/components/ui";
import {
  airportLabel,
  availableRequests,
  formatCurrency,
  formatDate,
  nextTravelerTrip,
  travelerHeroImage,
  travelerProfile,
  travelerSnapshot,
} from "@/lib/demo/traveler";

export const metadata: Metadata = { title: "Traveler dashboard" };

const STATS = [
  {
    label: "Upcoming trips",
    value: travelerSnapshot.upcomingTrips,
    note: "Next: London → Mumbai",
    href: "/traveler/trips",
  },
  {
    label: "Open requests",
    value: travelerSnapshot.openRequests,
    note: "Matching your routes",
    href: "/traveler/requests",
  },
  {
    label: "Pending quotes",
    value: travelerSnapshot.pendingQuotes,
    note: "Awaiting buyer decision",
    href: "/traveler/quotes",
  },
  {
    label: "Active orders",
    value: travelerSnapshot.activeOrders,
    note: "Two in your care",
    href: "/traveler/orders",
  },
] as const;

export default function TravelerDashboardPage() {
  return (
    <TravelerShell active="overview">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">
            Traveler overview · {travelerProfile.baseCity}
          </p>
          <h1 className="mt-2.5 max-w-2xl text-4xl leading-tight sm:text-5xl">
            Good evening, {travelerProfile.firstName}.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            Your next London–Mumbai flight is on the 12th. Two buyer requests
            are already matched to your route, and two active orders are
            travelling with you. Here is the quiet view.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-[0.6875rem] text-muted sm:inline-flex">
            <span
              className="size-1.5 rounded-full bg-emerald"
              aria-hidden="true"
            />
            Mock passport KYC verified
          </span>
          <ButtonLink
            href="/traveler/trips/new"
            leadingIcon={
              <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
            }
          >
            Register a trip
          </ButtonLink>
        </div>
      </header>

      {/* ── Quick action + overview ─────────────────────────────────────── */}
      <div className="mt-8 grid gap-5 xl:grid-cols-12">
        <section className="relative isolate overflow-hidden rounded-2xl bg-burgundy-deep text-ivory xl:col-span-8">
          <Image
            src={travelerHeroImage}
            alt="An aerial view of a plane wing over coastal waters, representing traveler journeys"
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
              <Badge variant="champagne">Next trip</Badge>
              <span className="text-[0.625rem] uppercase tracking-[0.18em] text-ivory/60">
                {nextTravelerTrip.reference}
              </span>
            </div>

            <div className="max-w-xl">
              <h2 className="text-3xl leading-tight text-ivory sm:text-4xl">
                {nextTravelerTrip.originCity} to{" "}
                {airportLabel(nextTravelerTrip.destinationAirport)
                  .split("·")[1]
                  ?.trim()}
                .
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-ivory/70">
                {nextTravelerTrip.airline} {nextTravelerTrip.flightNumber},{" "}
                {formatDate(nextTravelerTrip.arrivalDate)}. Two buyer requests
                are already matched to this route, with{" "}
                {nextTravelerTrip.luggageSpaceKg} kg of available luggage space.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <ButtonLink
                  href="/traveler/requests"
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
                  Explore matching requests
                </ButtonLink>
                <Link
                  href="/traveler/trips"
                  className="text-sm font-medium text-ivory/65 underline-offset-4 transition-colors hover:text-champagne hover:underline"
                >
                  View all trips
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[0.625rem] uppercase tracking-[0.16em] text-ivory/60">
              <span className="inline-flex items-center gap-1.5">
                <Plane
                  className="size-3.5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {nextTravelerTrip.originCode} →{" "}
                {nextTravelerTrip.destinationAirport}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays
                  className="size-3.5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {formatDate(nextTravelerTrip.departureDate)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck
                  className="size-3.5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                Verified demo traveler
              </span>
            </div>
          </div>
        </section>

        <aside className="xl:col-span-4">
          <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(43,10,19,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">At a glance</p>
                <h2 className="mt-2 text-2xl">Your trip desk</h2>
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
                {travelerSnapshot.unreadMessages} messages
              </span>{" "}
              are waiting for a reply. Active orders include receipt and arrival
              evidence for demo handovers.
            </p>
          </div>
        </aside>
      </div>

      {/* ── Available requests sample ────────────────────────────────────── */}
      <section className="mt-14">
        <SectionHeading
          eyebrow="Matching your routes"
          title="Available buyer requests"
          description="Three sample buyer requests that fit your upcoming trips."
          actions={
            <ButtonLink
              href="/traveler/requests"
              variant="outline"
              size="sm"
              trailingIcon={
                <ArrowRight
                  className="size-4"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              }
            >
              View all requests
            </ButtonLink>
          }
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {availableRequests.slice(0, 3).map((request) => (
            <article
              key={request.id}
              className="group overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-champagne-strong/60 hover:shadow-md"
            >
              <div className="relative h-40 w-full overflow-hidden bg-surface-muted">
                <Image
                  src={request.imageUrl}
                  alt={request.productName}
                  fill
                  sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span className="absolute left-3 top-3 rounded-full bg-burgundy-deep/80 px-2 py-0.5 text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-champagne">
                  Demo
                </span>
              </div>

              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={request.status} />
                  <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {request.reference}
                  </span>
                </div>

                <h3 className="mt-3 line-clamp-2 text-lg leading-snug">
                  {request.productName}
                </h3>

                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                  <MapPin
                    className="size-3.5 shrink-0 text-champagne-strong"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {request.originCity} →{" "}
                  {airportLabel(request.destinationAirport)}
                </p>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>
                    Needed{" "}
                    <strong className="font-medium text-foreground">
                      {formatDate(request.requiredBy)}
                    </strong>
                  </span>
                  {request.budgetUsd && (
                    <span>
                      <strong className="font-medium text-foreground">
                        {formatCurrency(request.budgetUsd)}
                      </strong>{" "}
                      budget
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-4 text-[0.6875rem] leading-relaxed text-muted-foreground">
          Sample buyer requests for demonstration only. No live matching or
          contact with buyers.
        </p>
      </section>

      {/* ── Quick links ──────────────────────────────────────────────────── */}
      <section className="mt-14">
        <p className="eyebrow">Fulfilment & account</p>
        <h2 className="mt-2 text-2xl">Quick links</h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/traveler/proof"
            className="group rounded-2xl border border-border bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-champagne-strong/60 hover:shadow-md"
          >
            <span className="grid size-10 place-items-center rounded-full border border-champagne-strong/40 bg-champagne/10">
              <Camera
                className="size-5 text-champagne-strong"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </span>
            <h3 className="mt-4 text-base font-medium">Purchase proof</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Upload receipts and product condition photos
            </p>
          </Link>

          <Link
            href="/traveler/handover"
            className="group rounded-2xl border border-border bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-champagne-strong/60 hover:shadow-md"
          >
            <span className="grid size-10 place-items-center rounded-full border border-champagne-strong/40 bg-champagne/10">
              <QrCode
                className="size-5 text-champagne-strong"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </span>
            <h3 className="mt-4 text-base font-medium">Arrival & handover</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Mark arrival and prepare for buyer handover
            </p>
          </Link>

          <Link
            href="/traveler/earnings"
            className="group rounded-2xl border border-border bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-champagne-strong/60 hover:shadow-md"
          >
            <span className="grid size-10 place-items-center rounded-full border border-champagne-strong/40 bg-champagne/10">
              <Wallet
                className="size-5 text-champagne-strong"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </span>
            <h3 className="mt-4 text-base font-medium">Demo earnings</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              View carrying fees and illustrative demo totals
            </p>
          </Link>

          <Link
            href="/traveler/profile"
            className="group rounded-2xl border border-border bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-champagne-strong/60 hover:shadow-md"
          >
            <span className="grid size-10 place-items-center rounded-full border border-champagne-strong/40 bg-champagne/10">
              <ShieldCheck
                className="size-5 text-champagne-strong"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </span>
            <h3 className="mt-4 text-base font-medium">Passport KYC</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Review mock passport verification details
            </p>
          </Link>
        </div>
      </section>
    </TravelerShell>
  );
}
