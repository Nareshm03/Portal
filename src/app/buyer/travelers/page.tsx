import type { Metadata } from "next";
import { Plane, Star } from "lucide-react";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { Badge, SectionHeading } from "@/components/ui";
import { getInitials, matchedTravelers } from "@/lib/demo/buyer";

export const metadata: Metadata = { title: "Matched travelers" };

export default function BuyerTravelersPage() {
  return (
    <BuyerShell active="travelers">
      <header>
        <p className="eyebrow">Traveler matching</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">
          Matched travelers
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Verified travelers whose routes, dates and luggage space match your
          active product requests.
        </p>
      </header>

      {/* ── Summary ─────────────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="rounded-2xl border border-champagne/20 bg-champagne/5 p-6">
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-champagne/40 bg-champagne/15">
              <Plane
                className="size-6 text-champagne-strong"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-medium text-foreground">
                About traveler matching
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Travelers are matched to your requests based on their registered
                routes, travel dates, and available luggage space. Each match
                shows their verification status, rating, and carry history.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Matched travelers list ─────────────────────────────────────── */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Current matches"
          title={`${matchedTravelers.length} travelers match your requests`}
          description="Demo profiles matched by route, date and luggage space."
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matchedTravelers.map((traveler) => (
            <article
              key={traveler.id}
              className="group rounded-2xl border border-border bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-champagne-strong/60 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-burgundy text-sm font-semibold text-ivory">
                    {getInitials(traveler.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {traveler.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                      <Star
                        className="size-3 fill-champagne-strong text-champagne-strong"
                        aria-hidden="true"
                      />
                      {traveler.rating} · {traveler.carries} demo carries
                    </p>
                  </div>
                </div>
                {traveler.verified && (
                  <Badge variant="emerald" dot>
                    Verified
                  </Badge>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-md border border-border bg-surface-muted/60 px-2 py-1 font-mono text-xs text-foreground">
                  {traveler.fromCode}
                </span>
                <Plane
                  className="size-4 text-champagne-strong"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="rounded-md border border-border bg-surface-muted/60 px-2 py-1 font-mono text-xs text-foreground">
                  {traveler.toCode}
                </span>
                <span className="ml-auto text-xs text-muted">
                  {traveler.travelWindow}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs text-muted">
                <p>
                  <span className="font-medium text-foreground">Route:</span>{" "}
                  {traveler.fromCity} → {traveler.toCity}
                </p>
                <p>
                  <span className="font-medium text-foreground">
                    Luggage space:
                  </span>{" "}
                  {traveler.luggageSpaceKg} kg available
                </p>
                <p className="rounded-lg border border-champagne/20 bg-champagne/5 px-2 py-1.5 text-champagne-ink">
                  <span className="font-medium">Matched for:</span>{" "}
                  {traveler.matchedRequest}
                </p>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-6 text-[0.6875rem] leading-relaxed text-muted-foreground">
          Sample matches for demonstration only. No traveler has been contacted
          and no carry agreement exists.
        </p>
      </section>

      {/* ── How matching works ──────────────────────────────────────────── */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Matching process"
          title="How we find the right travelers"
          description="The matching system considers multiple factors to connect you with suitable travelers."
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Route compatibility
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Travelers are matched when their departure city and destination
              airport align with your product request origin and delivery
              location.
            </p>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Travel timing
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Matched travelers have upcoming flights that allow them to
              purchase and deliver within your required-by date window.
            </p>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Luggage capacity
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Each match has sufficient available luggage space for your product
              based on weight and size estimates.
            </p>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Verification status
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              All matched travelers have completed demo passport KYC verification
              and maintain positive ratings from previous carries.
            </p>
          </article>
        </div>
      </section>
    </BuyerShell>
  );
}
