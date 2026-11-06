import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle2, MapPin, Plane, QrCode } from "lucide-react";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { Badge, SectionHeading, StatusBadge } from "@/components/ui";
import {
  activeTravelerOrders,
  airportLabel,
  formatCurrency,
  formatDate,
} from "@/lib/demo/traveler";

export const metadata: Metadata = { title: "Arrival & handover" };

export default function TravelerHandoverPage() {
  return (
    <TravelerShell active="handover">
      <header>
        <p className="eyebrow">Delivery management</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">
          Arrival & handover
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Mark your arrival in India, prepare orders for buyer handover, and
          complete deliveries with one-time codes.
        </p>
      </header>

      <section className="mt-8">
        <SectionHeading
          eyebrow="Active deliveries"
          title={`${activeTravelerOrders.length} orders for handover`}
          description="Demo handover flow with simulated OTP verification."
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {activeTravelerOrders.map((order) => (
            <article
              key={order.id}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              {/* Order header with image */}
              <div className="relative h-32 w-full overflow-hidden bg-surface-muted">
                <Image
                  src={order.imageUrl}
                  alt={order.productName}
                  fill
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  className="object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
                <div className="absolute left-4 top-4">
                  <StatusBadge status={order.status} />
                </div>
                <span className="absolute bottom-3 right-4 text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  #{order.reference}
                </span>
              </div>

              <div className="p-5">
                <h3 className="text-lg leading-snug">{order.productName}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <MapPin
                    className="size-3.5 shrink-0 text-champagne-strong"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {order.originCity} → {airportLabel(order.destinationAirport)}
                </p>

                {/* Flight info */}
                <div className="mt-4 rounded-lg border border-border bg-surface-muted/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        <Plane
                          className="size-3.5"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        Flight details
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {order.arrival.airline} {order.arrival.flightNumber}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {order.arrival.scheduledAtLabel}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {order.arrival.terminal}
                      </p>
                    </div>

                    {order.arrival.arrivalMarked && (
                      <Badge variant="emerald" className="shrink-0">
                        Arrived
                      </Badge>
                    )}
                  </div>

                  {order.arrival.trackingNote && (
                    <p className="mt-3 rounded-md bg-background px-3 py-2 text-xs leading-relaxed text-muted">
                      {order.arrival.trackingNote}
                    </p>
                  )}

                  {!order.arrival.arrivalMarked && (
                    <button
                      type="button"
                      className="mt-3 w-full rounded-md bg-burgundy px-4 py-2 text-sm font-semibold text-ivory transition-colors hover:bg-burgundy-deep"
                    >
                      Mark arrival in Mumbai
                    </button>
                  )}
                </div>

                {/* Handover details */}
                <div className="mt-4 rounded-lg border border-border bg-surface-muted/60 p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <QrCode
                      className="size-3.5"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    Handover details
                  </p>

                  <div className="mt-3 grid gap-2 text-xs">
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted">Buyer</span>
                      <span className="font-medium text-foreground">
                        {order.buyerName}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted">Handover date</span>
                      <span className="font-medium text-foreground">
                        {formatDate(order.handoverDate)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted">Location</span>
                      <span className="font-medium text-foreground">
                        {order.handover.location}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted">Your carrying fee</span>
                      <span className="font-medium text-burgundy">
                        {formatCurrency(order.demoCarryingFeeUsd)}
                      </span>
                    </div>
                  </div>

                  {/* OTP section */}
                  {order.arrival.arrivalMarked && !order.handover.completed && (
                    <div className="mt-4 rounded-md border border-champagne-strong/40 bg-champagne/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-champagne-ink">
                        Demo buyer OTP
                      </p>
                      <p className="mt-2 font-mono text-2xl font-bold tracking-wider text-burgundy">
                        {order.handover.demoOtp}
                      </p>
                      <p className="mt-2 text-[0.625rem] leading-relaxed text-muted">
                        Ask the buyer for their OTP to confirm handover. Demo
                        only — no real verification occurs.
                      </p>

                      <div className="mt-3">
                        <label
                          htmlFor={`otp-${order.id}`}
                          className="block text-xs font-medium text-foreground"
                        >
                          Enter buyer OTP
                        </label>
                        <div className="mt-1.5 flex gap-2">
                          <input
                            type="text"
                            id={`otp-${order.id}`}
                            placeholder="000000"
                            maxLength={6}
                            className="block flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground shadow-sm transition-colors focus:border-champagne-strong focus:outline-none focus:ring-1 focus:ring-champagne-strong"
                          />
                          <button
                            type="button"
                            className="rounded-md bg-burgundy px-4 py-2 text-sm font-semibold text-ivory transition-colors hover:bg-burgundy-deep"
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Completed */}
                  {order.handover.completed && (
                    <div className="mt-4 flex items-start gap-3 rounded-md border border-emerald/40 bg-emerald/10 p-3">
                      <CheckCircle2
                        className="mt-0.5 size-5 shrink-0 text-emerald"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1 text-xs leading-relaxed">
                        <p className="font-semibold text-foreground">
                          Handover completed
                        </p>
                        <p className="mt-1 text-muted">
                          Delivered on {formatDate(order.handover.completedOn!)} ·
                          Carrying fee recorded
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Prepare button */}
                  {order.arrival.arrivalMarked &&
                    !order.handover.prepared &&
                    !order.handover.completed && (
                      <button
                        type="button"
                        className="mt-3 w-full rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                      >
                        Mark prepared for handover
                      </button>
                    )}
                </div>

                {/* Note */}
                {order.note && (
                  <p className="mt-4 rounded-lg border border-border bg-surface-muted/60 px-3 py-2 text-xs leading-relaxed text-muted">
                    {order.note}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>

        <p className="mt-6 text-[0.6875rem] leading-relaxed text-muted-foreground">
          Demo handover flow with simulated OTP verification. No live buyer
          coordination, location tracking or payment release is connected.
        </p>
      </section>
    </TravelerShell>
  );
}
