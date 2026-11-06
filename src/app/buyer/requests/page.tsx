import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, CalendarDays, Plus } from "lucide-react";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { ButtonLink, SectionHeading, StatusBadge, EmptyState, LoadingState } from "@/components/ui";
import { airportLabel, formatCurrency, formatDate } from "@/lib/demo/buyer";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createProxiedApiClient } from "@/lib/api/client";
import { requireBuyerSession } from "@/lib/auth/buyer";
import { cn } from "@/lib/utils";

interface BackendRequest {
  id: string;
  buyer_id: string;
  origin_country: string;
  origin_airport_code: string;
  destination_country: string;
  destination_airport_code: string;
  needed_by: string;
  product_title: string;
  product_category: string;
  product_url: string | null;
  quantity: number;
  declared_value_minor: number | null;
  declared_currency: string | null;
  hs_code: string | null;
  fulfilment_mode: string;
  is_for_third_party: boolean;
  compliance_status: string;
  compliance_reason: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export const metadata: Metadata = { title: "Active requests" };

export default async function BuyerRequestsPage() {
  const supabase = createServerClient();
  // Ensure the buyer is authenticated and active on the backend.
  await requireBuyerSession(supabase);

  let requests: BackendRequest[] = [];
  let requestsError: string | null = null;
  let isLoading = true;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? null;
    const api = createProxiedApiClient();
    const data = (await api.GET("/requests/mine", { token })) as BackendRequest[];
    requests = Array.isArray(data) ? data : [];
  } catch (err) {
    requestsError = err instanceof Error ? err.message : "Failed to load requests.";
  } finally {
    isLoading = false;
  }

  if (isLoading) {
    return (
      <BuyerShell active="requests">
        <LoadingState />
      </BuyerShell>
    );
  }

  if (requestsError) {
    return (
      <BuyerShell active="requests">
        <EmptyState
          title="Unable to load requests"
          description={requestsError}
          action={
            <ButtonLink href="/buyer/dashboard" variant="outline">
              Back to dashboard
            </ButtonLink>
          }
        />
      </BuyerShell>
    );
  }

  const requestedStatus = requests.filter((r) => r.status === "PENDING_REVIEW" || r.status === "REQUESTED");
  const quotedStatus = requests.filter((r) => r.status === "QUOTED" || r.status === "quoted");
  const matchedStatus = requests.filter((r) => r.status === "MATCHED" || r.status === "matched");

