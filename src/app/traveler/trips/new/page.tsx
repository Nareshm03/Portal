import type { Metadata } from "next";
import { Info } from "lucide-react";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { Input } from "@/components/ui";
import { AIRPORT_OPTIONS, ORIGIN_COUNTRIES } from "@/lib/demo/traveler";

export const metadata: Metadata = { title: "Register a trip" };

export default function TravelerNewTripPage() {
  return (
    <TravelerShell active="new-trip">
      <header>
        <p className="eyebrow">Trip registration</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">
          Register a trip
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Add an upcoming flight to India to discover matching buyer requests
          along your route.
        </p>
      </header>

      <section className="mt-8">
        <div className="mx-auto max-w-3xl">
          <form className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
            <div className="grid gap-6">
              {/* Origin details */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="originCountry"
                    className="block text-sm font-medium text-foreground"
                  >
                    Origin country
                  </label>
                  <select
                    id="originCountry"
                    name="originCountry"
                    required
                    className="mt-1.5 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-champagne-strong focus:outline-none focus:ring-1 focus:ring-champagne-strong"
                  >
                    <option value="">Select a country</option>
                    {ORIGIN_COUNTRIES.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="originCity"
                    className="block text-sm font-medium text-foreground"
                  >
                    Origin city
                  </label>
                  <Input
                    id="originCity"
                    name="originCity"
                    type="text"
                    required
                    placeholder="London"
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Travel dates */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="departureDate"
                    className="block text-sm font-medium text-foreground"
                  >
                    Departure date
                  </label>
                  <Input
                    id="departureDate"
                    name="departureDate"
                    type="date"
                    required
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <label
                    htmlFor="arrivalDate"
                    className="block text-sm font-medium text-foreground"
                  >
                    Arrival date in India
                  </label>
                  <Input
                    id="arrivalDate"
                    name="arrivalDate"
                    type="date"
                    required
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Destination */}
              <div>
                <label
                  htmlFor="destinationAirport"
                  className="block text-sm font-medium text-foreground"
                >
                  Destination airport in India
                </label>
                <select
                  id="destinationAirport"
                  name="destinationAirport"
                  required
                  className="mt-1.5 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-champagne-strong focus:outline-none focus:ring-1 focus:ring-champagne-strong"
                >
                  <option value="">Select an airport</option>
                  {AIRPORT_OPTIONS.map((airport) => (
                    <option key={airport.code} value={airport.code}>
                      {airport.code} · {airport.city} ({airport.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Flight details (optional) */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="airline"
                    className="block text-sm font-medium text-foreground"
                  >
                    Airline{" "}
                    <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <Input
                    id="airline"
                    name="airline"
                    type="text"
                    placeholder="British Airways"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <label
                    htmlFor="flightNumber"
                    className="block text-sm font-medium text-foreground"
                  >
                    Flight number{" "}
                    <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <Input
                    id="flightNumber"
                    name="flightNumber"
                    type="text"
                    placeholder="BA 139"
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Luggage capacity */}
              <div>
                <label
                  htmlFor="luggageSpace"
                  className="block text-sm font-medium text-foreground"
                >
                  Available luggage space (kg)
                </label>
                <Input
                  id="luggageSpace"
                  name="luggageSpace"
                  type="number"
                  min="1"
                  max="30"
                  required
                  placeholder="8"
                  className="mt-1.5"
                />
                <p className="mt-1.5 text-xs text-muted">
                  How many kilograms of luggage space you can spare for buyer
                  requests.
                </p>
              </div>

              {/* Note */}
              <div>
                <label
                  htmlFor="note"
                  className="block text-sm font-medium text-foreground"
                >
                  Trip notes{" "}
                  <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea
                  id="note"
                  name="note"
                  rows={3}
                  placeholder="Any additional details about this trip..."
                  className="mt-1.5 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-champagne-strong focus:outline-none focus:ring-1 focus:ring-champagne-strong"
                />
              </div>

              {/* Demo notice */}
              <div className="flex items-start gap-3 rounded-lg border border-champagne-strong/20 bg-champagne/10 p-4">
                <Info
                  className="mt-0.5 size-5 shrink-0 text-champagne-strong"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <div className="text-sm leading-relaxed text-muted">
                  <p className="font-medium text-foreground">
                    Demo trip registration
                  </p>
                  <p className="mt-1">
                    This form validates client-side but does not save to a
                    backend. No flight booking or airline integration is
                    connected.
                  </p>
                </div>
              </div>

              {/* Submit button */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="rounded-md bg-burgundy px-6 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-burgundy-deep"
                >
                  Register trip
                </button>
                <a
                  href="/traveler/trips"
                  className="rounded-md border border-border bg-surface px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                >
                  Cancel
                </a>
              </div>
            </div>
          </form>
        </div>
      </section>
    </TravelerShell>
  );
}
