"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { Camera, CheckCircle2, Upload, RefreshCw } from "lucide-react";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { SectionHeading, StatusBadge, EmptyState, LoadingState, ButtonLink } from "@/components/ui";
import { airportLabel, formatCurrency, formatDate } from "@/lib/demo/traveler";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { createProxiedApiClient, ApiError } from "@/lib/api/client";

interface BackendOrder {
  id: string;
  state: string;
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

interface BackendOrderEvidence {
  id: string;
  order_id: string;
  uploader_id: string;
  category: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface UploadSlot {
  slot: string;
  label: string;
  hint: string;
  required: boolean;
  fileName: string | null;
  status: string;
  uploadId: string | null;
}

const EVIDENCE_SLOTS: UploadSlot[] = [
  { slot: "PURCHASE_RECEIPT", label: "Purchase receipt", hint: "Store receipt or invoice", required: true, fileName: null, status: "pending", uploadId: null },
  { slot: "PRODUCT_PHOTO", label: "Product photo", hint: "Full item, front and back", required: true, fileName: null, status: "pending", uploadId: null },
  { slot: "SERIAL_EVIDENCE", label: "Serial or authenticity card", hint: "Serial number or brand card", required: true, fileName: null, status: "pending", uploadId: null },
  { slot: "ADDITIONAL_EVIDENCE", label: "Additional photo", hint: "Condition, packaging or detail", required: false, fileName: null, status: "pending", uploadId: null },
  { slot: "ARRIVAL_PROOF", label: "Arrival proof", hint: "Photo at destination airport", required: false, fileName: null, status: "pending", uploadId: null },
  { slot: "HANDOVER_EVIDENCE", label: "Handover photo", hint: "Photo at handover location", required: false, fileName: null, status: "pending", uploadId: null },
];

export default function TravelerProofPage() {
  const [orders, setOrders] = useState<BackendOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<BackendOrderEvidence[]>([]);
  const [uploading, setUploading] = useState<{ [orderId: string]: { [uploadId: string]: boolean } }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) {
        setDemoMode(true);
        setIsLoading(false);
        return;
      }
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setDemoMode(true);
        setIsLoading(false);
        return;
      }
      const api = createProxiedApiClient();
      const result = await api.request("/orders/assigned", { token });
      if (result.demo) {
        setDemoMode(true);
        setIsLoading(false);
        return;
      }
      const data = result.body as { data: BackendOrder[] } | null;
      setOrders(data?.data ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.demo) {
        setDemoMode(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load orders.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchEvidence = useCallback(async (orderId: string) => {
    try {
      if (!supabase) return;
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;
      const api = createProxiedApiClient();
      const result = await api.request(`/orders/${orderId}/uploads`, { token });
      if (result.demo) return;
      const data = result.body as { data: BackendOrderEvidence[] } | null;
      setEvidence((prev) => {
        const existing = prev.filter((e) => e.order_id !== orderId);
        return [...existing, ...(data?.data ?? [])];
      });
    } catch {
      // Evidence fetch failures are non-fatal
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, []);

  const setIsLoading = (val: boolean) => {
    setLoading(val);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setEvidence([]);
    setRefreshing(false);
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const orderEvidence = evidence.filter((e) => e.order_id === selectedOrderId);

  const getSlotsForOrder = (order: BackendOrder): UploadSlot[] => {
    const existing = orderEvidence.map((e) => e.category);
    return EVIDENCE_SLOTS.map((slot) => ({
      ...slot,
      fileName: existing.includes(slot.slot) ? (orderEvidence.find((e) => e.category === slot.slot)?.original_filename ?? null) : null,
      status: existing.includes(slot.slot) ? "uploaded" : "pending",
      uploadId: existing.includes(slot.slot) ? (orderEvidence.find((e) => e.category === slot.slot)?.id ?? null) : null,
    }));
  };

  const handleUpload = async (orderId: string, slot: string, file: File) => {
    setUploading((prev) => ({ ...prev, [orderId]: { ...prev[orderId], [slot]: true } }));
    try {
      if (!supabase) throw new Error("Supabase not configured.");
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("Not authenticated.");
      const api = createProxiedApiClient();

      // Step 1: Get signed upload URL
      const signResult = await api.request(`/orders/${orderId}/uploads/sign`, {
        token,
        body: JSON.stringify({
          category: slot,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      if (signResult.demo) throw new Error("Demo mode");
      const signData = signResult.body as {
        data: { uploadUrl: string; token: string; uploadId: string; expiresIn: number };
      };

      // Step 2: Upload file directly to Supabase Storage
      const uploadRes = await fetch(signData.data.uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${signData.data.token}`,
          "Content-Type": file.type,
          "x-upsert": "false",
        },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Upload to storage failed.");

      // Step 3: Mark upload as complete
      await api.request(`/orders/${orderId}/uploads/complete`, {
        token,
        body: JSON.stringify({ uploadId: signData.data.uploadId }),
      });

      // Refresh evidence list
      await fetchEvidence(orderId);
    } catch (err) {
      if (err instanceof ApiError && err.demo) {
        setDemoMode(true);
      } else {
        throw err;
      }
    } finally {
      setUploading((prev) => ({ ...prev, [orderId]: { ...prev[orderId], [slot]: false } }));
    }
  };

  const handleDownload = async (uploadId: string, orderId: string, filename: string) => {
    try {
      if (!supabase) throw new Error("Supabase not configured.");
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("Not authenticated.");
      const api = createProxiedApiClient();
      const result = await api.request(`/orders/${orderId}/uploads/${uploadId}/download-url`, { token });
      if (result.demo) throw new Error("Demo mode");
      const data = result.body as { data: { downloadUrl: string } };
      window.open(data.data.downloadUrl, "_blank");
    } catch (err) {
      if (!(err instanceof ApiError && err.demo)) {
        setError(err instanceof Error ? err.message : "Download failed.");
      }
    }
  };

  const activeOrders = orders.filter(
    (o) => o.state !== "COMPLETED" && o.state !== "FORFEITED" && o.state !== "EXPIRED" && o.state !== "DISPUTED" && o.state !== "CANCELLED",
  );
  const completedOrders = orders.filter((o) => o.state === "COMPLETED");

  if (loading) {
    return (
      <TravelerShell active="proof">
        <LoadingState />
      </TravelerShell>
    );
  }

  const displayOrders = demoMode || orders.length === 0
    ? [
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
        {
          id: "ord-3094",
          state: "PURCHASED",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          request: {
            product_title: "On Running Cloudmonster 2",
            origin_country: "Netherlands",
            origin_airport_code: "AMS",
            destination_country: "India",
            destination_airport_code: "BOM",
          },
        },
      ]
    : orders;

  const activeDisplayOrders = displayOrders.filter(
    (o) => o.state !== "COMPLETED" && o.state !== "FORFEITED" && o.state !== "EXPIRED" && o.state !== "DISPUTED" && o.state !== "CANCELLED",
  );
  const completedDisplayOrders = displayOrders.filter((o) => o.state === "COMPLETED");

  if (error && !demoMode) {
    return (
      <TravelerShell active="proof">
        <EmptyState title="Unable to load orders" description={error} />
      </TravelerShell>
    );
  }

  if (displayOrders.length === 0) {
    return (
      <TravelerShell active="proof">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">Purchase evidence</p>
            <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Purchase proof</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Upload receipts, product photos and authenticity evidence for your active orders.
            </p>
          </div>
        </header>
        <EmptyState
          title="No orders yet"
          description="Accept a buyer quote to get your first assigned order."
          action={<ButtonLink href="/traveler/quotes">View Quotes</ButtonLink>}
        />
      </TravelerShell>
    );
  }

  return (
    <TravelerShell active="proof">
      {demoMode && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-champagne-strong/20 bg-champagne/10 px-3 py-2 text-[0.6875rem] leading-relaxed text-champagne-ink">
          <span className="mt-0.5 size-3.5 shrink-0 text-champagne-strong" aria-hidden="true">●</span>
          Demo mode — backend orders unavailable. Sample orders shown.
        </div>
      )}

      {error && demoMode && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Purchase evidence</p>
          <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Purchase proof</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Upload receipts, product photos and authenticity evidence for your active orders.
            Photos build trust and protect the transaction.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
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
          eyebrow="Purchase evidence"
          title={`${activeDisplayOrders.length} order${activeDisplayOrders.length !== 1 ? "s" : ""} awaiting proof`}
          description="Upload receipts, product photos and authenticity evidence before handover."
        />

        <div className="mt-6 grid gap-8">
          {activeDisplayOrders.map((order) => {
            const slots = getSlotsForOrder(order);
            const requiredSlots = slots.filter((s) => s.required);
            const completedRequired = requiredSlots.filter((s) => s.status === "uploaded").length;

            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <div className="relative h-48 w-full overflow-hidden bg-surface-muted">
                  <Image
                    src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80"
                    alt={order.request?.product_title ?? "Order product"}
                    fill
                    sizes="100vw"
                    className="object-cover opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
                  <div className="absolute left-4 top-4">
                    <StatusBadge status={order.state.toLowerCase() as any} />
                  </div>
                  <span className="absolute bottom-4 left-4 right-4">
                    <h2 className="text-xl leading-snug">{order.request?.product_title ?? "Order"}</h2>
                    <p className="mt-1 text-xs text-muted">
                      {order.request?.origin_country} → {airportLabel(order.request?.destination_airport_code as any)} · #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                  </span>
                </div>

                <div className="p-6">
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted">Store</span>
                      <span className="font-medium text-foreground">
                        {order.request?.product_title?.split(" ")[0] ?? "Store"}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted">Product</span>
                      <span className="font-medium text-foreground">{order.request?.product_title ?? "Product"}</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Purchase evidence
                      </p>
                      <span className="text-[0.6875rem] text-muted">
                        {completedRequired} of {requiredSlots.length} required uploaded
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {slots.map((slot) => {
                        const isUploading = uploading[order.id]?.[slot.slot];
                        return (
                          <div key={slot.slot} className="rounded-lg border p-4 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-foreground">{slot.label}</p>
                                  {slot.required && (
                                    <span className="ml-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                      Required
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-muted">{slot.hint}</p>
                                {slot.fileName && (
                                  <p className="mt-2 truncate text-[0.6875rem] text-muted-foreground">
                                    {slot.fileName}
                                  </p>
                                )}
                              </div>
                              {!slot.fileName && (
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={isUploading}
                                  className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Choose file
                                </button>
                              )}
                              {slot.fileName && slot.uploadId && (
                                <div className="mt-3 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const uploadId = slot.uploadId;
                                      if (uploadId) handleDownload(uploadId, order.id, slot.fileName);
                                    }}
                                    className="rounded-md text-xs font-medium text-champagne-strong transition-colors hover:text-champagne/90"
                                  >
                                    Download
                                  </button>
                                </div>
                              )}
                            </div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept={".jpg,.jpeg,.png,.pdf"}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUpload(order.id, slot.slot, f);
                              }}
                              className="hidden"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-4 text-[0.6875rem] leading-relaxed text-muted-foreground">
          {demoMode ? "Demo upload interface only." : "Evidence uploaded to private Supabase Storage."}
        </p>
      </section>
    </TravelerShell>
  );
}
