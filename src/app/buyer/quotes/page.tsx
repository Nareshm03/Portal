"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, CheckCircle2, X } from "lucide-react";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { Badge, SectionHeading, StatusBadge, EmptyState, LoadingState } from "@/components/ui";
import { formatCurrency, formatDate, quoteTotal, type Quote as DemoQuote } from "@/lib/demo/buyer";
import type { TrackingStatus } from "@/components/ui/status-badge";
import { supabase } from "@/lib/supabase/client";
import { createProxiedApiClient, ApiError } from "@/lib/api/client";

interface BackendQuote {
  id: string;
  request_id: string;
  trip_id: string;
  traveller_id: string;
  item_price_minor: number;
  item_currency: string;
  fx_rate: string;
  fx_source: string;
  fx_timestamp: string;
  indicative_duty_paise: number | null;
  duty_source: string | null;
  status: string;
  expires_at: string;
}

interface BackendRequest {
  id: string;
  product_title: string;
  product_category: string;
  status: string;
  compliance_status: string;
}

interface DisplayQuote extends DemoQuote {
  actualStatus: TrackingStatus;
  actualLabel: string;
}

interface AcceptedQuote {
  quoteId: string;
  requestName: string;
  travelerName: string;
  acceptedAt: string;
}

const STORAGE_KEY = "buyer-accepted-quotes";

