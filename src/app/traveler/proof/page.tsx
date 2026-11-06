import type { Metadata } from "next";
import Image from "next/image";
import { Camera, CheckCircle2, Upload } from "lucide-react";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { SectionHeading, StatusBadge } from "@/components/ui";
import {
  activeTravelerOrders,
  airportLabel,
  formatCurrency,
  formatDate,
  type EvidenceItem,
} from "@/lib/demo/traveler";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Purchase proof" };

function EvidenceSlot({ evidence }: { evidence: EvidenceItem }) {
  const hasFile = evidence.fileName !== null;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        hasFile
          ? "border-champagne/30 bg-champagne/5"
          : "border-border bg-surface-muted/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "text-sm font-medium",
                hasFile ? "text-foreground" : "text-muted",
              )}
            >
              {evidence.label}
              {evidence.required && (
                <span className="ml-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Required
                </span>
              )}
            </p>
            {hasFile && (
              <CheckCircle2
                className="size-4 text-champagne-strong"
                strokeWidth={2}
                aria-hidden="true"
              />
            )}
          </div>
          <p className="mt-1 text-xs text-muted">{evidence.hint}</p>
          {hasFile && (
            <p className="mt-2 truncate text-[0.6875rem] text-muted-foreground">
              {evidence.fileName}
            </p>
          )}
        </div>
        {!hasFile && (
          <Upload
            className="size-5 shrink-0 text-muted"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
      </div>
      {!hasFile && (
        <button
          type="button"
          className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
        >
          Choose file
        </button>
      )}
    </div>
  );
}

export default function TravelerProofPage() {
  return (
    <TravelerShell active="proof">
      <header>
        <p className="eyebrow">Purchase evidence</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">
          Purchase proof
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Upload receipts, product photos and authenticity evidence for your
          active orders. Photos build trust and protect the transaction.
        </p>
      </header>

      {/* ── Active orders requiring proof ───────────────────────────────── */}
      <section className="mt-8">
        <SectionHeading
          eyebrow="In progress"
          title={`${activeTravelerOrders.length} active orders`}
          description="Each order needs receipt and product photos before handover can be confirmed."
        />

        <div className="mt-6 grid gap-8">
          {activeTravelerOrders.map((order, index) => {
            const isDark = index === 0;
            const completedEvidence = order.purchase.evidence.filter(
              (e) => e.fileName !== null,
            ).length;
            const totalEvidence = order.purchase.evidence.filter(
              (e) => e.required,
            ).length;
            const isComplete =
              completedEvidence >= totalEvidence &&
              order.purchase.evidence
                .filter((e) => e.required)
                .every((e) => e.fileName !== null);

            return (
              <article
                key={order.id}
                className={cn(
                  "overflow-hidden rounded-2xl",
                  isDark
                    ? "bg-burgundy-deep text-ivory"
                    : "border border-border bg-surface",
                )}
              >
                {/* Header with product image */}
                <div className="relative h-48 w-full overflow-hidden">
                  <Image
                    src={order.imageUrl}
                    alt={order.productName}
                    fill
                    sizes="100vw"
                    className={cn(
                      "object-cover",
                      isDark ? "opacity-55" : "opacity-90",
                    )}
                  />
                  <div
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-0 bg-gradient-to-t",
                      isDark
                        ? "from-burgundy-deep via-burgundy-deep/40 to-transparent"
                        : "from-surface via-surface/30 to-transparent",
                    )}
                  />
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <StatusBadge
                      status={order.status}
                      className={
                        isDark
                          ? "border-champagne/40 bg-champagne text-burgundy-deep"
                          : "text-champagne-ink"
                      }
                    />
                    {isComplete && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.14em]",
                          isDark
                            ? "border-champagne/40 bg-champagne text-burgundy-deep"
                            : "border-champagne/40 bg-champagne/10 text-champagne-ink",
                        )}
                      >
                        <CheckCircle2
                          className="size-3"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        Complete
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h2
                      className={cn(
                        "text-xl leading-snug",
                        isDark ? "text-ivory" : "text-foreground",
                      )}
                    >
                      {order.productName}
                    </h2>
                    <p
                      className={cn(
                        "mt-1 text-xs",
                        isDark ? "text-ivory/60" : "text-muted",
                      )}
                    >
                      {order.originCity} →{" "}
                      {airportLabel(order.destinationAirport)} · #{order.reference}
                    </p>
                  </div>
                </div>

                {/* Purchase details */}
                <div className="p-6">
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-baseline justify-between">
                      <span
                        className={isDark ? "text-ivory/55" : "text-muted"}
                      >
                        Store
                      </span>
                      <span
                        className={
                          isDark ? "text-ivory" : "font-medium text-foreground"
                        }
                      >
                        {order.purchase.storeName}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span
                        className={isDark ? "text-ivory/55" : "text-muted"}
                      >
                        Purchase date
                      </span>
                      <span
                        className={
                          isDark ? "text-ivory" : "font-medium text-foreground"
                        }
                      >
                        {formatDate(order.purchase.purchaseDate)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span
                        className={isDark ? "text-ivory/55" : "text-muted"}
                      >
                        Receipt total
                      </span>
                      <span
                        className={isDark ? "text-champagne" : "text-burgundy"}
                      >
                        {formatCurrency(order.purchase.receiptTotalUsd)}
                      </span>
                    </div>
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
                  </div>

                  {/* Evidence upload slots */}
                  <div className="mt-6">
                    <div className="mb-4 flex items-center justify-between">
                      <p
                        className={cn(
                          "text-xs font-semibold uppercase tracking-[0.14em]",
                          isDark ? "text-ivory/60" : "text-muted-foreground",
                        )}
                      >
                        Purchase evidence
                      </p>
                      <span
                        className={cn(
                          "text-[0.6875rem]",
                          isDark ? "text-ivory/50" : "text-muted",
                        )}
                      >
                        {completedEvidence} of {totalEvidence} required uploaded
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {order.purchase.evidence.map((evidence) => (
                        <EvidenceSlot
                          key={evidence.slot}
                          evidence={evidence}
                        />
                      ))}
                    </div>
                  </div>

                  {order.note && (
                    <p
                      className={cn(
                        "mt-5 rounded-lg border px-3 py-2.5 text-xs leading-relaxed",
                        isDark
                          ? "border-white/10 bg-white/5 text-ivory/55"
                          : "border-border bg-surface-muted/60 text-muted",
                      )}
                    >
                      {order.note}
                    </p>
                  )}

                  <p
                    className={cn(
                      "mt-4 text-[0.625rem] uppercase tracking-[0.14em]",
                      isDark ? "text-ivory/50" : "text-muted-foreground",
                    )}
                  >
                    Last updated: {order.purchase.lastUpdatedLabel}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-champagne/20 bg-champagne/5 p-5">
          <div className="flex items-start gap-3">
            <Camera
              className="mt-0.5 size-5 shrink-0 text-champagne-strong"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                Photo guidelines
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Clear photos of the receipt, product and any serial or
                authenticity cards build trust with the buyer and protect both
                parties. The buyer can see these photos as soon as they are
                uploaded — no sensitive information should appear.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[0.6875rem] leading-relaxed text-muted-foreground">
          Demo upload interface only. No file is transmitted, stored or
          verified in this prototype.
        </p>
      </section>
    </TravelerShell>
  );
}
