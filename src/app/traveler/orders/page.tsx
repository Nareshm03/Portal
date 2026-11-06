"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { MapPin, RefreshCw } from "lucide-react";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { SectionHeading, StatusBadge, EmptyState, LoadingState, ButtonLink } from "@/components/ui";
import { airportLabel, formatCurrency, formatDate, ORDER_STAGES } from "@/lib/demo/traveler";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { createProxiedApiClient, ApiError } from "@/lib/api/client";

interface BackendOrder {
  id: string;
  request_id: string;
  quote_id: string;
  buyer_id: string;
  traveller_id: string;
  state: string;
  subtotal_paise: number;
  platform_fee_paise: number;
  total_paise: number;
  deposit_paise: number;
  currency: string;
  payment_deadline: string;
  forfeit_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  request?: {
    id: string;
    product_title: string;
    product_category: string;
    origin_country: string;
    origin_airport_code: string;
    destination_country: string;
    destination_airport_code: string;
    needed_by: string;
  };
  payment?: {
    status: string;
    provider: string;
    amount_paise: number;
    currency: string;
  };
}

export default function TravelerOrdersPage() {
  const [orders, setOrders] = useState<BackendOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<BackendOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
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

      const data = result.body as { data: BackendOrder[]; pagination: any };
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

  const markOrderState = async (orderId: string, targetState: "PURCHASED" | "LANDED") => {
    setError(null);

    try {
      const token = supabase?.auth?.getSession ? (await supabase.auth.getSession()).data.session?.access_token : null;
      if (!token) {
        setError("Not authenticated.");
        return;
      }

      const api = createProxiedApiClient();

      const result = await api.request(`/orders/${orderId}/${targetState.toLowerCase()}`, {
        token,
        body: JSON.stringify({ note: `Order ${targetState.toLowerCase()} by traveller` }),
      });

      if (result.demo) {
        setDemoMode(true);
        return;
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, state: targetState } : o)),
      );
      setSelectedOrder((prev) => (prev?.id === orderId ? { ...prev, state: targetState } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to mark order as ${targetState}.`);
    }
  };

  const handleRefreshOrders = async () => {
    setRefreshing(true);
    await fetchOrders();
  };

  const activeOrders = orders.filter(
    (o) => o.state !== "COMPLETED" && o.state !== "FORFEITED" && o.state !== "EXPIRED" && o.state !== "DISPUTED" && o.state !== "CANCELLED",
  );
  const completedOrders = orders.filter((o) => o.state === "COMPLETED");

  if (loading) {
    return (
      <TravelerShell active="orders">
        <LoadingState />
      </TravelerShell>
    );
  }

  const displayOrders = demoMode || orders.length === 0 ? [
    {
      id: "ord-3127",
      state: "LANDED",
      total_paise: 145000,
      deposit_paise: 36250,
      currency: "INR",
      created_at: new Date().toISOString(),
      request: {
        product_title: "Acne Studios Musubi shoulder bag",
        origin_country: "France",
        origin_airport_code: "CDG",
        destination_country: "India",
        destination_airport_code: "BOM",
        needed_by: "2026-12-24",
      },
      payment: { status: "CAPTURED", provider: "MOCK", amount_paise: 36250, currency: "INR" },
    },
    {
      id: "ord-3094",
      state: "PURCHASED",
      total_paise: 21000,
      deposit_paise: 5250,
      currency: "INR",
      created_at: new Date().toISOString(),
      request: {
        product_title: "On Running Cloudmonster 2",
        origin_country: "Netherlands",
        origin_airport_code: "AMS",
        destination_country: "India",
        destination_airport_code: "BOM",
        needed_by: "2027-01-02",
      },
      payment: { status: "CAPTURED", provider: "MOCK", amount_paise: 5250, currency: "INR" },
    },
  ] : orders;

  const activeDisplayOrders = displayOrders.filter(
    (o) => o.state !== "COMPLETED" && o.state !== "FORFEITED" && o.state !== "EXPIRED" && o.state !== "DISPUTED" && o.state !== "CANCELLED",
  );
  const completedDisplayOrders = displayOrders.filter((o) => o.state === "COMPLETED");

  if (error && !demoMode) {
    return (
      <TravelerShell active="orders">
        <EmptyState title="Unable to load orders" description={error} />
      </TravelerShell>
    );
  }

  const stageIndexForState = (state: string): number => {
    const map: Record<string, number> = {
      ACCEPTED: 0, LOCKED: 1, PURCHASED: 2, LANDED: 3, COMPLETED: 4, DISPUTED: 5, FORFEITED: 6, EXPIRED: 7, CANCELLED: 8,
    };
    return map[state] ?? 0;
  };

  if (displayOrders.length === 0) {
    return (
      <TravelerShell active="orders">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">Order management</p>
            <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Active orders</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Orders in your care, with purchase proof, arrival tracking and handover preparation.
            </p>
          </div>
        </header>
        <EmptyState
          title="No orders yet"
          description="Accept a buyer quote to get your first assigned order."
          action={
            <ButtonLink href="/traveler/quotes">View Quotes</ButtonLink>
          }
        />
      </TravelerShell>
    );
  }

  return (
    <TravelerShell active="orders">
      {demoMode && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-champagne-strong/20 bg-champagne/10 px-3 py-2 text-[0.6875rem] leading-relaxed text-champagne-ink">
          <span className="mt-0.5 size-3.5 shrink-0 text-champagne-strong" aria-hidden="true">●</span>
          Demo mode — backend orders list unavailable. Sample orders shown.
        </div>
      )}

      {error && demoMode && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Order management</p>
          <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Active orders</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Orders in your care, with purchase proof, arrival tracking and handover preparation.
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

      <section className="mt-8">
        <SectionHeading
          eyebrow="In progress"
          title={`${activeDisplayOrders.length} active orders`}
          description="Orders currently being fulfilled with receipt evidence and tracking."
        />

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {activeDisplayOrders.map((order, index) => {
            const isDark = index === 0;
            const stageIndex = stageIndexForState(order.state);
            const progress = ORDER_STAGES.length > 1 ? (stageIndex / (ORDER_STAGES.length - 1)) * 100 : 0;

            const canPurchase = order.state === "LOCKED";
            const canLand = order.state === "PURCHASED";

            return (
              <article
                key={order.id}
                onClick={() => setSelectedOrder(order as BackendOrder)}
                className={cn(
                  "relative overflow-hidden rounded-2xl cursor-pointer transition-all hover:shadow-lg",
                  isDark ? "bg-burgundy-deep text-ivory hover:shadow-burgundy-deep/20" : "border border-border bg-surface hover:border-champagne/40",
                )}
              >
                <div className="relative h-40 w-full overflow-hidden">
                  <Image
                    src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80"
                    alt={order.request?.product_title ?? "Order product"}
                    fill
                    sizes="(min-width: 1024px) 45vw, 100vw"
                    className={cn(
                      "object-cover transition-transform duration-700 hover:scale-105",
                      isDark ? "opacity-55" : "opacity-90",
                    )}
                  />
                  <div
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-0 bg-gradient-to-t",
                      isDark ? "from-burgundy-deep via-burgundy-deep/30 to-transparent" : "from-surface via-surface/20 to-transparent",
                    )}
                  />
                  <div className="absolute left-4 top-4">
                    <StatusBadge
                      status={order.state.toLowerCase() as any}
                      className={
                        isDark ? "border-champagne/40 bg-champagne text-burgundy-deep" : "text-champagne-ink"
                      }
                    />
                  </div>
                  <span
                    className={cn(
                      "absolute bottom-3 right-4 text-[0.5625rem] font-semibold uppercase tracking-[0.18em]",
                      isDark ? "text-ivory/50" : "text-muted-foreground",
                    )}
                  >
                    #{order.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                <div className="p-5">
                  <h3 className={cn("text-lg leading-snug", isDark ? "text-ivory" : "text-foreground")}>
                    {order.request?.product_title ?? "Order"}
                  </h3>
                  <p className={cn("mt-1 flex items-center gap-1.5 text-xs", isDark ? "text-ivory/55" : "text-muted")}>
                    <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {order.request?.origin_country} → {airportLabel(order.request?.destination_airport_code as any)}
                  </p>

                  <div className="mt-5">
                    <div className={cn("relative h-1.5 rounded-full", isDark ? "bg-white/15" : "bg-surface-muted")}>
                      <div className="absolute inset-y-0 left-0 rounded-full bg-champagne-strong" style={{ width: `${progress}%` }} />
                      {ORDER_STAGES.map((stage, stageIndex) => (
                        <span
                          key={stage}
                          className={cn(
                            "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border",
                            stageIndex <= stageIndex
                              ? "border-champagne-strong bg-champagne"
                              : isDark ? "border-white/25 bg-burgundy-deep" : "border-border-strong bg-surface",
                          )}
                          style={{ left: `${(stageIndex / (ORDER_STAGES.length - 1)) * 100}%` }}
                        />
                      ))}
                    </div>
                    <div className={cn("mt-3 flex justify-between gap-2 text-[0.5625rem] uppercase tracking-[0.12em]", isDark ? "text-ivory/60" : "text-muted-foreground")}>
                      <span>{ORDER_STAGES[0]}</span>
                      <span>{ORDER_STAGES[Math.min(stageIndex, ORDER_STAGES.length - 1)]}</span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2 text-xs">
                    <div className="flex items-baseline justify-between">
                      <span className={isDark ? "text-ivory/55" : "text-muted"}>State</span>
                      <span className={isDark ? "text-ivory" : "font-medium text-foreground"}>
                        {order.state}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={isDark ? "text-ivory/55" : "text-muted"}>Total</span>
                      <span className={isDark ? "text-champagne" : "text-burgundy"}>
                        {formatCurrency(order.total_paise / 100)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={isDark ? "text-ivory/55" : "text-muted"}>Deposit</span>
                      <span className={isDark ? "text-ivory" : "font-medium text-foreground"}>
                        {formatCurrency(order.deposit_paise / 100)}
                      </span>
                    </div>
                    {order.payment && (
                      <div className="flex items-baseline justify-between">
                        <span className={isDark ? "text-ivory/55" : "text-muted"}>Payment</span>
                        <span className={isDark ? "text-ivory" : "font-medium text-foreground"}>
                          {order.payment.status}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex gap-2">
                    {canPurchase && (
                      <button
                        type="button"
                        onClick={() => markOrderState(order.id, "PURCHASED")}
                        className="flex-1 rounded-lg bg-burgundy-deep px-4 py-2.5 text-sm font-semibold text-ivory transition-colors hover:bg-burgundy-ink"
                      >
                        Mark Purchased
                      </button>
                    )}
                    {canLand && (
                      <button
                        type="button"
                        onClick={() => markOrderState(order.id, "LANDED")}
                        className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted"
                      >
                        Mark Landed
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-4 text-[0.6875rem] leading-relaxed text-muted-foreground">
          {demoMode ? "Demo orders with simulated tracking." : "Orders loaded from the backend."}
        </p>
      </section>

      {completedDisplayOrders.length > 0 && (
        <section className="mt-12">
          <SectionHeading
            eyebrow="History"
            title={`${completedDisplayOrders.length} completed order`}
            description="Successfully delivered orders."
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {completedDisplayOrders.map((order) => (
              <article
                key={order.id}
                onClick={() => setSelectedOrder(order as BackendOrder)}
                className="overflow-hidden rounded-2xl border border-border bg-surface cursor-pointer transition-all hover:shadow-lg hover:border-emerald/40"
              >
                <div className="relative h-32 w-full overflow-hidden">
                  <Image
                    src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80"
                    alt={order.request?.product_title ?? "Order product"}
                    fill
                    sizes="(min-width: 1024px) 45vw, 100vw"
                    className="object-cover opacity-70"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
                  <span className="absolute bottom-3 right-4 text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base text-muted">
                      {order.request?.product_title ?? "Order"}
                    </h3>
                    <StatusBadge status="delivered" label="Completed" />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {order.request?.origin_country} → {airportLabel(order.request?.destination_airport_code as any)}
                  </p>

                  <div className="mt-3 grid gap-2 text-xs">
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted">State</span>
                      <span className="text-muted">{order.state}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted">Total</span>
                      <span className="font-medium text-burgundy">{formatCurrency(order.total_paise / 100)}</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedOrder(null)}
              className="absolute right-4 top-4 text-muted transition-colors hover:text-foreground"
              aria-label="Close"
            >
              <span className="size-5">✕</span>
            </button>
            <h2 className="text-xl font-semibold text-foreground">Order #{selectedOrder.id.slice(0, 8).toUpperCase()}</h2>
            <p className="mt-1 text-sm text-muted">
              {selectedOrder.state} · {formatCurrency(selectedOrder.total_paise / 100)} total
            </p>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-muted">State</span>
                <span className="font-medium">{selectedOrder.state}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-muted">Total</span>
                <span className="font-serif text-burgundy">{formatCurrency(selectedOrder.total_paise / 100)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-muted">Deposit</span>
                <span className="font-medium">{formatCurrency(selectedOrder.deposit_paise / 100)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-muted">Currency</span>
                <span className="font-medium">{selectedOrder.currency}</span>
              </div>
              {selectedOrder.payment_deadline && (
                <div className="flex items-baseline justify-between">
                  <span className="text-muted">Payment deadline</span>
                  <span className="font-medium">{formatDate(selectedOrder.payment_deadline)}</span>
                </div>
              )}
            </div>
            {selectedOrder.payment && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-foreground">Payment</h3>
                <div className="mt-2 grid gap-2 text-xs">
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted">Status</span>
                    <span className="font-medium">{selectedOrder.payment.status}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted">Provider</span>
                    <span className="font-medium">{selectedOrder.payment.provider}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </TravelerShell>
  );
}