function loadAcceptedQuotes(): AcceptedQuote[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveAcceptedQuotes(quotes: AcceptedQuote[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  } catch {
    // ignore
  }
}

export default function BuyerQuotesPage() {
  const [quotes, setQuotes] = useState<DemoQuote[]>([]);
  const [acceptedQuotes, setAcceptedQuotes] = useState<AcceptedQuote[]>(loadAcceptedQuotes);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<DemoQuote | null>(null);
  const [acceptSuccess, setAcceptSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  const isQuoteAccepted = useCallback((quoteId: string) => {
    return acceptedQuotes.some((aq) => aq.quoteId === quoteId);
  }, [acceptedQuotes]);

  const isRequestFulfilled = useCallback((requestName: string) => {
    return acceptedQuotes.some((aq) => aq.requestName === requestName);
  }, [acceptedQuotes]);

  const getQuoteStatus = useCallback((quote: DemoQuote): TrackingStatus => {
    if (isQuoteAccepted(quote.id)) return "delivered";
    if (isRequestFulfilled(quote.requestName) && !isQuoteAccepted(quote.id)) return "cancelled";
    return quote.status;
  }, [isQuoteAccepted, isRequestFulfilled]);

  const getQuoteLabel = useCallback((quote: DemoQuote): string => {
    if (isQuoteAccepted(quote.id)) return "Accepted";
    if (isRequestFulfilled(quote.requestName) && !isQuoteAccepted(quote.id)) return "Not Selected";
    return "Awaiting decision";
  }, [isQuoteAccepted, isRequestFulfilled]);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = supabase?.auth?.getSession ? (await supabase.auth.getSession()).data.session?.access_token : null;
      if (!token) {
        setDemoMode(true);
        setLoading(false);
        return;
      }

      const api = createProxiedApiClient();

      // Fetch buyer's requests
      const requests = (await api.GET("/requests/mine", { token })) as any[];

      // Fetch quotes for each request
      const allQuotes: DemoQuote[] = [];
      for (const req of requests) {
        try {
          const quoteData = (await api.GET(`/requests/${req.id}/quotes`, { token })) as any[];
          const travellerName = "Traveler"; // We don't have traveller name from this endpoint
          for (const q of (quoteData || [])) {
            allQuotes.push({
              id: q.id,
              travelerName: travellerName,
              requestName: req.product_title,
              itemPrice: Number(q.item_price_minor) / 100,
              carryingFee: 0,
              dutyEstimate: q.indicative_duty_paise != null ? q.indicative_duty_paise / 100 : 0,
              status: q.status.toLowerCase() as TrackingStatus,
              recommended: false,
              validUntil: q.expires_at,
            });
          }
        } catch {
          // Skip requests whose quotes can't be fetched
        }
      }

      setQuotes(allQuotes);
    } catch (err) {
      if (err instanceof ApiError && err.demo) {
        setDemoMode(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load quotes.");
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const handleAcceptClick = (quote: DemoQuote) => {
    setSelectedQuote(quote);
    setShowConfirmModal(true);
  };

  const handleConfirmAcceptance = async () => {
    if (!selectedQuote) return;

    try {
      const token = supabase?.auth?.getSession ? (await supabase.auth.getSession()).data.session?.access_token : null;
      if (!token) {
        setError("Not authenticated.");
        return;
      }

      const api = createProxiedApiClient();
      await api.POST(`/quotes/${selectedQuote.id}/accept`, {}, { token });

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
      setTimeout(() => setAcceptSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept quote.");
    }
  };

  const handleCancel = () => {
    setShowConfirmModal(false);
    setSelectedQuote(null);
  };

  const allQuotes = quotes.map((quote) => ({
    ...quote,
    actualStatus: getQuoteStatus(quote),
    actualLabel: getQuoteLabel(quote),
  }));

  const pending = allQuotes.filter(
    (q) => q.actualStatus === "quoted" && !isRequestFulfilled(q.requestName),
  );
  const accepted = allQuotes.filter((q) => isQuoteAccepted(q.id));
  const other = allQuotes.filter(
    (q) => q.actualStatus !== "quoted" || (q.actualStatus === "quoted" && isRequestFulfilled(q.requestName) && !isQuoteAccepted(q.id)),
  );

  if (loading) {
    return (
      <BuyerShell active="quotes">
        <LoadingState />
      </BuyerShell>
    );
  }

  if (error && !demoMode) {
    return (
      <BuyerShell active="quotes">
        <EmptyState title="Unable to load quotes" description={error} />
      </BuyerShell>
    );
  }

  // Fall back to demo data when backend is unavailable
  const displayQuotes = demoMode || quotes.length === 0 ? [
    {
      id: "quote-01",
      travelerName: "Meera Kapoor",
      requestName: "Leica Q3 compact camera",
      itemPrice: 5400,
      carryingFee: 240,
      dutyEstimate: 780,
      status: "quoted" as TrackingStatus,
      recommended: true,
      validUntil: "2026-11-28",
    },
    {
      id: "quote-02",
      travelerName: "Arjun Shah",
      requestName: "Goyard Saint Louis tote",
      itemPrice: 1720,
      carryingFee: 110,
      dutyEstimate: 205,
      status: "quoted" as TrackingStatus,
      recommended: false,
      validUntil: "2026-11-24",
    },
  ] : quotes;

  const allDisplayQuotes = displayQuotes.map((quote) => ({
    ...quote,
    actualStatus: getQuoteStatus(quote) as TrackingStatus,
    actualLabel: getQuoteLabel(quote),
  })) as DisplayQuote[];

  const pendingDisplay = allDisplayQuotes.filter(
    (q) => q.actualStatus === "quoted" && !isRequestFulfilled(q.requestName),
  );
  const acceptedDisplay = allDisplayQuotes.filter((q) => isQuoteAccepted(q.id));
  const otherDisplay = allDisplayQuotes.filter(
    (q) => q.actualStatus !== "quoted" || (q.actualStatus === "quoted" && isRequestFulfilled(q.requestName) && !isQuoteAccepted(q.id)),
  );

  return (
    <BuyerShell active="quotes">
      {demoMode && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-champagne-strong/20 bg-champagne/10 px-3 py-2 text-[0.6875rem] leading-relaxed text-champagne-ink">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
          Demo mode — backend unavailable. Sample quotes shown.
        </div>
      )}

      <header>
        <p className="eyebrow">Quote management</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Quotes</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Carrying fee quotes from matched travelers, with item price, fee breakdown, and duty estimates in one view.
        </p>
      </header>

      {acceptSuccess && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-green-600/30 bg-green-50/50 px-4 py-3">
          <CheckCircle2 className="size-5 shrink-0 text-green-600" strokeWidth={2} />
          <div className="flex-1 text-sm text-green-800">
            <strong>Quote accepted successfully!</strong> The traveler has been confirmed for your request.
          </div>
        </div>
      )}

      {acceptedDisplay.length > 0 && (
        <section className="mt-8">
          <SectionHeading
            eyebrow="Confirmed"
            title={`${acceptedDisplay.length} ${acceptedDisplay.length === 1 ? "quote" : "quotes"} accepted`}
            description="Your confirmed traveler selections."
            actions={<Badge variant="emerald">{acceptedDisplay.length} confirmed</Badge>}
          />
          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
            {acceptedDisplay.map((quote) => (
              <div key={quote.id} className="border-b border-border/70 px-5 py-4 last:border-b-0">
                <div className="grid gap-3 sm:grid-cols-[minmax(200px,2fr)_110px_110px_140px] sm:items-center sm:gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{quote.requestName}</p>
                      <CheckCircle2 className="size-4 text-green-600" strokeWidth={2} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{quote.travelerName} · Confirmed traveler</p>
                  </div>
                  <div className="flex items-baseline justify-between sm:justify-end">
                    <span className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">Item</span>
                    <span className="text-sm text-muted">{formatCurrency(quote.itemPrice)}</span>
                  </div>
                  <div className="flex items-baseline justify-between sm:justify-end">
                    <span className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">Carry</span>
                    <span className="text-sm text-muted">{formatCurrency(quote.carryingFee)}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 border-t border-border/70 pt-3 sm:justify-end sm:border-0 sm:pt-0">
                    <p className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">Total</p>
                    <div className="flex flex-col items-end gap-1.5">
                      <p className="font-serif text-lg leading-none text-burgundy">{formatCurrency(quoteTotal(quote))}</p>
                      <StatusBadge status="delivered" label="Accepted" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {pendingDisplay.length > 0 && (
        <section className={acceptedDisplay.length > 0 ? "mt-12" : "mt-8"}>
          <SectionHeading
            eyebrow="Awaiting decision"
            title={`${pendingDisplay.length} ${pendingDisplay.length === 1 ? "quote" : "quotes"} to review`}
            description="Compare carrying fees and total costs to make your decision."
            actions={<Badge variant="burgundy">{pendingDisplay.length} pending</Badge>}
          />
          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
            {pendingDisplay.map((quote) => (
              <div key={quote.id} className="border-b border-border/70 px-5 py-4 last:border-b-0">
                <div className="grid gap-3 sm:grid-cols-[minmax(200px,2fr)_110px_110px_140px] sm:items-center sm:gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{quote.requestName}</p>
                      {quote.recommended && (
                        <Badge variant="champagne" className="text-champagne-ink">Best value</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{quote.travelerName} · valid to {formatDate(quote.validUntil)}</p>
                  </div>
                  <div className="flex items-baseline justify-between sm:justify-end">
                    <span className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">Item</span>
                    <span className="text-sm text-muted">{formatCurrency(quote.itemPrice)}</span>
                  </div>
                  <div className="flex items-baseline justify-between sm:justify-end">
                    <span className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">Carry</span>
                    <span className="text-sm text-muted">{formatCurrency(quote.carryingFee)}</span>
                  </div>
                  <div className="flex flex-col items-stretch gap-2 border-t border-border/70 pt-3 sm:items-end sm:border-0 sm:pt-0">
                    <div className="flex items-center justify-between sm:justify-end">
                      <p className="text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">Total</p>
                      <p className="font-serif text-lg leading-none text-burgundy">{formatCurrency(quoteTotal(quote))}</p>
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
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
            {demoMode ? "Demo quotes only." : "Duty is an estimate and no payment can be authorized in this preview."}
          </div>
        </section>
      )}

      {otherDisplay.length > 0 && (
        <section className="mt-12">
          <SectionHeading
            eyebrow="Quote history"
            title="Other quotes"
            description="Quotes that were not selected or have been declined."
          />
          <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {otherDisplay.map((quote) => (
              <div key={quote.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{quote.requestName}</p>
                    <p className="mt-0.5 text-xs text-muted">{quote.travelerName}</p>
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

      {showConfirmModal && selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-xl">
            <button type="button" onClick={handleCancel} className="absolute right-4 top-4 text-muted transition-colors hover:text-foreground" aria-label="Close">
              <X className="size-5" strokeWidth={1.75} />
            </button>
            <h2 className="text-xl font-semibold text-foreground">Accept Quote</h2>
            <p className="mt-1 text-sm text-muted">Please review the details before confirming your selection.</p>
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Product Request</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{selectedQuote.requestName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Traveler</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{selectedQuote.travelerName}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Quote Breakdown</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Item price</span>
                    <span className="font-medium text-foreground">{formatCurrency(selectedQuote.itemPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Carrying fee</span>
                    <span className="font-medium text-foreground">{formatCurrency(selectedQuote.carryingFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Estimated duty</span>
                    <span className="font-medium text-foreground">{formatCurrency(selectedQuote.dutyEstimate)}</span>
                  </div>
                  <div className="border-t border-border pt-2">
                    <div className="flex justify-between">
                      <span className="font-semibold text-foreground">Total</span>
                      <span className="font-serif text-lg text-burgundy">{formatCurrency(quoteTotal(selectedQuote))}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-champagne-strong/20 bg-champagne/10 px-4 py-3 text-sm text-muted">
                <p className="font-medium text-foreground">Are you sure you want to accept this quotation?</p>
                <p className="mt-1 text-xs">This will confirm <strong>{selectedQuote.travelerName}</strong> as your selected traveler for this request.</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={handleConfirmAcceptance} className="flex-1 rounded-lg bg-burgundy-deep px-4 py-2.5 text-sm font-medium text-ivory transition-colors hover:bg-burgundy-ink">
                Confirm Acceptance
              </button>
              <button type="button" onClick={handleCancel} className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </BuyerShell>
  );
}
