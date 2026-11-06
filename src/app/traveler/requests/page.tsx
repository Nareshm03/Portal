import type { Metadata } from "next";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { SectionHeading, StatusBadge, EmptyState, LoadingState } from "@/components/ui";
import { airportLabel, formatCurrency, formatDate } from "@/lib/demo/traveler";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createProxiedApiClient } from "@/lib/api/client";
import { requireTravellerSession } from "@/lib/auth/traveler";

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

export const metadata: Metadata = { title: "Available requests" };

export default async function TravelerRequestsPage() {
  const supabase = createServerClient();
  await requireTravellerSession(supabase);

  let requests: BackendRequest[] = [];
  let requestsError: string | null = null;
  let isLoading = true;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? null;
    const api = createProxiedApiClient();
    const data = (await api.GET("/requests?matching=me", { token })) as BackendRequest[];
    requests = Array.isArray(data) ? data : [];
  } catch (err) {
    requestsError = err instanceof Error ? err.message : "Failed to load requests.";
  } finally {
    isLoading = false;
  }

  if (isLoading) {
    return (
      <TravelerShell active="requests">
        <LoadingState />
      </TravelerShell>
    );
  }

  return (
    <TravelerShell active="requests">
      <header>
        <p className="eyebrow">Buyer requests</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Available requests</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Buyer requests that match your registered routes and travel dates.
          Submit a quote with your carrying fee and estimated fulfilment date.
        </p>
      </header>

      {requestsError && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {requestsError}
        </div>
      )}

      {requests.length === 0 && !requestsError && (
        <EmptyState
          title="No matching requests"
          description="No buyer requests match your registered routes yet. Register a trip to start seeing matches."
          action={
            <a href="/traveler/trips/new" className="inline-flex items-center gap-2 rounded-md bg-champagne px-4 py-2.5 text-sm font-medium text-burgundy-deep transition-colors hover:bg-champagne/90">
              Register a trip
            </a>
          }
        />
      )}

      {requests.length > 0 && (
        <section className="mt-8">
          <SectionHeading
            eyebrow="Matching your routes"
            title={`${requests.length} buyer requests`}
            description="Requests that match your registered routes and travel dates."
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {requests.map((request) => (
              <article
                key={request.id}
                className="group overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-champagne-strong/60 hover:shadow-md"
              >
                <div className="relative h-48 w-full overflow-hidden bg-surface-muted">
                  <Image
                    src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80"
                    alt={request.product_title}
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
                    <StatusBadge status={request.compliance_status.toLowerCase() as any} />
                    <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {request.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg leading-snug">{request.product_title}</h3>

                  <p className="mt-2 text-sm text-muted">{request.product_category}</p>

                  <div className="mt-3 space-y-1 text-xs text-muted">
                    <p className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 shrink-0 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
                      {request.origin_country} →{" "}
                      {request.destination_country}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        {request.declared_value_minor != null && request.declared_currency
                          ? formatCurrency(request.declared_value_minor / 100, request.declared_currency)
                          : "No budget specified"
                        }
                      </span>
                      declared value
                    </p>
                    <p>
                      Needed by{" "}
                      <strong className="font-medium text-foreground">{formatDate(request.needed_by)}</strong>
                    </p>
                    <p>Quantity: {request.quantity}</p>
                    <p className="pt-1 text-muted-foreground">
                      {request.fulfilment_mode} · {request.is_for_third_party ? "Third-party" : "Self"}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-6 text-[0.6875rem] leading-relaxed text-muted-foreground">
            Requests loaded from the backend. Compliance status determines whether
            you can submit a quote for each request.
          </p>
        </section>
      )}
    </TravelerShell>
  );
}
