"use client";

import { useState } from "react";
import { ShieldCheck, CheckCircle2, X } from "lucide-react";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { Badge, SectionHeading, StatusBadge } from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  quoteTotal,
  quotesReceived,
  type Quote,
} from "@/lib/demo/buyer";
import type { TrackingStatus } from "@/components/ui/status-badge";

interface AcceptedQuote {
  quoteId: string;
  requestName: string;
  travelerName: string;
  acceptedAt: string;
}

const STORAGE_KEY = "buyer-accepted-quotes";

// Load accepted quotes from localStorage
function loadAcceptedQuotes(): AcceptedQuote[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load accepted quotes", e);
  }
  
  return [];
}

// Save accepted quotes to localStorage
function saveAcceptedQuotes(quotes: AcceptedQuote[]) {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  } catch (e) {
    console.error("Failed to save accepted quotes", e);
  }
}

export default function BuyerQuotesPage() {
  const [acceptedQuotes, setAcceptedQuotes] = useState<AcceptedQuote[]>(loadAcceptedQuotes);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [acceptSuccess, setAcceptSuccess] = useState(false);

  // Check if a quote is accepted
  const isQuoteAccepted = (quoteId: string) => {
    return acceptedQuotes.some((aq) => aq.quoteId === quoteId);
  };

  // Check if any quote for a request is accepted
  const isRequestFulfilled = (requestName: string) => {
    return acceptedQuotes.some((aq) => aq.requestName === requestName);
  };

  // Get quote status
  const getQuoteStatus = (quote: Quote): TrackingStatus => {
    if (isQuoteAccepted(quote.id)) {
      return "delivered"; // Using delivered for green "Accepted" badge
    }
    if (isRequestFulfilled(quote.requestName) && !isQuoteAccepted(quote.id)) {
      return "cancelled"; // Using cancelled for "Not Selected" badge
    }
    return quote.status;
  };

  // Get quote label
  const getQuoteLabel = (quote: Quote): string => {
    if (isQuoteAccepted(quote.id)) {
      return "Accepted";
    }
    if (isRequestFulfilled(quote.requestName) && !isQuoteAccepted(quote.id)) {
      return "Not Selected";
    }
    return "Awaiting decision";
  };

  // Handle accept quote button click
  const handleAcceptClick = (quote: Quote) => {
    setSelectedQuote(quote);
    setShowConfirmModal(true);
  };

  // Handle confirm acceptance
  const handleConfirmAcceptance = () => {
    if (!selectedQuote) return;

    const newAcceptedQuote: AcceptedQuote = {
      quoteId: selectedQuote.id,
      requestName: selectedQuote.requestName,
      travelerName: selectedQuote.travelerName,
      acceptedAt: new Date().toISOString(),
    };

    const updatedQuotes = [...acceptedQuotes, newAcceptedQuote];
    setAcceptedQuotes(updatedQuotes);
    saveAcceptedQuotes(updatedQuotes);

    setShowConfirmModal(false);
    setSelectedQuote(null);
    setAcceptSuccess(true);

    // Hide success message after 5 seconds
    setTimeout(() => setAcceptSuccess(false), 5000);
  };

  // Handle cancel
  const handleCancel = () => {
    setShowConfirmModal(false);
    setSelectedQuote(null);
  };

  // Categorize quotes
  const allQuotes = quotesReceived.map((quote) => ({
    ...quote,
    actualStatus: getQuoteStatus(quote),
    actualLabel: getQuoteLabel(quote),
  }));

  const pending = allQuotes.filter(
    (q) => q.actualStatus === "quoted" && !isRequestFulfilled(q.requestName)
  );
  const accepted = allQuotes.filter((q) => isQuoteAccepted(q.id));
  const other = allQuotes.filter(
    (q) => q.actualStatus !== "quoted" || (q.actualStatus === "quoted" && isRequestFulfilled(q.requestName) && !isQuoteAccepted(q.id))
  );

  return (
    <BuyerShell active="quotes">
      <header>
        <p className="eyebrow">Quote management</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Quotes</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Carrying fee quotes from matched travelers, with item price, fee
          breakdown, and duty estimates in one view.
        </p>
      </header>

      {/* Success message */}
      {acceptSuccess && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-green-600/30 bg-green-50/50 px-4 py-3">
          <CheckCircle2 className="size-5 shrink-0 text-green-600" strokeWidth={2} />
          <div className="flex-1 text-sm text-green-800">
            <strong>Quote accepted successfully!</strong> The traveler has been confirmed for your request.
          </div>
        </div>
      )}

      {/* ── Accepted quotes ─────────────────────────────────────────────── */}
      {accepted.length > 0 && (
        <section className="mt-8">
          <SectionHeading
            eyebrow="Confirmed"
            title={`${accepted.length} ${accepted.length === 1 ? "quote" : "quotes"} accepted`}
            description="Your confirmed traveler selections."
            actions={
              <Badge variant="emerald">{accepted.length} confirmed</Badge>
            }
          />

          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
            {/* Table Header */}
            <div className="hidden border-b border-border bg-surface-muted/50 px-5 py-3 sm:grid sm:grid-cols-[minmax(200px,2fr)_110px_110px_140px] sm:gap-4">
              <div className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Request & traveler
              </div>
              <div className="text-right text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Item
              </div>
              <div className="text-right text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Carry
              </div>
              <div className="text-right text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Total
              </div>
            </div>

            {/* Table Rows */}
            {accepted.map((quote) => (
              <div
                key={quote.id}
                className="border-b border-border/70 px-5 py-4 last:border-b-0"
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(200px,2fr)_110px_110px_140px] sm:items-center sm:gap-4">
                  {/* Request & Traveler */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {quote.requestName}
                      </p>
                      <CheckCircle2 className="size-4 text-green-600" strokeWidth={2} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {quote.travelerName} · Confirmed traveler
                    </p>
                  </div>

                  {/* Item Price */}
                  <div className="flex items-baseline justify-between sm:justify-end">
                    <span className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
                      Item
                    </span>
                    <span className="text-sm text-muted">
                      {formatCurrency(quote.itemPrice)}
                    </span>
                  </div>

                  {/* Carrying Fee */}
                  <div className="flex items-baseline justify-between sm:justify-end">
                    <span className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
                      Carry
                    </span>
                    <span className="text-sm text-muted">
                      {formatCurrency(quote.carryingFee)}
                    </span>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 sm:justify-end sm:border-0 sm:pt-0">
                    <p className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
                      Total
                    </p>
                    <div className="flex flex-col items-end gap-1.5">
                      <p className="font-serif text-lg leading-none text-burgundy">
                        {formatCurrency(quoteTotal(quote))}
                      </p>
                      <StatusBadge
                        status="delivered"
                        label="Accepted"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Pending quotes ──────────────────────────────────────────────── */}
      {pending.length > 0 && (
        <section className={accepted.length > 0 ? "mt-12" : "mt-8"}>
          <SectionHeading
            eyebrow="Awaiting decision"
            title={`${pending.length} ${pending.length === 1 ? "quote" : "quotes"} to review`}
            description="Compare carrying fees and total costs to make your decision."
            actions={
              <Badge variant="burgundy">{pending.length} pending</Badge>
            }
          />

          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
            {/* Table Header */}
            <div className="hidden border-b border-border bg-surface-muted/50 px-5 py-3 sm:grid sm:grid-cols-[minmax(200px,2fr)_110px_110px_140px] sm:gap-4">
              <div className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Request & traveler
              </div>
              <div className="text-right text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Item
              </div>
              <div className="text-right text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Carry
              </div>
              <div className="text-right text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Total
              </div>
            </div>

            {/* Table Rows */}
            {pending.map((quote) => (
              <div
                key={quote.id}
                className="border-b border-border/70 px-5 py-4 last:border-b-0"
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(200px,2fr)_110px_110px_140px] sm:items-center sm:gap-4">
                  {/* Request & Traveler */}
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

                  {/* Item Price */}
                  <div className="flex items-baseline justify-between sm:justify-end">
                    <span className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
                      Item
                    </span>
                    <span className="text-sm text-muted">
                      {formatCurrency(quote.itemPrice)}
                    </span>
                  </div>

                  {/* Carrying Fee */}
                  <div className="flex items-baseline justify-between sm:justify-end">
                    <span className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
                      Carry
                    </span>
                    <span className="text-sm text-muted">
                      {formatCurrency(quote.carryingFee)}
                    </span>
                  </div>

                  {/* Total */}
                  <div className="flex flex-col items-stretch gap-2 border-t border-border/70 pt-3 sm:items-end sm:border-0 sm:pt-0">
                    <div className="flex items-center justify-between sm:justify-end">
                      <p className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
                        Total
                      </p>
                      <p className="font-serif text-lg leading-none text-burgundy">
                        {formatCurrency(quoteTotal(quote))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAcceptClick(quote)}
                      className="rounded-lg bg-burgundy-deep px-4 py-2 text-xs font-medium text-ivory transition-colors hover:bg-burgundy-ink sm:w-auto"
                    >
                      Accept Quote
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-champagne-strong/20 bg-champagne/10 px-3 py-2.5 text-[0.6875rem] leading-relaxed text-muted">
            <ShieldCheck
              className="mt-0.5 size-3.5 shrink-0 text-champagne-strong"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            Demo quotes only. Duty is an estimate and no payment can be
            authorized in this preview.
          </div>
        </section>
      )}

      {/* ── Other quotes ────────────────────────────────────────────────── */}
      {other.length > 0 && (
        <section className="mt-12">
          <SectionHeading
            eyebrow="Quote history"
            title="Other quotes"
            description="Quotes that were not selected or have been declined."
          />

          <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {other.map((quote) => (
              <div key={quote.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{quote.requestName}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {quote.travelerName}
                    </p>
                  </div>
                  <StatusBadge status={quote.actualStatus} label={quote.actualLabel} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>Total: {formatCurrency(quoteTotal(quote))}</span>
                  <span>Valid to: {formatDate(quote.validUntil)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Quote breakdown explanation ─────────────────────────────────── */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Understanding quotes"
          title="What's included in each quote"
          description="Each quote breaks down the total cost into three components."
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Item price
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              The product&apos;s retail price at the origin store, converted to USD
              for comparison. This is the amount the traveler will pay.
            </p>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Carrying fee
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              The traveler&apos;s fee for purchasing, carrying and delivering your
              product. This covers their time, luggage space and effort.
            </p>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Estimated duty
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              An illustrative customs duty estimate based on product category and
              value. Actual duty may vary and is your responsibility.
            </p>
          </article>
        </div>
      </section>

      {/* ── Confirmation Modal ──────────────────────────────────────────── */}
      {showConfirmModal && selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-xl">
            <button
              type="button"
              onClick={handleCancel}
              className="absolute right-4 top-4 text-muted transition-colors hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-5" strokeWidth={1.75} />
            </button>

            <h2 className="text-xl font-semibold text-foreground">
              Accept Quote
            </h2>
            <p className="mt-1 text-sm text-muted">
              Please review the details before confirming your selection.
            </p>

            <div className="mt-6 space-y-4">
              {/* Product and traveler info */}
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Product Request
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {selectedQuote.requestName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Traveler
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {selectedQuote.travelerName}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quote breakdown */}
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Quote Breakdown
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Item price</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(selectedQuote.itemPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Carrying fee</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(selectedQuote.carryingFee)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Estimated duty</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(selectedQuote.dutyEstimate)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2">
                    <div className="flex justify-between">
                      <span className="font-semibold text-foreground">Total</span>
                      <span className="font-serif text-lg text-burgundy">
                        {formatCurrency(quoteTotal(selectedQuote))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirmation message */}
              <div className="rounded-lg border border-champagne-strong/20 bg-champagne/10 px-4 py-3 text-sm text-muted">
                <p className="font-medium text-foreground">
                  Are you sure you want to accept this quotation?
                </p>
                <p className="mt-1 text-xs">
                  This will confirm <strong>{selectedQuote.travelerName}</strong> as your
                  selected traveler for this request. Other quotes for this request will
                  be marked as &ldquo;Not Selected&rdquo;.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleConfirmAcceptance}
                className="flex-1 rounded-lg bg-burgundy-deep px-4 py-2.5 text-sm font-medium text-ivory transition-colors hover:bg-burgundy-ink"
              >
                Confirm Acceptance
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </BuyerShell>
  );
}
