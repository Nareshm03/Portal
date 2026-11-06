"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertCircle, CreditCard, DollarSign, Receipt, Loader2 } from "lucide-react";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { CurrencyConverter } from "@/components/payments/currency-converter";
import { Badge, SectionHeading, EmptyState, LoadingState, ButtonLink } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/demo/buyer";
import { supabase } from "@/lib/supabase/client";
import { createProxiedApiClient, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface BackendOrder {
  id: string;
  state: string;
  deposit_paise: number;
  total_paise: number;
  currency: string;
  payment_deadline: string;
  created_at: string;
  request?: {
    product_title: string;
  };
}

interface BackendPaymentIntent {
  id: string;
  order_id: string;
  provider: string;
  provider_order_id: string | null;
  amount_paise: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function BuyerPaymentsPage() {
  const [orders, setOrders] = useState<BackendOrder[]>([]);
  const [paymentIntents, setPaymentIntents] = useState<BackendPaymentIntent[]>([]);
  const [creatingOrderId, setCreatingOrderId] = useState<string | null>(null);
  const [verifyingIntentId, setVerifyingIntentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchOrdersAndPayments = useCallback(async () => {
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

      const ordersResult = await api.request("/orders/mine", { token });
      if (!ordersResult.demo) {
        const data = ordersResult.body as { data: BackendOrder[] };
        setOrders(data?.data ?? []);
      }

      const ordersList = ordersResult.demo ? [] : (ordersResult.body as { data: BackendOrder[] }).data ?? [];
      const intents: BackendPaymentIntent[] = [];

      for (const order of ordersList) {
        try {
          const orderResult = await api.request(`/orders/${order.id}`, { token });
          if (!orderResult.demo) {
            const orderData = orderResult.body as { payment?: BackendPaymentIntent };
            if (orderData.payment) {
              intents.push(orderData.payment);
            }
          }
        } catch {
          // Skip orders that can't be fetched
        }
      }

      setPaymentIntents(intents);
    } catch (err) {
      if (err instanceof ApiError && err.demo) {
        setDemoMode(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load payments.");
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchOrdersAndPayments();
  }, [fetchOrdersAndPayments]);

  const createPaymentIntent = async (orderId: string) => {
    setCreatingOrderId(orderId);
    setError(null);

    try {
      const token = supabase?.auth?.getSession ? (await supabase.auth.getSession()).data.session?.access_token : null;
      if (!token) {
        setError("Not authenticated.");
        return;
      }

      const api = createProxiedApiClient();
      const idempotencyKey = `pi_${orderId}_${Date.now()}`;

      const result = await api.request("/payments/create-order", {
        token,
        idempotencyKey,
        body: JSON.stringify({ orderId }),
      });

      if (result.demo) {
        setDemoMode(true);
        setCreatingOrderId(null);
        return;
      }

      const data = result.body as { data: BackendPaymentIntent; warning?: string };
      setPaymentIntents((prev) => [...prev, data.data]);
      setCreatingOrderId(null);
      setSuccessMessage(
        data.warning || "Payment intent created. Please verify the payment to lock your order."
      );
      setTimeout(() => setSuccessMessage(null), 5000);

      await fetchOrdersAndPayments();
    } catch (err) {
      setCreatingOrderId(null);
      setError(err instanceof Error ? err.message : "Failed to create payment intent.");
    }
  };

  const verifyPayment = async (intentId: string, providerOrderId: string) => {
    setVerifyingIntentId(intentId);
    setError(null);

    try {
      const token = supabase?.auth?.getSession ? (await supabase.auth.getSession()).data.session?.access_token : null;
      if (!token) {
        setError("Not authenticated.");
        return;
      }

      const api = createProxiedApiClient();

      const result = await api.request("/payments/verify", {
        token,
        body: JSON.stringify({
          paymentIntentId: intentId,
          providerOrderId,
        }),
      });

      if (result.demo) {
        setDemoMode(true);
        setVerifyingIntentId(null);
        return;
      }

      const data = result.body as { data: { status: string; orderId: string; orderState?: string }; warning?: string };
      setPaymentIntents((prev) =>
        prev.map((i) => (i.id === intentId ? { ...i, status: data.data.status } : i)),
      );
      setVerifyingIntentId(null);
      setSuccessMessage(
        data.warning || `Payment verified: ${data.data.status}. Order state: ${data.data.orderState || "updated"}.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);

      await fetchOrdersAndPayments();
    } catch (err) {
      setVerifyingIntentId(null);
      setError(err instanceof Error ? err.message : "Failed to verify payment.");
    }
  };

  const completedIntents = paymentIntents.filter((t) => t.status === "CAPTURED");
  const totalPaidInr = completedIntents.reduce((sum, t) => sum + t.amount_paise, 0);

  const pendingOrders = orders.filter(
    (o) => o.state === "ACCEPTED" && new Date(o.payment_deadline) > new Date(),
  );

  if (loading) {
    return (
      <BuyerShell active="payments">
        <LoadingState />
      </BuyerShell>
    );
  }

  return (
    <BuyerShell active="payments">
      {demoMode && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-champagne-strong/20 bg-champagne/10 px-3 py-2 text-[0.6875rem] leading-relaxed text-champagne-ink">
          <span className="mt-0.5 size-3.5 shrink-0 text-champagne-strong" aria-hidden="true">●</span>
          Demo mode — backend payments unavailable. Sample transaction data shown.
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
          <p className="eyebrow">Financial management</p>
          <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Payments</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Manage payments, view transaction history, and convert currencies for your orders.
          </p>
        </div>
        {demoMode && <Badge variant="champagne">Demo Mode</Badge>}
      </header>

      {/* Demo notice */}
      {demoMode && (
        <div className="mt-8 rounded-xl border border-champagne/20 bg-champagne/5 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">Demo payment system</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Payment intents are simulated. No real money is processed. Backend unavailable — showing sample data.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Payment summary */}
      <section className="mt-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="relative overflow-hidden rounded-2xl bg-burgundy-deep p-6 text-ivory">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(214,185,140,0.25),transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <DollarSign className="size-5 text-champagne" strokeWidth={1.75} aria-hidden="true" />
                <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-ivory/50">Total</span>
              </div>
              <p className="mt-4 text-3xl font-medium tabular-nums text-champagne">
                {formatCurrency(totalPaidInr / 100, 'INR', 0)}
              </p>
              <p className="mt-1.5 text-xs text-ivory/60">Total paid</p>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <Receipt className="size-5 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pending</span>
            </div>
            <p className="mt-4 text-3xl font-medium tabular-nums text-foreground">
              {pendingOrders.length}
            </p>
            <p className="mt-1.5 text-xs text-muted">Orders awaiting payment</p>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <CreditCard className="size-5 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Platform Fee</span>
            </div>
            <p className="mt-4 text-3xl font-medium tabular-nums text-foreground">
              {formatCurrency(totalPaidInr * 0.05 / 100, 'INR', 0)}
            </p>
            <p className="mt-1.5 text-xs text-muted">5% platform fee</p>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <Loader2 className="size-5 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Active Intents</span>
            </div>
            <p className="mt-4 text-3xl font-medium tabular-nums text-foreground">
              {paymentIntents.length}
            </p>
            <p className="mt-1.5 text-xs text-muted">Payment intents created</p>
          </article>
        </div>
      </section>

      {/* Create payment intent */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Create payment"
          title="Create a payment intent"
          description="Select an order awaiting payment to create a mock payment intent."
        />

        <div className="mt-6 rounded-xl border border-border bg-surface p-6">
          {pendingOrders.length === 0 ? (
            <EmptyState
              title="No orders awaiting payment"
              description="All your orders have been paid or no orders are in the ACCEPTED state."
            />
          ) : (
            <div className="space-y-4">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-surface"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {order.request?.product_title ?? "Order"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      #{order.id.slice(0, 8).toUpperCase()} · {order.state} ·
                      {formatCurrency(order.deposit_paise / 100)} deposit due
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Deadline: {formatDate(order.payment_deadline)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-burgundy">
                      {formatCurrency(order.deposit_paise / 100)}
                    </span>
                    <button
                      type="button"
                      disabled={creatingOrderId === order.id}
                      onClick={() => createPaymentIntent(order.id)}
                      className="rounded-lg bg-burgundy-deep px-4 py-2 text-xs font-medium text-ivory transition-colors hover:bg-burgundy-ink disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingOrderId === order.id ? "Creating…" : "Create Intent"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Payment intents table */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Payment intents"
          title={`${paymentIntents.length} payment intent${paymentIntents.length !== 1 ? "s" : ""}`}
          description="Your created payment intents and their status."
        />

        {paymentIntents.length === 0 ? (
          <EmptyState
            title="No payment intents yet"
            description="Create a payment intent for an order awaiting payment."
            action={
              <ButtonLink href="/buyer/orders">View Orders</ButtonLink>
            }
          />
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-border bg-surface-muted/50 px-5 py-3 sm:grid sm:grid-cols-[200px_minmax(0,1fr)_140px_140px_140px] sm:gap-4">
              <div className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Order</div>
              <div className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Provider</div>
              <div className="text-right text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Amount</div>
              <div className="text-right text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Status</div>
              <div className="text-right text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Action</div>
            </div>
            <div className="divide-y divide-border">
              {paymentIntents.map((intent) => (
                <div
                  key={intent.id}
                  className="px-5 py-4 sm:grid sm:grid-cols-[200px_minmax(0,1fr)_140px_140px_140px] sm:gap-4 sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      #{intent.order_id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {intent.provider === "MOCK" ? "Demo payment" : "Razorpay"} · {intent.currency}
                    </p>
                  </div>
                  <div className="text-xs text-muted">{intent.provider}</div>
                  <div className="text-right text-xs font-medium text-foreground">
                    {formatCurrency(intent.amount_paise / 100)}
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium",
                      intent.status === "CAPTURED" ? "bg-emerald/10 text-emerald" : "bg-surface-muted text-muted",
                    )}>
                      {intent.status}
                    </span>
                  </div>
                  <div className="text-right">
                    {intent.status === "CREATED" && intent.provider === "MOCK" ? (
                      <button
                        type="button"
                        disabled={verifyingIntentId === intent.id}
                        onClick={() => verifyPayment(intent.id, intent.provider_order_id ?? "")}
                        className="rounded-lg bg-burgundy-deep px-4 py-2 text-xs font-medium text-ivory transition-colors hover:bg-burgundy-ink disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {verifyingIntentId === intent.id ? "Verifying…" : "Verify"}
                      </button>
                    ) : (
                      <span className="text-xs text-muted">{intent.status}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Currency converter */}
      <section className="mt-12">
        <CurrencyConverter />
      </section>
    </BuyerShell>
  );
}
