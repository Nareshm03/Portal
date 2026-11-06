import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, CalendarDays, Plus } from "lucide-react";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { ButtonLink, SectionHeading, StatusBadge } from "@/components/ui";
import {
  airportLabel,
  formatCurrency,
  formatDate,
  productRequests,
} from "@/lib/demo/buyer";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Active requests" };

export default function BuyerRequestsPage() {
  const activeRequests = productRequests;
  const requestedStatus = activeRequests.filter((r) => r.status === "requested");
  const quotedStatus = activeRequests.filter((r) => r.status === "quoted");
  const matchedStatus = activeRequests.filter((r) => r.status === "matched");

  return (
    <BuyerShell active="requests">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Sourcing pipeline</p>
          <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">
            Active requests
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Your product requests with traveler matches, quote tracking, and
            fulfilment progress.
          </p>
        </div>

        <ButtonLink
          href="/buyer/requests/new"
          leadingIcon={
            <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
          }
        >
          New request
        </ButtonLink>
      </header>

      {/* ── Summary stats ───────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-border bg-surface p-6">
            <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Total requests
            </p>
            <p className="mt-2 font-serif text-4xl text-burgundy">
              {String(activeRequests.length).padStart(2, "0")}
            </p>
            <p className="mt-2 text-xs text-muted">
              {requestedStatus.length} awaiting quotes,{" "}
              {matchedStatus.length} matched
            </p>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-6">
            <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Traveler matches
            </p>
            <p className="mt-2 font-serif text-4xl text-burgundy">
              {String(
                activeRequests.reduce((sum, r) => sum + r.matchedTravelers, 0),
              ).padStart(2, "0")}
            </p>
            <p className="mt-2 text-xs text-muted">
              Across all active requests
            </p>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-6">
            <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Quotes received
            </p>
            <p className="mt-2 font-serif text-4xl text-burgundy">
              {String(
                activeRequests.reduce((sum, r) => sum + r.quotesReceived, 0),
              ).padStart(2, "0")}
            </p>
            <p className="mt-2 text-xs text-muted">
              {quotedStatus.length} requests have quotes
            </p>
          </article>
        </div>
      </section>

      {/* ── Active requests list ────────────────────────────────────────── */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Your requests"
          title={`${activeRequests.length} product requests in progress`}
          description="Each request shows current status, matched travelers, and quote activity."
        />

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
          {activeRequests.map((request, index) => (
            <article
              key={request.id}
              className={cn(
                "group grid gap-5 p-5 transition-colors hover:bg-surface-muted/30 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center",
                index !== activeRequests.length - 1 && "border-b border-border",
              )}
            >
              {/* Product image */}
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-surface-muted sm:size-[6.5rem]">
                <Image
                  src={request.imageUrl}
                  alt={request.name}
                  fill
                  sizes="(min-width: 640px) 104px, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span className="absolute left-2 top-2 rounded-full bg-burgundy-deep/80 px-1.5 py-0.5 text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-champagne">
                  Demo
                </span>
              </div>

              {/* Request details */}
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

                <h3 className="mt-2 text-xl leading-snug">{request.name}</h3>

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

              {/* Match signal */}
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

        <p className="mt-4 text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
          Demo requests · no traveler has been contacted
        </p>
      </section>

      {/* ── Next steps ──────────────────────────────────────────────────── */}
      <section className="mt-12">
        <div className="rounded-2xl border border-champagne/20 bg-champagne/5 p-6">
          <h2 className="text-lg font-medium text-foreground">
            Next steps with your requests
          </h2>
          <ul className="mt-4 grid gap-3 text-sm text-muted">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-champagne-strong" />
              <span>
                Review quotes from matched travelers and compare carrying fees
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-champagne-strong" />
              <span>
                Message travelers to confirm product availability and ask
                questions
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-champagne-strong" />
              <span>
                Accept a quote to move forward with purchase and delivery
              </span>
            </li>
          </ul>

          <div className="mt-6">
            <ButtonLink
              href="/buyer/requests/new"
              variant="outline"
              size="sm"
              leadingIcon={
                <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
              }
            >
              Create another request
            </ButtonLink>
          </div>
        </div>
      </section>
    </BuyerShell>
  );
}
