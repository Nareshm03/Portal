"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { CheckCircle2, MapPin, Plane, QrCode, RefreshCw } from "lucide-react";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { Badge, SectionHeading, StatusBadge, EmptyState, LoadingState, ButtonLink } from "@/components/ui";
import { airportLabel, formatCurrency, formatDate } from "@/lib/demo/traveler";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { createProxiedApiClient, ApiError } from "@/lib/api/client";

interface BackendOrder {
  id: string;
  state: string;
  buyer_id: string;
  traveller_id: string;
  created_at: string;
  updated_at: string;
  request?: {
    product_title: string;
    origin_country: string;
    origin_airport_code: string;
    destination_country: string;
    destination_airport_code: string;
  };
}

interface OtpIssueResponse {
  challengeId: string;
  expiresAt: string;
  recipient: string;
  smsSent: boolean;
  code?: string;
  demo?: boolean;
  warning?: string;
}

interface OtpVerifyResponse {
  orderId: string;
  state: string;
  warning?: string;
}

export default function TravelerHandoverPage() {
  const [orders, setOrders] = useState<BackendOrder[]>([]);
  const [issuingOtp, setIssuingOtp] = useState<string | null>(null);
  const [verifyingOtp, setVerifyingOtp] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpForOrder, setOtpForOrder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
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
      const result = await api.request("/orders/assigned", { token });

      if (result.demo) {
        setDemoMode(true);
        setLoading(false);
        return;
      }

      const data = result.body as { data: BackendOrder[] };
      setOrders(data?.data ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.demo) {
        setDemoMode(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load orders.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
  };

  const issueOtp = async (orderId: string) => {
    setIssuingOtp(orderId);
    setError(null);

    try {
      const token = supabase?.auth?.getSession ? (await supabase.auth.getSession()).data.session?.access_token : null;
      if (!token) {
        setError("Not authenticated.");
        return;
      }

      const api = createProxiedApiClient();

      const result = await api.request(`/orders/${orderId}/handover/issue-otp`, {
        token,
        body: JSON.stringify({}),
      });

      if (result.demo) {
        setDemoMode(true);
        setIssuingOtp(null);
        const data = result.body as OtpIssueResponse & { code?: string };
        setOtpCode(data.code ?? "");
        setOtpForOrder(orderId);
        setSuccessMessage(data.warning || "Demo OTP issued. Code shown for testing.");
        setTimeout(() => setSuccessMessage(null), 5000);
        return;
      }

      const data = result.body as OtpIssueResponse;
      setOtpForOrder(orderId);
      setSuccessMessage(
        `OTP issued for buyer verification. SMS sent: ${data.smsSent}. Expires at ${new Date(data.expiresAt).toLocaleTimeString()}.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
      setIssuingOtp(null);

      await fetchOrders();
    } catch (err) {
      setIssuingOtp(null);
      setError(err instanceof Error ? err.message : "Failed to issue OTP.");
    }
  };

  const verifyOtp = async () => {
    if (!otpForOrder || !otpCode.trim()) return;

    setVerifyingOtp(otpForOrder);
    setError(null);

    try {
      const token = supabase?.auth?.getSession ? (await supabase.auth.getSession()).data.session?.access_token : null;
      if (!token) {
        setError("Not authenticated.");
        return;
      }

      const api = createProxiedApiClient();

      const result = await api.request(`/orders/${otpForOrder}/handover/verify`, {
        token,
        body: JSON.stringify({ code: otpCode.trim() }),
      });

      if (result.demo) {
        setDemoMode(true);
        setVerifyingOtp(null);
        setOtpCode("");
        setOtpForOrder(null);
        const data = result.body as OtpVerifyResponse & { warning?: string };
        setSuccessMessage(data.warning || "Demo OTP verified. Order completed.");
        setTimeout(() => setSuccessMessage(null), 5000);
        await fetchOrders();
        return;
      }

      const data = result.body as OtpVerifyResponse;
      setVerifyingOtp(null);
      setOtpCode("");
      setOtpForOrder(null);
      setSuccessMessage(data.warning || `OTP verified. Order state: ${data.state}.`);
      setTimeout(() => setSuccessMessage(null), 5000);
      await fetchOrders();
    } catch (err) {
      setVerifyingOtp(null);
      setError(err instanceof Error ? err.message : "OTP verification failed.");
    }
  };

  const handleRefreshOrders = async () => {
    setRefreshing(true);
    await fetchOrders();
  };

  const landedOrders = orders.filter((o) => o.state === "LANDED");
  const nonLandedOrders = orders.filter((o) => o.state !== "LANDED");

  if (loading) {
    return (
      <TravelerShell active="handover">
        <LoadingState />
      </TravelerShell>
    );
  }

  const displayOrders = demoMode || orders.length === 0 ? [
    {
      id: "ord-3127",
      state: "LANDED",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      request: {
        product_title: "Acne Studios Musubi shoulder bag",
        origin_country: "France",
        origin_airport_code: "CDG",
        destination_country: "India",
        destination_airport_code: "BOM",
      },
    },
  ] : orders;

  if (error && !demoMode) {
    return (
      <TravelerShell active="handover">
        <EmptyState title="Unable to load orders" description={error} />
      </TravelerShell>
    );
  }

  if (displayOrders.length === 0) {
    return (
      <TravelerShell active="handover">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">Delivery management</p>
            <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Arrival & handover</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Mark your arrival in India, prepare orders for buyer handover, and complete deliveries with one-time codes.
            </p>
          </div>
        </header>
        <EmptyState
          title="No orders ready for handover"
          description="Orders that have landed will appear here for OTP-based handover."
          action={
            <ButtonLink href="/traveler/orders">View Orders</ButtonLink>
          }
        />
      </TravelerShell>
    );
  }

  return (
    <TravelerShell active="handover">
      {demoMode && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-champagne-strong/20 bg-champagne/10 px-3 py-2 text-[0.6875rem] leading-relaxed text-champagne-ink">
          <span className="mt-0.5 size-3.5 shrink-0 text-champagne-strong" aria-hidden="true">●</span>
          Demo mode — backend handover unavailable. Sample orders shown.
        </div>
      )}

      {error && demoMode && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-green-600/30 bg-green-50/50 px-4 py-3">
          <span className="mt-0.5 size-5 shrink-0 text-green-600" aria-hidden="true">✓</span>
          <div className="flex-1 text-sm text-green-800">{successMessage}</div>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Delivery management</p>
          <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Arrival & handover</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Mark your arrival in India, prepare orders for buyer handover, and complete deliveries with one-time codes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshOrders}
            disabled={refreshing}
            className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted ${refreshing ? "opacity-60" : ""}`}
          >
            {refreshing ? <RefreshCw className="size-4 animate-spin" strokeWidth={1.75} /> : <RefreshCw className="size-4" strokeWidth={1.75} />}
            Refresh
          </button>
        </div>
      </header>

      {/* Orders ready for OTP handover (LANDED state) */}
      <section className="mt-8">
        <SectionHeading
          eyebrow="Ready for handover"
          title={`${landedOrders.length} order${landedOrders.length !== 1 ? "s" : ""} ready for OTP`}
          description="Issue a handover OTP for the buyer to verify on arrival."
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {landedOrders.map((order) => (
            <article
              key={order.id}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className="relative h-32 w-full overflow-hidden bg-surface-muted">
                <Image
                  src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80"
                  alt={order.request?.product_title ?? "Order product"}
                  fill
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  className="object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
                <div className="absolute left-4 top-4">
                  <StatusBadge status={"landed" as any} />
                </div>
                <span className="absolute bottom-3 right-4 text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  #{order.id.slice(0, 8).toUpperCase()}
                </span>
              </div>

              <div className="p-5">
                <h3 className="text-lg leading-snug">{order.request?.product_title ?? "Order"}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <MapPin className="size-3.5 shrink-0 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
                  {order.request?.origin_country} → {order.request?.destination_country}
                </p>

                <div className="mt-4 rounded-lg border border-champagne-strong/40 bg-champagne/10 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-champagne-ink">
                    <QrCode className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    Handover OTP
                  </div>

                  {demoMode && otpForOrder === order.id && otpCode && (
                    <div className="mt-3 p-3 rounded-lg border border-champagne-strong bg-champagne/5">
                      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-champagne-ink">
                        Demo OTP Code
                      </p>
                      <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-burgundy">
                        {otpCode}
                      </p>
                      <p className="mt-2 text-[0.625rem] text-muted">
                        Share this code with the buyer for verification.
                      </p>
                    </div>
                  )}

                  {!demoMode && otpForOrder !== order.id && (
                    <div className="mt-3">
                      <button
                        type="button"
                        disabled={issuingOtp === order.id}
                        onClick={() => issueOtp(order.id)}
                        className="w-full rounded-md bg-burgundy px-4 py-2 text-sm font-semibold text-ivory transition-colors hover:bg-burgundy-deep disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {issuingOtp === order.id ? "Issuing…" : "Issue Handover OTP"}
                      </button>
                    </div>
                  )}

                  {!demoMode && otpForOrder === order.id && (
                    <div className="mt-3 p-3 rounded-lg border border-champagne-strong bg-champagne/5">
                      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-champagne-ink">
                        OTP Issued
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Waiting for buyer to verify. Ask the buyer for the OTP code they received.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder="000000"
                          maxLength={6}
                          className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground shadow-sm transition-colors focus:border-champagne-strong focus:outline-none focus:ring-1 focus:ring-champagne-strong"
                        />
                        <button
                          type="button"
                          disabled={verifyingOtp === order.id || !otpCode.trim()}
                          onClick={verifyOtp}
                          className="rounded-md bg-burgundy px-4 py-2 text-sm font-semibold text-ivory transition-colors hover:bg-burgundy-deep disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {verifyingOtp === order.id ? "Verifying…" : "Verify OTP"}
                        </button>
                      </div>
                    </div>
                  )}

                  {demoMode && otpForOrder !== order.id && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpCode("123456");
                          setOtpForOrder(order.id);
                        }}
                        className="w-full rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                      >
                        Simulate OTP Issue (Demo)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Other orders */}
      {nonLandedOrders.length > 0 && (
        <section className="mt-12">
          <SectionHeading
            eyebrow="Other orders"
            title="Not yet ready for handover"
            description="Orders that have not reached the LANDED state cannot use OTP handover yet."
          />

          <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {nonLandedOrders.map((order) => (
              <div key={order.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{order.request?.product_title ?? "Order"}</p>
                    <p className="mt-1 text-xs text-muted">
                      #{order.id.slice(0, 8).toUpperCase()} · {order.state}
                    </p>
                  </div>
                  <span className="text-xs text-muted">{order.state}</span>
                </div>
                <p className="mt-2 text-[0.625rem] text-muted">
                  Order must reach LANDED state before OTP handover can be issued.
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-6 text-[0.6875rem] leading-relaxed text-muted-foreground">
        {demoMode
          ? "Demo OTP flow — codes are simulated for testing only."
          : "OTP is issued by the traveller and verified by the buyer to confirm handover. The OTP code is never exposed to the traveller in production."}
      </p>
    </TravelerShell>
  );
}