  return (
    <BuyerShell active="requests">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Sourcing pipeline</p>
          <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">
            Active requests
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Your product requests with traveler matches, quote tracking, and fulfilment progress.
          </p>
        </div>

        <ButtonLink
          href="/buyer/requests/new"
          leadingIcon={<Plus className="size-4" strokeWidth={2} aria-hidden="true" />}
        >
          New request
        </ButtonLink>
      </header>

      {requests.length === 0 && (
        <EmptyState
          title="No requests yet"
          description="Create your first product request to get quotes from travelers."
          action={
            <ButtonLink href="/buyer/requests/new">
              Create a product request
            </ButtonLink>
          }
        />
      )}

      {requests.length > 0 && (
        <>
          {/* ── Summary stats ───────────────────────────────────────────────── */}
          <section className="mt-8">
            <div className="grid gap-4 sm:grid-cols-3">
              <article className="rounded-2xl border border-border bg-surface p-6">
                <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Total requests
                </p>
                <p className="mt-2 font-serif text-4xl text-burgundy">
                  {String(requests.length).padStart(2, "0")}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {requestedStatus.length} awaiting quotes,{matchedStatus.length} matched
                </p>
              </article>

              <article className="rounded-2xl border border-border bg-surface p-6">
                <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Traveler matches
                </p>
                <p className="mt-2 font-serif text-4xl text-burgundy">
                  {String(matchedStatus.length).padStart(2, "0")}
                </p>
                <p className="mt-2 text-xs text-muted">Across all active requests</p>
              </article>

              <article className="rounded-2xl border border-border bg-surface p-6">
                <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Quotes received
                </p>
                <p className="mt-2 font-serif text-4xl text-burgundy">
                  {String(quotedStatus.length).padStart(2, "0")}
                </p>
                <p className="mt-2 text-xs text-muted">{quotedStatus.length} requests have quotes</p>
              </article>
            </div>
          </section>

          {/* ── Active requests list ────────────────────────────────────────── */}
          <section className="mt-12">
            <SectionHeading
              eyebrow="Your requests"
              title={`${requests.length} product requests in progress`}
              description="Each request shows current status, matched travelers, and quote activity."
            />

            <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
              {requests.map((request, index) => {
                const originCountry = request.origin_country;
                const destCountry = request.destination_country;
                const originAirport = request.origin_airport_code;
                const destAirport = request.destination_airport_code;

                return (
                  <article
                    key={request.id}
                    className={cn(
                      "group grid gap-5 p-5 transition-colors hover:bg-surface-muted/30 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center",
                      index !== requests.length - 1 && "border-b border-border",
                    )}
                  >
                    {/* Product image */}
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-surface-muted sm:size-[6.5rem]">
                      <Image
                        src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80"
                        alt={request.product_title}
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
                          status={request.status.toLowerCase() as any}
                          className={request.status === "MATCHED" || request.status === "matched" ? "text-champagne-ink" : undefined}
                        />
                        <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Request {request.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>

                      <h3 className="mt-2 text-xl leading-snug">{request.product_title}</h3>

                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                        <span>{originCountry}</span>
                        <ArrowRight className="size-3.5 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
                        <span>{destCountry}</span>
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                        <span>
                          {request.declared_value_minor != null && request.declared_currency ? (
                            <>
                              <strong className="font-medium text-foreground">{formatCurrency(request.declared_value_minor / 100, request.declared_currency)}</strong>{" "}
                              declared value
                            </>
                          ) : (
                            "No declared value"
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3.5 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
                          Needed {formatDate(request.needed_by)}
                        </span>
                        <span>{request.fulfilment_mode}</span>
                      </div>
                    </div>

                    {/* Match signal */}
                    <div className="sm:min-w-32 sm:text-right">
                      <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Compliance
                      </p>
                      <p className="mt-1 font-serif text-2xl text-burgundy">
                        {request.compliance_status}
                      </p>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-surface-muted sm:ml-auto sm:w-28">
                        <div className="h-full rounded-full bg-champagne-strong" style={{ width: request.compliance_status === "APPROVED" ? "100%" : "0%" }} />
                      </div>
                      <p className="mt-1.5 text-[0.625rem] text-muted">
                        {request.status}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>

            <p className="mt-4 text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
              Requests loaded from the backend. Status is confirmed by the API on every load.
            </p>
          </section>

          {/* ── Next steps ──────────────────────────────────────────────────── */}
          <section className="mt-12">
            <div className="rounded-2xl border border-champagne/20 bg-champagne/5 p-6">
              <h2 className="text-lg font-medium text-foreground">Next steps with your requests</h2>
              <ul className="mt-4 grid gap-3 text-sm text-muted">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-champagne-strong" />
                  <span>Review quotes from matched travelers and compare carrying fees</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-champagne-strong" />
                  <span>Message travelers to confirm product availability and ask questions</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-champagne-strong" />
                  <span>Accept a quote to move forward with purchase and delivery</span>
                </li>
              </ul>

              <div className="mt-6">
                <ButtonLink href="/buyer/requests/new" variant="outline" size="sm" leadingIcon={<Plus className="size-4" strokeWidth={2} aria-hidden="true" />}>
                  Create another request
                </ButtonLink>
              </div>
            </div>
          </section>
        </>
      )}
    </BuyerShell>
  );
}
