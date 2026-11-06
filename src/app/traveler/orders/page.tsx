"use client";

import { useState } from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { SectionHeading, StatusBadge } from "@/components/ui";
import { TravelerOrderModal } from "@/components/traveler/traveler-order-modal";
import {
  activeTravelerOrders,
  airportLabel,
  formatCurrency,
  formatDate,
  ORDER_STAGES,
  travelerOrders,
  type TravelerOrder,
} from "@/lib/demo/traveler";
import { cn } from "@/lib/utils";

export default function TravelerOrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState<TravelerOrder | null>(null);
  
  const completedOrders = travelerOrders.filter(
    (order) => order.status === "delivered",
  );

  return (
    <TravelerShell active="orders">
      <header>
        <p className="eyebrow">Order management</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">
          Active orders
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Orders in your care, with purchase proof, arrival tracking and
          handover preparation.
        </p>
      </header>

      {/* ── Active orders ───────────────────────────────────────────────── */}
      <section className="mt-8">
        <SectionHeading
          eyebrow="In progress"
          title={`${activeTravelerOrders.length} active orders`}
          description="Orders currently being fulfilled with receipt evidence and tracking."
        />

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {activeTravelerOrders.map((order, index) => {
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
                    {order.originCity} →{" "}
                    {airportLabel(order.destinationAirport)}
                  </p>

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

                  <div className="mt-5 grid gap-2 text-xs">
                    <div className="flex items-baseline justify-between">
                      <span
                        className={isDark ? "text-ivory/55" : "text-muted"}
                      >
                        Buyer
                      </span>
                      <span
                        className={
                          isDark ? "text-ivory" : "font-medium text-foreground"
                        }
                      >
                        {order.buyerName}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span
                        className={isDark ? "text-ivory/55" : "text-muted"}
                      >
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
                      <span
                        className={isDark ? "text-ivory/55" : "text-muted"}
                      >
                        Your carrying fee
                      </span>
                      <span
                        className={isDark ? "text-champagne" : "text-burgundy"}
                      >
                        {formatCurrency(order.demoCarryingFeeUsd)}
                      </span>
                    </div>
                  </div>

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
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-4 text-[0.6875rem] leading-relaxed text-muted-foreground">
          Demo orders with simulated tracking. No live buyer, payment or
          handover.
        </p>
      </section>

      {/* ── Completed orders ────────────────────────────────────────────── */}
      {completedOrders.length > 0 && (
        <section className="mt-14">
          <SectionHeading
            eyebrow="History"
            title={`${completedOrders.length} completed order`}
            description="Successfully delivered orders with demo earnings recorded."
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {completedOrders.map((order) => (
              <article
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="overflow-hidden rounded-2xl border border-border bg-surface cursor-pointer transition-all hover:shadow-lg hover:border-emerald/40"
              >
                <div className="relative h-32 w-full overflow-hidden">
                  <Image
                    src={order.imageUrl}
                    alt={order.productName}
                    fill
                    sizes="(min-width: 1024px) 45vw, 100vw"
                    className="object-cover opacity-70"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
                  <span className="absolute bottom-3 right-4 text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    #{order.reference}
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base text-muted">
                      {order.productName}
                    </h3>
                    <StatusBadge status={order.status} label="Delivered" />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {order.originCity} → {airportLabel(order.destinationAirport)}
                  </p>

                  <div className="mt-3 grid gap-2 text-xs">
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted">Buyer</span>
                      <span className="text-muted">{order.buyerName}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted">Delivered</span>
                      <span className="text-muted">
                        {formatDate(order.handoverDate)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted">Carrying fee</span>
                      <span className="font-medium text-burgundy">
                        {formatCurrency(order.demoCarryingFeeUsd)}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Order Tracking Modal */}
      {selectedOrder && (
        <TravelerOrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </TravelerShell>
  );
}
