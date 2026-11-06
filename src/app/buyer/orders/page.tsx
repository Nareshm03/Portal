"use client";

import { useState } from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { SectionHeading, StatusBadge } from "@/components/ui";
import { OrderTrackingModal } from "@/components/buyer/order-tracking-modal";
import {
  ORDER_STAGES,
  activeOrders,
  completedOrders,
  airportLabel,
  formatCurrency,
  formatDate,
  type BuyerOrder,
} from "@/lib/demo/buyer";
import { cn } from "@/lib/utils";

export default function BuyerOrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState<BuyerOrder | null>(null);
  return (
    <BuyerShell active="orders">
      <header>
        <p className="eyebrow">Order tracking</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Orders</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Active orders in motion with purchase receipts, arrival tracking, and
          handover coordination.
        </p>
      </header>

      {/* ── Active orders ───────────────────────────────────────────────── */}
      <section className="mt-8">
        <SectionHeading
          eyebrow="In progress"
          title={`${activeOrders.length} active orders`}
          description="Orders currently being fulfilled with proof and tracking."
        />

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {activeOrders.map((order, index) => {
            const isDark = index === 0;
            const progress =
              (order.stageIndex / (ORDER_STAGES.length - 1)) * 100;

            return (
              <article
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={cn(
                  "relative overflow-hidden rounded-2xl cursor-pointer transition-all hover:shadow-lg",
                  isDark
                    ? "bg-burgundy-deep text-ivory hover:shadow-burgundy-deep/20"
                    : "border border-border bg-surface hover:border-champagne/40",
                )}
              >
                {/* Product image */}
                <div className="relative h-40 w-full overflow-hidden">
                  <Image
                    src={order.imageUrl}
                    alt={order.productName}
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
                      isDark
                        ? "from-burgundy-deep via-burgundy-deep/30 to-transparent"
                        : "from-surface via-surface/20 to-transparent",
                    )}
                  />
                  <div className="absolute left-4 top-4">
                    <StatusBadge
                      status={order.status}
                      className={
                        isDark
                          ? "border-champagne/40 bg-champagne text-burgundy-deep"
                          : "text-champagne-ink"
                      }
                    />
                  </div>
                  <span
                    className={cn(
                      "absolute bottom-3 right-4 text-[0.5625rem] font-semibold uppercase tracking-[0.18em]",
                      isDark ? "text-ivory/50" : "text-muted-foreground",
                    )}
                  >
                    #{order.reference}
                  </span>
                </div>

                {/* Order details */}
                <div className="p-5">
                  <h3
                    className={cn(
                      "text-lg leading-snug",
                      isDark ? "text-ivory" : "text-foreground",
                    )}
                  >
                    {order.productName}
                  </h3>
                  <p
                    className={cn(
                      "mt-1 flex items-center gap-1.5 text-xs",
                      isDark ? "text-ivory/55" : "text-muted",
                    )}
                  >
                    <MapPin
                      className="size-3.5 shrink-0"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    {order.originCity} → {airportLabel(order.destinationAirport)}
                  </p>

                  {/* Progress indicator */}
                  <div className="mt-5">
                    <div
                      className={cn(
                        "relative h-1.5 rounded-full",
                        isDark ? "bg-white/15" : "bg-surface-muted",
                      )}
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-champagne-strong"
                        style={{ width: `${progress}%` }}
                      />
                      {ORDER_STAGES.map((stage, stageIndex) => (
                        <span
                          key={stage}
                          className={cn(
                            "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border",
                            stageIndex <= order.stageIndex
                              ? "border-champagne-strong bg-champagne"
                              : isDark
                                ? "border-white/25 bg-burgundy-deep"
                                : "border-border-strong bg-surface",
                          )}
                          style={{
                            left: `${(stageIndex / (ORDER_STAGES.length - 1)) * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                    <div
                      className={cn(
                        "mt-3 flex justify-between gap-2 text-[0.5625rem] uppercase tracking-[0.12em]",
                        isDark ? "text-ivory/60" : "text-muted-foreground",
                      )}
                    >
                      <span>{ORDER_STAGES[0]}</span>
                      <span>{ORDER_STAGES[order.stageIndex]}</span>
                    </div>
                  </div>

                  {/* Order info */}
                  <div className="mt-5 grid gap-2 text-xs">
                    <div className="flex items-baseline justify-between">
                      <span className={isDark ? "text-ivory/55" : "text-muted"}>
                        Traveler
                      </span>
                      <span
                        className={
                          isDark ? "text-ivory" : "font-medium text-foreground"
                        }
                      >
                        {order.travelerName}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={isDark ? "text-ivory/55" : "text-muted"}>
                        Handover date
                      </span>
                      <span
                        className={
                          isDark ? "text-ivory" : "font-medium text-foreground"
                        }
                      >
                        {formatDate(order.handoverDate)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={isDark ? "text-ivory/55" : "text-muted"}>
                        Order amount
                      </span>
                      <span
                        className={isDark ? "text-champagne" : "text-burgundy"}
                      >
                        {formatCurrency(order.amountUsd)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={isDark ? "text-ivory/55" : "text-muted"}>
                        Escrow status
                      </span>
                      <span
                        className={
                          isDark ? "text-ivory" : "font-medium text-foreground"
                        }
                      >
                        {order.escrow === "held" ? "Held" : "Released"}
                      </span>
                    </div>
                  </div>

                  {/* Order note */}
                  {order.note && (
                    <p
                      className={cn(
                        "mt-4 rounded-lg border px-3 py-2 text-xs leading-relaxed",
                        isDark
                          ? "border-white/10 bg-white/5 text-ivory/55"
                          : "border-border bg-surface-muted/60 text-muted",
                      )}
                    >
                      {order.note}
                    </p>
                  )}

                  {/* Track Order Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOrder(order);
                    }}
                    className={cn(
                      "mt-5 w-full rounded-lg px-4 py-3 text-sm font-medium transition-all hover:shadow-md",
                      isDark
                        ? "bg-champagne text-burgundy-deep hover:bg-champagne/90"
                        : "bg-burgundy-deep text-ivory hover:bg-burgundy-ink",
                    )}
                  >
                    Track Order
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-4 text-[0.6875rem] leading-relaxed text-muted-foreground">
          Demo orders with simulated tracking. No live traveler, payment or
          handover exists.
        </p>
      </section>

      {/* ── Order history ───────────────────────────────────────────────── */}
      {completedOrders.length > 0 && (
        <section className="mt-12">
          <SectionHeading
            eyebrow="Past orders"
            title="History"
            description="Previously completed orders with full delivery records."
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {completedOrders.map((order) => {
              const progress = 100; // Completed orders are at 100%

              return (
                <article
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="relative overflow-hidden rounded-2xl border border-border bg-surface cursor-pointer transition-all hover:shadow-lg hover:border-emerald/40"
                >
                  {/* Product image */}
                  <div className="relative h-32 w-full overflow-hidden">
                    <Image
                      src={order.imageUrl}
                      alt={order.productName}
                      fill
                      sizes="(min-width: 1024px) 45vw, 100vw"
                      className="object-cover opacity-90 transition-transform duration-700 hover:scale-105"
                      onError={(e) => {
                        // Fallback to a solid color background if image fails
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent"
                    />
                    <div className="absolute left-4 top-4">
                      <StatusBadge
                        status={order.status}
                        className="border-emerald/40 bg-emerald/20 text-emerald"
                      />
                    </div>
                    <span className="absolute bottom-3 right-4 text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      #{order.reference}
                    </span>
                  </div>

                  {/* Order details */}
                  <div className="p-5">
                    <h3 className="text-base font-medium leading-snug text-foreground">
                      {order.productName}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <MapPin
                        className="size-3.5 shrink-0"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      {order.originCity} → {airportLabel(order.destinationAirport)}
                    </p>

                    {/* Progress indicator */}
                    <div className="mt-4">
                      <div className="relative h-1.5 rounded-full bg-emerald/20">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-emerald"
                          style={{ width: `${progress}%` }}
                        />
                        {ORDER_STAGES.map((stage, stageIndex) => (
                          <span
                            key={stage}
                            className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald bg-emerald"
                            style={{
                              left: `${(stageIndex / (ORDER_STAGES.length - 1)) * 100}%`,
                            }}
                          />
                        ))}
                      </div>
                      <div className="mt-2 flex justify-between gap-2 text-[0.5625rem] uppercase tracking-[0.12em] text-muted-foreground">
                        <span>{ORDER_STAGES[0]}</span>
                        <span className="text-emerald">Delivered</span>
                      </div>
                    </div>

                    {/* Order info */}
                    <div className="mt-4 grid gap-2 text-xs">
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted">Traveler</span>
                        <span className="font-medium text-foreground">
                          {order.travelerName}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted">Delivered on</span>
                        <span className="font-medium text-foreground">
                          {formatDate(order.handoverDate)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted">Order amount</span>
                        <span className="text-burgundy">
                          {formatCurrency(order.amountUsd)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted">Escrow status</span>
                        <span className="font-medium text-emerald">
                          Released
                        </span>
                      </div>
                    </div>

                    {/* Order note */}
                    {order.note && (
                      <p className="mt-4 rounded-lg border border-emerald/20 bg-emerald/5 px-3 py-2 text-xs leading-relaxed text-muted">
                        {order.note}
                      </p>
                    )}

                    {/* View Details Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                      }}
                      className="mt-4 w-full rounded-lg bg-emerald/10 px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-emerald/20 hover:shadow-md"
                    >
                      View Details
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="mt-4 text-[0.6875rem] leading-relaxed text-muted-foreground">
            Completed demo orders for reference. No actual delivery or payment processing occurred.
          </p>
        </section>
      )}

      {/* ── Order lifecycle ─────────────────────────────────────────────── */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Order stages"
          title="Understanding the order lifecycle"
          description="Each order progresses through seven stages from request to delivery."
        />

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
          {ORDER_STAGES.map((stage, index) => (
            <div
              key={stage}
              className={cn(
                "flex items-center gap-4 p-5",
                index !== ORDER_STAGES.length - 1 && "border-b border-border",
              )}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-champagne/40 bg-champagne/10 font-serif text-lg text-champagne-strong">
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{stage}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Order Tracking Modal */}
      {selectedOrder && (
        <OrderTrackingModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </BuyerShell>
  );
}
