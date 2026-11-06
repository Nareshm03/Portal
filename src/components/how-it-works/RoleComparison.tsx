"use client";

import { useState } from "react";
import { UserRound, Plane } from "lucide-react";
import { cn } from "@/lib/utils";

const BUYER_DATA = {
  does: "Requests products from international stores and boutiques",
  provides: "Product details, destination and budget",
  connects: "With verified travelers flying to India",
  receives: "Quotes, duty estimates and escrow-protected delivery",
};

const TRAVELLER_DATA = {
  does: "Registers upcoming trips and available luggage space",
  provides: "Travel route, dates and carrying capacity",
  connects: "With buyer requests that match their itinerary",
  receives: "Carrying fees released after verified handover",
};

export interface RoleComparisonProps {}

export function RoleComparison() {
  const [activeRole, setActiveRole] = useState<"buyer" | "traveler">("buyer");

  const data = activeRole === "buyer" ? BUYER_DATA : TRAVELLER_DATA;
  const icon = activeRole === "buyer" ? UserRound : Plane;
  const roleLabel = activeRole === "buyer" ? "Buyer" : "Traveller";

  return (
    <section className="mt-20 bg-surface rounded-2xl border border-border p-6 sm:p-8 lg:p-10">
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <button
          onClick={() => setActiveRole("buyer")}
          className={cn(
            "px-6 py-3 rounded-lg transition-colors duration-200 text-sm font-medium",
            activeRole === "buyer"
              ? "bg-burgundy text-ivory shadow-sm"
              : "bg-transparent text-muted hover:bg-surface-muted hover:text-foreground",
          )}
          aria-pressed={activeRole === "buyer"}
        >
          <UserRound className="size-4 mr-2" strokeWidth={1.75} aria-hidden="true" />
          Buyer
        </button>
        <button
          onClick={() => setActiveRole("traveler")}
          className={cn(
            "px-6 py-3 rounded-lg transition-colors duration-200 text-sm font-medium",
            activeRole === "traveler"
              ? "bg-burgundy text-ivory shadow-sm"
              : "bg-transparent text-muted hover:bg-surface-muted hover:text-foreground",
          )}
          aria-pressed={activeRole === "traveler"}
        >
          <Plane className="size-4 mr-2" strokeWidth={1.75} aria-hidden="true" />
          Traveller
        </button>
      </div>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">{roleLabel} does</h3>
          <p className="text-sm leading-relaxed text-muted">{data.does}</p>
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">{roleLabel} provides</h3>
          <p className="text-sm leading-relaxed text-muted">{data.provides}</p>
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">{roleLabel} connects with</h3>
          <p className="text-sm leading-relaxed text-muted">{data.connects}</p>
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">{roleLabel} receives</h3>
          <p className="text-sm leading-relaxed text-muted">{data.receives}</p>
        </div>
      </div>
    </section>
  );
}