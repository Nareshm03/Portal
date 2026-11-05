// Task 13 Phase 3 — Buyer Dashboard (async server component)
// Connects to GET /api/v1/me and GET /api/v1/requests/mine.
// Replaces hardcoded demo data with live backend data.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Globe2,
  Plane,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { Badge, ButtonLink, SectionHeading } from "@/components/ui";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createApiClient } from "@/lib/api/client";
import { getBuyerProfile, requireBuyerSession } from "@/lib/auth/buyer";
import type { Profile } from "@/lib/auth/types";
import { formatCurrency, formatDate } from "@/lib/demo/buyer";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Buyer dashboard" };

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

export default async function BuyerDashboardPage() {
  // Ensure the buyer is authenticated and active on the backend.
  const session = await requireBuyerSession();
  const supabase = createServerClient();

  // Fetch the authoritative buyer profile from the backend.
  const profileResult = await getBuyerProfile(supabase);

  // Fetch the buyer's requests from the backend using the access token.
  let requests: BackendRequest[] = [];
  let requestsError: string | null = null;
  let isLoadingRequests = true;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? null;
    const api = createApiClient();
    const data = (await api.GET("/requests/mine", { token })) as BackendRequest[];
    requests = Array.isArray(data) ? data : [];
  } catch (err) {
    requestsError =
      err instanceof Error ? err.message : "Failed to load requests.";
  } finally {
    isLoadingRequests = false;
  }

  const profile: Profile | null = profileResult.ok && profileResult.profile ? profileResult.profile : null;

  const firstName = profile?.full_name ? profile.full_name.split(" ")[0] : "Buyer";

  return (
    <BuyerShell active="overview">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">
            Buyer overview · {profile?.full_name ? "Verified buyer" : "Buyer"}
          </p>
          <h1 className="mt-2.5 max-w-2xl text-4xl leading-tight sm:text-5xl">
            Good evening, {firstName}.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            Your requests and sourcing activity. Status is confirmed by the
            backend on every load.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {profile && profile.account_status === "ACTIVE" && (
            <>
              <span className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-[0.6875rem] text-muted sm:inline-flex">
                <span className="size-1.5 rounded-full bg-emerald" aria-hidden="true" />
                {profile.kyc_status === "VERIFIED" ? "KYC verified" : "KYC pending"}
              </span>
              <ButtonLink
                href="/buyer/requests/new"
                leadingIcon={
                  <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
                }
              >
                New product request
              </ButtonLink>
            </>
          )}
          {!profile || profile.account_status !== "ACTIVE" && (
            <span className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-[0.6875rem] text-muted sm:inline-flex">
              Account not yet active — please complete onboarding.
            </span>
          )}
        </div>
      </header>

      {/* ── Profile & requests overview ─────────────────────────────────────── */}
      <div className="mt-8 grid gap-5 xl:grid-cols-12">
        <section className="relative isolate overflow-hidden rounded-2xl bg-burgundy-deep text-ivory xl:col-span-8">
          <Image
            src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1600&q=80"
            alt="Buyer dashboard hero"
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
              <Badge variant="champagne">Overview</Badge>
              <span className="text-[0.625rem] uppercase tracking-[0.18em] text-ivory/60">
                Live backend data
              </span>
            </div>

            <div className="max-w-xl">
              <h2 className="text-3xl leading-tight text-ivory sm:text-4xl">
                Your sourcing desk
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-ivory/70">
                View your requests, their status and compliance review. All data
                is fetched live from the backend.
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
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[0.625rem] uppercase tracking-[0.16em] text-ivory/60">
              <span className="inline-flex items-center gap-1.5">
                <Globe2 className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                Cross-border sourcing
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Plane className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                Traveler network
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                Compliance reviewed
              </span>
            </div>
          </div>
        </section>

        <aside className="xl:col-span-4">
          <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(43,10,19,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">At a glance</p>
                <h2 className="mt-2 text-2xl">Your requests</h2>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-champagne-strong/40 bg-champagne/15">
                <Sparkles className="size-4 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
              </span>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
              <div className="bg-surface p-4">
                <dt className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Total requests
                </dt>
                <dd className="mt-2 font-serif text-3xl leading-none text-burgundy">
                  {String(requests.length).padStart(2, "0")}
                </dd>
                <dd className="mt-2">
                  <Link
                    href="#requests"
                    className="inline-flex items-center gap-1 text-[0.625rem] text-muted transition-colors hover:text-burgundy"
                  >
                    View all requests
                    <ArrowUpRight className="size-3" strokeWidth={2} aria-hidden="true" />
                  </Link>
                </dd>
              </div>
              <div className="bg-surface p-4">
                <dt className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Open requests
                </dt>
                <dd className="mt-2 font-serif text-3xl leading-none text-burgundy">
                  {String(requests.filter((r) => r.status === "OPEN").length).padStart(2, "0")}
                </dd>
                <dd className="mt-2">
                  <span className="text-[0.5625rem] text-muted">Awaiting compliance or quotes</span>
                </dd>
              </div>
            </dl>

            {profile && (
              <p className="mt-5 rounded-lg border border-champagne-strong/25 bg-champagne/10 p-3 text-[0.6875rem] leading-relaxed text-muted">
                <span className="font-medium text-burgundy">Account status:</span>{" "}
                {profile.account_status}{" "}
                <span className="font-medium text-burgundy">KYC:</span>{" "}
                {profile.kyc_status}
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* ── Active product requests ────────────────────────────────────── */}
      <section id="requests" className="mt-14 scroll-mt-28">
        <SectionHeading
          eyebrow="Sourcing pipeline"
          title="Active product requests"
          description="Your requests, with live status and compliance from the backend."
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

        {isLoadingRequests ? (
          <div className="mt-6 flex items-center justify-center py-20">
            <p className="text-muted">Loading requests…</p>
          </div>
        ) : requestsError ? (
          <div className="mt-6 rounded-xl border border-red-600/20 bg-red-600/10 p-6 text-sm text-red-700">
            <p>Failed to load requests: {requestsError}</p>
            <ButtonLink
              href="/buyer/dashboard"
              variant="outline"
              size="sm"
            >
              Retry
            </ButtonLink>
          </div>
        ) : requests.length === 0 ? (
          <div className="mt-6 rounded-xl border border-border bg-surface p-12 text-center">
            <p className="text-muted">No requests yet.</p>
            <ButtonLink href="/buyer/requests/new" size="sm">
              Create your first request
            </ButtonLink>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
            {requests.map((request, index) => (
              <article
                key={request.id}
                className={cn(
                  "group grid gap-5 p-5 transition-colors hover:bg-surface-muted/30 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center",
                  index !== requests.length - 1 && "border-b border-border",
                )}
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-surface-muted sm:size-[6.5rem]">
                  <Image
                    src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80"
                    alt={request.product_title}
                    fill
                    sizes="104px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-burgundy-deep/80 px-1.5 py-0.5 text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-champagne">
                    Live
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {request.status}
                    </Badge>
                    <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Request {request.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>

                  <h3 className="mt-2 text-xl">{request.product_title}</h3>

                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                    <span>{request.origin_country}</span>
                    <ArrowRight className="size-3.5 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
                    <span>{request.destination_country}</span>
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                    <span>
                      <strong className="font-medium text-foreground">
                        {request.declared_value_minor != null
                          ? formatCurrency(request.declared_value_minor / 100, request.declared_currency ?? "USD")
                          : "Budget not set"}
                      </strong>{" "}
                      budget
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
                      Needed {formatDate(request.needed_by.replace(" ", "T"))}
                    </span>
                  </div>
                </div>

                <div className="sm:min-w-32 sm:text-right">
                  <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Compliance
                  </p>
                  <p className="mt-1 font-serif text-2xl text-burgundy">
                    {request.compliance_status}
                  </p>
                  <p className="mt-1 text-[0.625rem] text-muted">
                    Order status: {request.status}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </BuyerShell>
  );
}
