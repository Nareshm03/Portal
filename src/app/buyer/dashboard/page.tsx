import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Globe2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Plane,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { Badge, ButtonLink, SectionHeading, StatusBadge } from "@/components/ui";
import {
  ORDER_STAGES,
  activeOrders,
  airportLabel,
  buyerHeroImage,
  buyerProfile,
  buyerSnapshot,
  conversations,
  formatCurrency,
  formatDate,
  getInitials,
  matchedTravelers,
  productRequests,
  quoteTotal,
  quotesReceived,
} from "@/lib/demo/buyer";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Buyer dashboard" };

const STATS = [
  {
    label: "Active requests",
    value: buyerSnapshot.activeRequests,
    note: "Tokyo · Paris · Amsterdam",
    href: "#requests",
  },
  {
    label: "Matched travelers",
    value: buyerSnapshot.matchedTravelers,
    note: "Verified demo profiles",
    href: "#travelers",
  },
  {
    label: "Quotes to review",
    value: buyerSnapshot.quotesToReview,
    note: "One flagged best value",
    href: "#quotes",
  },
  {
    label: "In motion",
    value: buyerSnapshot.inTransit,
    note: "One flying · one at customs",
    href: "#orders",
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
                  href="#requests"
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
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck
                  className="size-3.5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                One verified handover
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
              are waiting for a decision. Totals below include demo carrying
              fees and indicative duty.
            </p>
          </div>
        </aside>
      </div>

      {/* ── Active product requests ────────────────────────────────────── */}
      <section id="requests" className="mt-14 scroll-mt-28">
        <SectionHeading
          eyebrow="Sourcing pipeline"
          title="Active product requests"
          description="Three briefs in play, each at a different point on the route home."
          actions={
            <ButtonLink
              href="/buyer/requests/new"
              variant="outline"
              size="sm"
              leadingIcon={
                <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
              }
            >
              New request
            </ButtonLink>
          }
        />

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
          {productRequests.map((request, index) => (
            <article
              key={request.id}
              className={cn(
                "group grid gap-5 p-5 transition-colors hover:bg-surface-muted/30 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center",
                index !== productRequests.length - 1 && "border-b border-border",
              )}
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-surface-muted sm:size-[6.5rem]">
                <Image
                  src={request.imageUrl}
                  alt={request.name}
                  fill
                  sizes="104px"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span className="absolute left-2 top-2 rounded-full bg-burgundy-deep/80 px-1.5 py-0.5 text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-champagne">
                  Demo
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    status={request.status}
                    className={
                      request.status === "matched"
                        ? "text-champagne-ink"
                        : undefined
                    }
                  />
                  <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Request {request.id.toUpperCase()}
                  </span>
                </div>

                <h3 className="mt-2 text-xl">{request.name}</h3>

                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                  <span>
                    {request.originCity}, {request.originCountry}
                  </span>
                  <ArrowRight
                    className="size-3.5 text-champagne-strong"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span>{airportLabel(request.destinationAirport)}</span>
                </p>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                  <span>
                    <strong className="font-medium text-foreground">
                      {formatCurrency(request.budgetUsd)}
                    </strong>{" "}
                    budget
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays
                      className="size-3.5 text-champagne-strong"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    Needed {formatDate(request.requiredBy)}
                  </span>
                  <span>{request.variant}</span>
                </div>
              </div>

              <div className="sm:min-w-32 sm:text-right">
                <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Match signal
                </p>
                <p className="mt-1 font-serif text-2xl text-burgundy">
                  {request.matchedTravelers}{" "}
                  <span className="font-sans text-xs tracking-normal text-muted">
                    {request.matchedTravelers === 1 ? "traveler" : "travelers"}
                  </span>
                </p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-surface-muted sm:ml-auto sm:w-28">
                  <div
                    className="h-full rounded-full bg-champagne-strong"
                    style={{ width: `${request.matchProgress}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[0.625rem] text-muted">
                  {request.quotesReceived}{" "}
                  {request.quotesReceived === 1 ? "quote" : "quotes"} received
                </p>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-3 text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
          Demo requests · no traveler has been contacted
        </p>
      </section>

      {/* ── Travelers + quotes ─────────────────────────────────────────── */}
      <div className="mt-14 grid gap-8 xl:grid-cols-12 xl:gap-6">
        <section id="travelers" className="scroll-mt-28 xl:col-span-5">
          <SectionHeading
            eyebrow="Matched travelers"
            title="People already flying your way."
            description="Demo profiles matched by route, date and luggage space."
          />

          <div className="mt-6 grid gap-4">
            {matchedTravelers.map((traveler) => (
              <article
                key={traveler.id}
                className="group rounded-2xl border border-border bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-champagne-strong/60 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-burgundy text-xs font-semibold text-ivory">
                      {getInitials(traveler.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{traveler.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                        <Star
                          className="size-3 fill-champagne-strong text-champagne-strong"
                          aria-hidden="true"
                        />
                        {traveler.rating} · {traveler.carries} demo carries
                      </p>
                    </div>
                  </div>
                  <Badge variant="emerald" dot>
                    Verified
                  </Badge>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-md border border-border bg-surface-muted/60 px-2 py-1 font-mono text-xs text-foreground">
                    {traveler.fromCode}
                  </span>
                  <Plane
                    className="size-4 text-champagne-strong"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span className="rounded-md border border-border bg-surface-muted/60 px-2 py-1 font-mono text-xs text-foreground">
                    {traveler.toCode}
                  </span>
                  <span className="ml-auto text-xs text-muted">
                    {traveler.travelWindow}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {traveler.luggageSpaceKg} kg space · {traveler.fromCity} →{" "}
                    {traveler.toCity}
                  </span>
                  <span className="inline-flex items-center gap-1 text-burgundy">
                    <Sparkles
                      className="size-3 text-champagne-strong"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    For {traveler.matchedRequest}
                  </span>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-4 text-[0.6875rem] leading-relaxed text-muted-foreground">
            Sample matches for demonstration only. No traveler has been
            contacted and no carry agreement exists.
          </p>
        </section>

        <section id="quotes" className="scroll-mt-28 xl:col-span-7">
          <SectionHeading
            eyebrow="Quotes received"
            title="A quiet ledger of what it costs."
            description="Item price, carrying fee and an indicative duty estimate in one line."
            actions={
              <Badge variant="sapphire">
                {buyerSnapshot.quotesToReview} awaiting review
              </Badge>
            }
          />

          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="hidden grid-cols-[1.5fr_repeat(3,minmax(0,1fr))_auto] gap-4 border-b border-border bg-surface-muted/50 px-5 py-3 text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:grid">
              <span>Request & traveler</span>
              <span className="text-right">Item</span>
              <span className="text-right">Carry</span>
              <span className="text-right">Est. duty</span>
              <span className="text-right">Total</span>
            </div>

            {quotesReceived.map((quote) => (
              <div
                key={quote.id}
                className="border-b border-border/70 px-5 py-4 last:border-b-0"
              >
                <div className="grid gap-3 sm:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))_auto] sm:items-center sm:gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {quote.requestName}
                      </p>
                      {quote.recommended && (
                        <Badge
                          variant="champagne"
                          className="text-champagne-ink"
                        >
                          Best value
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {quote.travelerName} · valid to{" "}
                      {formatDate(quote.validUntil)}
                    </p>
                  </div>

                  <div className="flex items-baseline justify-between sm:block sm:text-right">
                    <span className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
                      Item
                    </span>
                    <span className="text-sm text-muted">
                      {formatCurrency(quote.itemPrice)}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between sm:block sm:text-right">
                    <span className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
                      Carry
                    </span>
                    <span className="text-sm text-muted">
                      {formatCurrency(quote.carryingFee)}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between sm:block sm:text-right">
                    <span className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
                      Est. duty
                    </span>
                    <span className="text-sm text-muted">
                      {formatCurrency(quote.dutyEstimate)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 sm:block sm:border-0 sm:pt-0 sm:text-right">
                    <div>
                      <p className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
                        Total
                      </p>
                      <p className="font-serif text-lg leading-none text-burgundy">
                        {formatCurrency(quoteTotal(quote))}
                      </p>
                    </div>
                    <StatusBadge
                      status={quote.status}
                      label="Awaiting decision"
                      className="mt-1.5 sm:mt-1.5"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg border border-champagne-strong/20 bg-champagne/10 px-3 py-2.5 text-[0.6875rem] leading-relaxed text-muted">
            <ShieldCheck
              className="mt-0.5 size-3.5 shrink-0 text-champagne-strong"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            Demo quotes only. Duty is an estimate and no payment can be
            authorised in this preview.
          </div>
        </section>
      </div>

      {/* ── Conversations + orders ─────────────────────────────────────── */}
      <div className="mt-14 grid gap-8 xl:grid-cols-12 xl:gap-6">
        <section id="messages" className="scroll-mt-28 xl:col-span-5">
          <SectionHeading
            eyebrow="Recent conversations"
            title="Notes from the road."
            description="Short updates from the travelers carrying your requests."
            actions={
              <Badge variant="burgundy" dot>
                {buyerSnapshot.unreadMessages} unread
              </Badge>
            }
          />

          <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {conversations.map((conversation) => (
              <article
                key={conversation.id}
                className="group flex gap-3 p-4 transition-colors hover:bg-surface-muted/40"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sapphire text-[0.6875rem] font-semibold text-ivory">
                  {getInitials(conversation.travelerName)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {conversation.travelerName}
                    </p>
                    <span className="shrink-0 text-[0.625rem] text-muted-foreground">
                      {conversation.timeLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-champagne-ink">
                    {conversation.requestName}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                    {conversation.snippet}
                  </p>
                </div>

                {conversation.unread && (
                  <>
                    <span
                      aria-hidden="true"
                      className="mt-2 size-2 shrink-0 rounded-full bg-champagne-strong"
                    />
                    <span className="sr-only">Unread message</span>
                  </>
                )}
              </article>
            ))}
          </div>

          <p className="mt-4 text-[0.6875rem] leading-relaxed text-muted-foreground">
            Demo messages. No chat backend is connected.
          </p>
        </section>

        <section id="orders" className="scroll-mt-28 xl:col-span-7">
          <SectionHeading
            eyebrow="Active orders"
            title="In motion, with proof."
            description="Two simulated orders, each with a visible handover date and payment state."
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {activeOrders.map((order, index) => {
              const isDark = index === 0;
              const progress =
                (order.stageIndex / (ORDER_STAGES.length - 1)) * 100;

              return (
                <article
                  key={order.id}
                  className={cn(
                    "relative overflow-hidden rounded-2xl",
                    isDark
                      ? "bg-burgundy-deep text-ivory"
                      : "border border-border bg-surface",
                  )}
                >
                  <div className="relative h-36 w-full overflow-hidden">
                    <Image
                      src={order.imageUrl}
                      alt={order.productName}
                      fill
                      sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
                      className={cn(
                        "object-cover transition-transform duration-700 hover:scale-105",
                        isDark ? "opacity-55" : "opacity-90",
                      )}
                    />
                    <div
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-0 bg-gradient-to-t",
                        isDark
                          ? "from-burgundy-deep via-burgundy-deep/30 to-transparent"
                          : "from-surface via-surface/20 to-transparent",
                      )}
                    />
                    <div className="absolute left-4 top-4">
                      <StatusBadge
                        status={order.status}
                        className={
                          isDark
                            ? "border-champagne/40 bg-champagne text-burgundy-deep"
                            : "text-champagne-ink"
                        }
                      />
                    </div>
                    <span
                      className={cn(
                        "absolute bottom-3 right-4 text-[0.5625rem] font-semibold uppercase tracking-[0.18em]",
                        isDark ? "text-ivory/50" : "text-muted-foreground",
                      )}
                    >
                      #{order.reference}
                    </span>
                  </div>

                  <div className="p-5">
                    <h3
                      className={cn(
                        "text-lg leading-snug",
                        isDark ? "text-ivory" : "text-foreground",
                      )}
                    >
                      {order.productName}
                    </h3>
                    <p
                      className={cn(
                        "mt-1 flex items-center gap-1.5 text-xs",
                        isDark ? "text-ivory/55" : "text-muted",
                      )}
                    >
                      <MapPin
                        className="size-3.5 shrink-0"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      {order.originCity} →{" "}
                      {airportLabel(order.destinationAirport)}
                    </p>

                    <div className="mt-5">
                      <div
                        className={cn(
                          "relative h-1.5 rounded-full",
                          isDark ? "bg-white/15" : "bg-surface-muted",
                        )}
                      >
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-champagne-strong"
                          style={{ width: `${progress}%` }}
                        />
                        {ORDER_STAGES.map((stage, stageIndex) => (
                          <span
                            key={stage}
                            className={cn(
                              "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border",
                              stageIndex <= order.stageIndex
                                ? "border-champagne-strong bg-champagne"
                                : isDark
                                  ? "border-white/25 bg-burgundy-deep"
                                  : "border-border-strong bg-surface",
                            )}
                            style={{
                              left: `${(stageIndex / (ORDER_STAGES.length - 1)) * 100}%`,
                            }}
                          />
                        ))}
                      </div>
                      <div
                        className={cn(
                          "mt-3 flex justify-between gap-2 text-[0.5625rem] uppercase tracking-[0.12em]",
                          isDark ? "text-ivory/60" : "text-muted-foreground",
                        )}
                      >
                        <span>{ORDER_STAGES[0]}</span>
                        <span>{ORDER_STAGES[order.stageIndex]}</span>
                        <span>{ORDER_STAGES[ORDER_STAGES.length - 1]}</span>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-xs",
                        isDark ? "border-white/10" : "border-border",
                      )}
                    >
                      <div>
                        <p
                          className={cn(
                            "text-[0.5625rem] uppercase tracking-[0.14em]",
                            isDark ? "text-ivory/60" : "text-muted-foreground",
                          )}
                        >
                          Handover
                        </p>
                        <p
                          className={cn(
                            "mt-1 font-medium",
                            isDark ? "text-ivory" : "text-foreground",
                          )}
                        >
                          {formatDate(order.handoverDate)}
                        </p>
                      </div>
                      <div>
                        <p
                          className={cn(
                            "text-[0.5625rem] uppercase tracking-[0.14em]",
                            isDark ? "text-ivory/60" : "text-muted-foreground",
                          )}
                        >
                          Escrow
                        </p>
                        <p
                          className={cn(
                            "mt-1 font-medium",
                            isDark ? "text-ivory" : "text-foreground",
                          )}
                        >
                          {order.escrow === "held" ? "Held" : "Released"} · demo
                        </p>
                      </div>
                    </div>

                    <p
                      className={cn(
                        "mt-3 text-[0.6875rem] leading-relaxed",
                        isDark ? "text-ivory/60" : "text-muted",
                      )}
                    >
                      {order.note}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── Profile / account ──────────────────────────────────────────── */}
      <section id="account" className="mt-14 scroll-mt-28">
        <SectionHeading
          eyebrow="Account"
          title="Your Buyer profile."
          description="The details a matched traveler would see once a request moves forward."
          actions={<Badge variant="outline">Demo profile</Badge>}
        />

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_1.95fr]">
          <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(150deg,#5b1a2b,#2b0a13)] p-6 text-ivory sm:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full border border-champagne/20"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full border border-champagne/15"
            />

            <div className="relative flex items-center gap-4">
              <span className="grid size-16 shrink-0 place-items-center rounded-full border border-champagne/40 bg-champagne/15 font-serif text-2xl text-champagne">
                {getInitials(buyerProfile.fullName)}
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-2xl text-ivory">
                  {buyerProfile.fullName}
                </h3>
                <p className="mt-0.5 truncate text-xs text-ivory/55">
                  {buyerProfile.email}
                </p>
              </div>
            </div>

            <div className="relative mt-6 flex flex-wrap gap-2">
              <Badge variant="champagne" dot>
                {buyerProfile.kyc}
              </Badge>
              <Badge variant="ivory">{buyerProfile.tier}</Badge>
            </div>

            <dl className="relative mt-6 grid grid-cols-2 gap-4 text-xs">
              <div>
                <dt className="text-[0.5625rem] uppercase tracking-[0.14em] text-ivory/60">
                  Member since
                </dt>
                <dd className="mt-1 text-sm text-ivory/85">
                  {buyerProfile.memberSince}
                </dd>
              </div>
              <div>
                <dt className="text-[0.5625rem] uppercase tracking-[0.14em] text-ivory/60">
                  Home airport
                </dt>
                <dd className="mt-1 text-sm text-ivory/85">
                  {airportLabel(buyerProfile.nearestAirport)}
                </dd>
              </div>
            </dl>

            <ButtonLink
              href="/buyer/login"
              variant="outline"
              size="sm"
              className="relative mt-6 border-white/20 text-ivory hover:border-champagne hover:text-champagne"
              leadingIcon={
                <LogOut
                  className="size-4"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              }
            >
              Sign out of demo
            </ButtonLink>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl">Contact & preferences</h3>
                <p className="mt-1 text-sm text-muted">
                  Used to coordinate a handover if a request is matched.
                </p>
              </div>
            </div>

            <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div>
                <dt className="text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Email
                </dt>
                <dd className="mt-1.5 flex items-center gap-2 text-sm">
                  <Mail
                    className="size-4 text-champagne-strong"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {buyerProfile.email}
                </dd>
              </div>
              <div>
                <dt className="text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Phone
                </dt>
                <dd className="mt-1.5 flex items-center gap-2 text-sm">
                  <Phone
                    className="size-4 text-champagne-strong"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {buyerProfile.phone}
                </dd>
              </div>
              <div>
                <dt className="text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  City
                </dt>
                <dd className="mt-1.5 flex items-center gap-2 text-sm">
                  <MapPin
                    className="size-4 text-champagne-strong"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {buyerProfile.city}, {buyerProfile.country}
                </dd>
              </div>
              <div>
                <dt className="text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Nearest airport
                </dt>
                <dd className="mt-1.5 flex items-center gap-2 text-sm">
                  <Plane
                    className="size-4 text-champagne-strong"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {airportLabel(buyerProfile.nearestAirport)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Preferred categories
                </dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {buyerProfile.preferredCategories.map((category) => (
                    <Badge
                      key={category}
                      variant="champagne"
                      className="text-champagne-ink"
                    >
                      {category}
                    </Badge>
                  ))}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
              <ButtonLink href="/buyer/requests/new" size="sm">
                Create a request
              </ButtonLink>
              <Link
                href="#requests"
                className="text-sm font-medium text-burgundy underline-offset-4 hover:underline"
              >
                Review active requests
              </Link>
            </div>
          </div>
        </div>
      </section>
    </BuyerShell>
  );
}
