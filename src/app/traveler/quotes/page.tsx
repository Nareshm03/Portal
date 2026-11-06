import type { Metadata } from "next";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { Badge, SectionHeading, StatusBadge, EmptyState, LoadingState, ButtonLink } from "@/components/ui";
import { airportLabel, formatCurrency, formatDate } from "@/lib/demo/traveler";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createProxiedApiClient } from "@/lib/api/client";
import { requireTravellerSession } from "@/lib/auth/traveler";
import { cn } from "@/lib/utils";

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
  created_at: string;
}

interface BackendRequest {
  id: string;
  product_title: string;
  product_category: string;
  origin_country: string;
  origin_airport_code: string;
  destination_country: string;
  destination_airport_code: string;
  needed_by: string;
  status: string;
  compliance_status: string;
}

export const metadata: Metadata = { title: "My quotes" };

export default async function TravelerQuotesPage() {
  const supabase = createServerClient();
  await requireTravellerSession(supabase);

  let quotes: BackendQuote[] = [];
  let error: string | null = null;
  let isLoading = true;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? null;
    const travellerId = sessionData.session?.user?.id ?? null;
    const api = createProxiedApiClient();

    // Get matching requests for this traveller's active trips.
    const requests = (await api.GET("/requests?matching=me", { token })) as BackendRequest[];
    const requestList = Array.isArray(requests) ? requests : [];

    // Fetch quotes for each matching request. The backend already filters
    // to the traveller's own quotes when the caller is a traveller.
    const quoteResults = await Promise.all(
      requestList.map((req) =>
        api.GET(`/requests/${req.id}/quotes`, { token }).catch(() => [] as unknown[])
      ),
    );

    quotes = quoteResults.flatMap((q) => (Array.isArray(q) ? q : [])) as BackendQuote[];
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load quotes.";
  } finally {
    isLoading = false;
  }

  if (isLoading) {
    return (
      <TravelerShell active="quotes">
        <LoadingState />
      </TravelerShell>
    );
  }

  const pendingQuotes = quotes.filter((q) => q.status === "ACTIVE");
  const matchedQuotes = quotes.filter((q) => q.status === "ACCEPTED");
  const otherQuotes = quotes.filter((q) => q.status !== "ACTIVE" && q.status !== "ACCEPTED");

  return (
    <TravelerShell active="quotes">
      {error && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <header>
        <p className="eyebrow">Quote management</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">My quotes</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Carrying fee quotes you&apos;ve submitted to buyers, with current status and decision tracking.
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
                      <StatusBadge status="quoted" />
                      <p className="truncate text-sm font-medium">Quote #{quote.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-xl text-burgundy">
                        {formatCurrency(Number(quote.item_price_minor) / 100)}
                      </p>
                      <p className="mt-0.5 text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
                        Carrying fee
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs">
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted">Item price</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(Number(quote.item_price_minor) / 100)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted">Estimated fulfilment</span>
                      <span className="font-medium text-foreground">{quote.expires_at}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted">Submitted</span>
                      <span className="text-muted">{quote.created_at}</span>
                    </div>
                  </div>
                </div>
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
                      <StatusBadge status="matched" />
                      <p className="truncate text-sm font-medium">Quote #{quote.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-xl text-burgundy">
                        {formatCurrency(Number(quote.item_price_minor) / 100)}
                      </p>
                      <p className="mt-0.5 text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
                        Carrying fee
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs">
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted">Submitted</span>
                      <span className="text-muted">{quote.created_at}</span>
                    </div>
                  </div>
                </div>
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
                      <StatusBadge status="cancelled" />
                      <p className="truncate text-sm font-medium text-muted">Quote #{quote.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-xl text-muted">
                        {formatCurrency(Number(quote.item_price_minor) / 100)}
                      </p>
                      <p className="mt-0.5 text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
                        Carrying fee
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Create a new quote ──────────────────────────────────────────── */}
      <section className="mt-14">
        <SectionHeading
          eyebrow="Submit a quote"
          title="Create a new quote"
          description="Select a matching request and an active trip to submit your carrying fee quote."
        />

        <div className="mt-6 rounded-xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">
            Quote creation requires an active trip and a matching buyer request
            with compliance status APPROVED. Use the traveler requests page to
            find matching requests.
          </p>
          <div className="mt-4 flex gap-3">
            <ButtonLink href="/traveler/requests">Browse matching requests</ButtonLink>
            <ButtonLink href="/traveler/trips/new" variant="outline">Register a trip</ButtonLink>
          </div>
        </div>
      </section>

      {quotes.length === 0 && !error && (
        <EmptyState
          title="No quotes yet"
          description="Submit a quote on a matching buyer request to get started."
          action={
            <ButtonLink href="/traveler/requests">Browse matching requests</ButtonLink>
          }
        />
      )}
    </TravelerShell>
  );
}
