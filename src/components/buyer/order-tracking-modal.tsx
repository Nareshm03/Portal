"use client";

import { X, MapPin, Package, CheckCircle2, Circle, Clock } from "lucide-react";
import Image from "next/image";
import type { BuyerOrder } from "@/lib/demo/buyer";
import { ORDER_STAGES, airportLabel, formatDate, formatCurrency } from "@/lib/demo/buyer";
import { cn } from "@/lib/utils";

interface OrderTrackingModalProps {
  order: BuyerOrder;
  onClose: () => void;
}

export function OrderTrackingModal({ order, onClose }: OrderTrackingModalProps) {
  const progress = (order.stageIndex / (ORDER_STAGES.length - 1)) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-champagne-ink">
                Order Tracking
              </p>
              <h2 className="mt-1 text-2xl font-medium text-foreground">
                {order.reference}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              aria-label="Close tracking"
            >
              <X className="size-6" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Product Section */}
        <div className="border-b border-border bg-surface-muted/30 p-6">
          <div className="flex gap-6">
            <div className="relative size-32 shrink-0 overflow-hidden rounded-2xl border border-border">
              <Image
                src={order.imageUrl}
                alt={order.productName}
                fill
                sizes="128px"
                className="object-cover"
              />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-medium text-foreground">
                {order.productName}
              </h3>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted">
                  <MapPin className="size-4 shrink-0" strokeWidth={1.75} />
                  <span>
                    {order.originCity}, {order.originCountry} →{" "}
                    {airportLabel(order.destinationAirport)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <Package className="size-4 shrink-0" strokeWidth={1.75} />
                  <span>Traveler: {order.travelerName}</span>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <Clock className="size-4 shrink-0" strokeWidth={1.75} />
                  <span>Expected handover: {formatDate(order.handoverDate)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="border-b border-border bg-background p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Order Amount
              </p>
              <p className="mt-1 text-lg font-semibold text-burgundy">
                {formatCurrency(order.amountUsd)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Escrow Status
              </p>
              <p className="mt-1 text-lg font-medium text-foreground">
                {order.escrow === "held" ? "Held" : "Released"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Current Status
              </p>
              <p className="mt-1 text-lg font-medium capitalize text-foreground">
                {order.status.replace("-", " ")}
              </p>
            </div>
          </div>
        </div>

        {/* Visual Tracking Journey */}
        <div className="p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Order Journey
          </h3>

          {/* Progress Bar */}
          <div className="mt-6 mb-8">
            <div className="relative h-2 rounded-full bg-surface-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-champagne-strong transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
              {ORDER_STAGES.map((stage, stageIndex) => {
                const isCompleted = stageIndex <= order.stageIndex;
                const isCurrent = stageIndex === order.stageIndex;

                return (
                  <div
                    key={stage}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${(stageIndex / (ORDER_STAGES.length - 1)) * 100}%`,
                    }}
                  >
                    {isCompleted ? (
                      <CheckCircle2
                        className={cn(
                          "size-6 transition-colors",
                          isCurrent
                            ? "fill-champagne text-champagne-strong drop-shadow-md"
                            : "fill-champagne-strong/30 text-champagne-strong"
                        )}
                        strokeWidth={2}
                      />
                    ) : (
                      <Circle
                        className="size-6 fill-surface text-border-strong"
                        strokeWidth={2}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stage List */}
          <div className="space-y-4">
            {ORDER_STAGES.map((stage, stageIndex) => {
              const isCompleted = stageIndex < order.stageIndex;
              const isCurrent = stageIndex === order.stageIndex;
              const isUpcoming = stageIndex > order.stageIndex;

              return (
                <div
                  key={stage}
                  className={cn(
                    "flex gap-4 rounded-2xl border p-4 transition-all",
                    isCurrent &&
                      "border-champagne/40 bg-champagne/5 shadow-sm",
                    isCompleted && "border-border bg-surface",
                    isUpcoming && "border-border/50 bg-surface-muted/30 opacity-60"
                  )}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full border">
                    {isCompleted ? (
                      <CheckCircle2
                        className="size-5 text-champagne-strong"
                        strokeWidth={2}
                      />
                    ) : isCurrent ? (
                      <div className="size-3 rounded-full bg-champagne-strong" />
                    ) : (
                      <Circle
                        className="size-5 text-muted-foreground"
                        strokeWidth={2}
                      />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4
                          className={cn(
                            "font-medium",
                            isCurrent ? "text-foreground" : "text-muted"
                          )}
                        >
                          {stage}
                        </h4>
                        <p
                          className={cn(
                            "mt-1 text-xs leading-relaxed",
                            isCurrent ? "text-muted" : "text-muted-foreground"
                          )}
                        >
                          {getStageDescription(stage, order)}
                        </p>
                      </div>
                      {isCurrent && (
                        <span className="shrink-0 rounded-full bg-champagne px-3 py-1 text-xs font-semibold text-burgundy-deep">
                          Current
                        </span>
                      )}
                      {isCompleted && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Note */}
        {order.note && (
          <div className="border-t border-border bg-surface-muted/30 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Tracking Note
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {order.note}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border bg-background p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Demo order tracking · no live shipment or payment exists
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-burgundy-deep px-6 py-2.5 text-sm font-medium text-ivory transition-colors hover:bg-burgundy-ink"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStageDescription(stage: string, order: BuyerOrder): string {
  switch (stage) {
    case "Requested":
      return "Product request submitted and awaiting traveler matches.";
    case "Traveler matched":
      return `Matched with ${order.travelerName} for this route.`;
    case "Quote accepted":
      return "Quote reviewed and accepted. Payment pending.";
    case "Payment secured":
      return `${formatCurrency(order.amountUsd)} secured in escrow. Traveler can proceed with purchase.`;
    case "In transit":
      return `${order.travelerName} has purchased the item and is en route to ${airportLabel(order.destinationAirport)}.`;
    case "Customs":
      return "Item has arrived and is undergoing customs assessment in Mumbai.";
    case "Delivered":
      return `Handover completed. Order delivered on ${formatDate(order.handoverDate)}.`;
    default:
      return "";
  }
}
