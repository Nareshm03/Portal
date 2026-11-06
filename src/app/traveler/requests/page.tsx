import type { Metadata } from "next";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { SectionHeading, StatusBadge } from "@/components/ui";
import {
  airportLabel,
  availableRequests,
  formatCurrency,
  formatDate,
} from "@/lib/demo/traveler";

export const metadata: Metadata = { title: "Available requests" };

export default function TravelerRequestsPage() {
  return (
    <TravelerShell active="requests">
      <header>
        <p className="eyebrow">Buyer requests</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">
          Available requests
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Buyer requests that match your registered routes and travel dates.
          Submit a quote with your carrying fee and estimated fulfilment date.
        </p>
      </header>

      <section className="mt-8">
        <SectionHeading
          eyebrow="Matching your routes"
          title={`${availableRequests.length} buyer requests`}
          description="Demo requests for illustration only. No live buyer contact or matching."
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {availableRequests.map((request) => (
            <article
              key={request.id}
              className="group overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-champagne-strong/60 hover:shadow-md"
            >
              <div className="relative h-48 w-full overflow-hidden bg-surface-muted">
                <Image
                  src={request.imageUrl}
                  alt={request.productName}
                  fill
                  sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span className="absolute left-3 top-3 rounded-full bg-burgundy-deep/80 px-2 py-0.5 text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-champagne">
                  Demo
                </span>
              </div>

              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={request.status} />
                  <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {request.reference}
                  </span>
                </div>

                <h3 className="mt-3 text-lg leading-snug">
                  {request.productName}
                </h3>

                <p className="mt-2 text-sm text-muted">{request.description}</p>

                <div className="mt-3 space-y-1 text-xs text-muted">
                  <p className="flex items-center gap-1.5">
                    <MapPin
                      className="size-3.5 shrink-0 text-champagne-strong"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    {request.originCity}, {request.originCountry} →{" "}
                    {airportLabel(request.destinationAirport)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">
                      {request.brand}
                    </span>{" "}
                    · {request.variant}
                  </p>
                  <p>
                    Needed by{" "}
                    <strong className="font-medium text-foreground">
                      {formatDate(request.requiredBy)}
                    </strong>
                  </p>
                  {request.budgetUsd && (
                    <p>
                      Budget:{" "}
                      <strong className="font-medium text-foreground">
                        {formatCurrency(request.budgetUsd)}
                      </strong>
                    </p>
                  )}
                  <p>Weight: ~{request.luggageEstimateKg} kg</p>
                  <p className="pt-1 text-muted-foreground">
                    Posted {request.postedLabel} by {request.buyerFirstName}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-6 text-[0.6875rem] leading-relaxed text-muted-foreground">
          Demo requests for illustration only. No live matching, buyer contact
          or quote submission is connected.
        </p>
      </section>
    </TravelerShell>
  );
}
