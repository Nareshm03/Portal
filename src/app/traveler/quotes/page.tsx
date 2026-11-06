import type { Metadata } from "next";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { Badge, SectionHeading, StatusBadge } from "@/components/ui";
import {
  airportLabel,
  formatCurrency,
  formatDate,
  travelerQuotes,
} from "@/lib/demo/traveler";

export const metadata: Metadata = { title: "My quotes" };

export default function TravelerQuotesPage() {
  const pendingQuotes = travelerQuotes.filter(
    (quote) => quote.status === "quoted",
  );
  const matchedQuotes = travelerQuotes.filter(
    (quote) => quote.status === "matched",
  );
  const otherQuotes = travelerQuotes.filter(
    (quote) => quote.status !== "quoted" && quote.status !== "matched",
  );

  return (
    <TravelerShell active="quotes">
      <header>
        <p className="eyebrow">Quote management</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">
          My quotes
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Carrying fee quotes you&apos;ve submitted to buyers, with current status
          and decision tracking.
        </p>
      </header>

      {/* ── Pending quotes ──────────────────────────────────────────────── */}
      {pendingQuotes.length > 0 && (
        <section className="mt-8">
          <SectionHeading
            eyebrow="Awaiting decision"
            title={`${pendingQuotes.length} pending quotes`}
            description="Buyers are reviewing these quotes."
            actions={<Badge variant="burgundy">{pendingQuotes.length} pending</Badge>}
          />

          <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {pendingQuotes.map((quote) => (
              <div key={quote.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={quote.status} />
                      <p className="truncate text-sm font-medium">
                        {quote.requestName}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {quote.originCity}, {quote.originCountry} →{" "}
                      {airportLabel(quote.destinationAirport)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-serif text-xl text-burgundy">
                      {formatCurrency(quote.carryingFeeUsd)}
                    </p>
                    <p className="mt-0.5 text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
                      Carrying fee
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-xs">
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted">Product price range</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(quote.priceMinUsd)}–
                      {formatCurrency(quote.priceMaxUsd)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted">Estimated fulfilment</span>
                    <span className="font-medium text-foreground">
                      {formatDate(quote.estimatedFulfilment)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted">Submitted</span>
                    <span className="text-muted">{quote.submittedOn}</span>
                  </div>
                </div>

                {quote.message && (
                  <p className="mt-3 rounded-lg border border-border bg-surface-muted/60 px-3 py-2 text-xs leading-relaxed text-muted">
                    &ldquo;{quote.message}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Matched quotes ──────────────────────────────────────────────── */}
      {matchedQuotes.length > 0 && (
        <section className="mt-14">
          <SectionHeading
            eyebrow="Accepted"
            title={`${matchedQuotes.length} matched quotes`}
            description="Buyers have accepted these quotes and orders are active."
            actions={<Badge variant="emerald">{matchedQuotes.length} accepted</Badge>}
          />

          <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {matchedQuotes.map((quote) => (
              <div key={quote.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={quote.status} />
                      <p className="truncate text-sm font-medium">
                        {quote.requestName}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {quote.originCity}, {quote.originCountry} →{" "}
                      {airportLabel(quote.destinationAirport)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-serif text-xl text-burgundy">
                      {formatCurrency(quote.carryingFeeUsd)}
                    </p>
                    <p className="mt-0.5 text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
                      Carrying fee
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-xs">
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted">Product price range</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(quote.priceMinUsd)}–
                      {formatCurrency(quote.priceMaxUsd)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted">Estimated fulfilment</span>
                    <span className="font-medium text-foreground">
                      {formatDate(quote.estimatedFulfilment)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted">Submitted</span>
                    <span className="text-muted">{quote.submittedOn}</span>
                  </div>
                </div>

                {quote.message && (
                  <p className="mt-3 rounded-lg border border-border bg-surface-muted/60 px-3 py-2 text-xs leading-relaxed text-muted">
                    &ldquo;{quote.message}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Other quotes ────────────────────────────────────────────────── */}
      {otherQuotes.length > 0 && (
        <section className="mt-14">
          <SectionHeading
            eyebrow="Archive"
            title="Other quotes"
            description="Cancelled or expired quotes."
          />

          <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {otherQuotes.map((quote) => (
              <div key={quote.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={quote.status} />
                      <p className="truncate text-sm font-medium text-muted">
                        {quote.requestName}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {quote.originCity}, {quote.originCountry} →{" "}
                      {airportLabel(quote.destinationAirport)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-serif text-xl text-muted">
                      {formatCurrency(quote.carryingFeeUsd)}
                    </p>
                    <p className="mt-0.5 text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
                      Carrying fee
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-xs">
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted">Submitted</span>
                    <span className="text-muted">{quote.submittedOn}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-6 text-[0.6875rem] leading-relaxed text-muted-foreground">
        Demo quotes. No buyer communication or payment negotiation occurs in
        this prototype.
      </p>
    </TravelerShell>
  );
}
