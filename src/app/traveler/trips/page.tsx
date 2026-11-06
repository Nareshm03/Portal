import type { Metadata } from "next";
import { ArrowRight, CalendarDays, Plane, Plus } from "lucide-react";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { Badge, ButtonLink, SectionHeading, EmptyState, LoadingState } from "@/components/ui";
import { formatDate } from "@/lib/demo/traveler";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createProxiedApiClient } from "@/lib/api/client";
import { requireTravellerSession } from "@/lib/auth/traveler";
import { cn } from "@/lib/utils";

interface BackendTrip {
  id: string;
  traveller_id: string;
  origin_country: string;
  origin_airport_code: string;
  destination_country: string;
  destination_airport_code: string;
  departure_at: string;
  arrival_at: string;
  capacity_kg: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export const metadata: Metadata = { title: "My trips" };

export default async function TravelerTripsPage() {
  const supabase = createServerClient();
  await requireTravellerSession(supabase);

  let trips: BackendTrip[] = [];
  let tripsError: string | null = null;
  let isLoading = true;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? null;
    const api = createProxiedApiClient();
    const data = (await api.GET("/trips/mine", { token })) as BackendTrip[];
    trips = Array.isArray(data) ? data : [];
  } catch (err) {
    tripsError = err instanceof Error ? err.message : "Failed to load trips.";
  } finally {
    isLoading = false;
  }

  if (isLoading) {
    return (
      <TravelerShell active="trips">
        <LoadingState />
      </TravelerShell>
    );
  }

  const upcomingTrips = trips.filter((t) => t.status === "DRAFT" || t.status === "ACTIVE");
  const completedTrips = trips.filter((t) => t.status === "COMPLETED" || t.status === "CANCELLED");

  if (trips.length === 0 && !tripsError) {
    return (
      <TravelerShell active="trips">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">Trip management</p>
            <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">My trips</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Your registered flights to India, with luggage capacity and matched buyer requests.
            </p>
          </div>
          <ButtonLink
            href="/traveler/trips/new"
            leadingIcon={<Plus className="size-4" strokeWidth={2} aria-hidden="true" />}
          >
            Register a trip
          </ButtonLink>
        </header>
        <EmptyState
          title="No trips yet"
          description="Register your first trip to start receiving buyer requests that match your route."
          action={
            <ButtonLink href="/traveler/trips/new">Register a trip</ButtonLink>
          }
        />
      </TravelerShell>
    );
  }

  return (
    <TravelerShell active="trips">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Trip management</p>
          <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">My trips</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Your registered flights to India, with luggage capacity and matched buyer requests.
          </p>
        </div>
        <ButtonLink
          href="/traveler/trips/new"
          leadingIcon={<Plus className="size-4" strokeWidth={2} aria-hidden="true" />}
        >
          Register a trip
        </ButtonLink>
      </header>

      {tripsError && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {tripsError}
        </div>
      )}

      {/* ── Upcoming trips ──────────────────────────────────────────────── */}
      <section className="mt-8">
        <SectionHeading
          eyebrow="Upcoming"
          title={`${upcomingTrips.length} registered trips`}
          description="Flights to India with available luggage space for buyer requests."
        />

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
          {upcomingTrips.map((trip, index) => {
            const originCode = trip.origin_airport_code;
            const destCode = trip.destination_airport_code;

            return (
              <article
                key={trip.id}
                className={cn(
                  "group grid gap-5 p-5 transition-colors hover:bg-surface-muted/30 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center",
                  index !== upcomingTrips.length - 1 && "border-b border-border",
                )}
              >
                <div className="flex items-center gap-4">
                  <span className="grid size-12 place-items-center rounded-full border border-champagne-strong/40 bg-champagne/10">
                    <Plane className="size-5 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-border bg-surface-muted/60 px-2 py-1 font-mono text-xs font-medium text-foreground">
                        {originCode}
                      </span>
                      <ArrowRight className="size-4 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
                      <span className="rounded-md border border-border bg-surface-muted/60 px-2 py-1 font-mono text-xs font-medium text-foreground">
                        {destCode}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      {trip.origin_country} → {trip.destination_country}
                    </p>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="sapphire">{trip.id.slice(0, 8).toUpperCase()}</Badge>
                    <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {trip.status}
                    </span>
                  </div>

                  <h3 className="mt-2 text-lg">{trip.origin_country} → {trip.destination_country}</h3>

                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                    <span>
                      <strong className="font-medium text-foreground">{formatDate(trip.departure_at)}</strong> departure
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5 text-champagne-strong" strokeWidth={1.75} aria-hidden="true" />
                      Arrival {formatDate(trip.arrival_at)}
                    </span>
                    <span>{trip.capacity_kg} kg available</span>
                  </div>
                </div>

                <div className="sm:text-right">
                  <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Luggage space
                  </p>
                  <p className="mt-1 font-serif text-2xl text-burgundy">
                    {trip.capacity_kg}{" "}
                    <span className="font-sans text-xs tracking-normal text-muted">kg</span>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-3 text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
          Trips loaded from the backend.
        </p>
      </section>

      {/* ── Completed trips ─────────────────────────────────────────────── */}
      {completedTrips.length > 0 && (
        <section className="mt-14">
          <SectionHeading
            eyebrow="History"
            title={`${completedTrips.length} completed trip`}
            description="Past trips with delivered orders."
          />
          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
            {completedTrips.map((trip, index) => (
              <article
                key={trip.id}
                className={cn(
                  "group grid gap-5 p-5 transition-colors hover:bg-surface-muted/30 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center",
                  index !== completedTrips.length - 1 && "border-b border-border",
                )}
              >
                <div className="flex items-center gap-4">
                  <span className="grid size-12 place-items-center rounded-full border border-border bg-surface-muted/60">
                    <Plane className="size-5 text-muted" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-border bg-surface-muted/60 px-2 py-1 font-mono text-xs text-muted">
                        {trip.origin_airport_code}
                      </span>
                      <ArrowRight className="size-4 text-muted" strokeWidth={1.75} aria-hidden="true" />
                      <span className="rounded-md border border-border bg-surface-muted/60 px-2 py-1 font-mono text-xs text-muted">
                        {trip.destination_airport_code}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      {trip.origin_country} → {trip.destination_country}
                    </p>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{trip.id.slice(0, 8).toUpperCase()}</Badge>
                    <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {trip.status}
                    </span>
                  </div>

                  <h3 className="mt-2 text-lg text-muted">
                    {trip.origin_country} → {trip.destination_country}
                  </h3>

                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                    <span>Arrived {formatDate(trip.arrival_at)}</span>
                    <span>{trip.capacity_kg} kg capacity</span>
                  </div>
                </div>

                <div className="sm:text-right">
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </TravelerShell>
  );
}
