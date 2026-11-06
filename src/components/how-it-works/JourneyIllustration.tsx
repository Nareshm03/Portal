"use client";

import { Search, Plane, Wallet, PackageCheck } from "lucide-react";

const JOURNEY_STEPS = [
  {
    number: "01",
    label: "Buyer",
    description: "Buyer creates account",
    icon: Search,
  },
  {
    number: "02",
    label: "Product Request",
    description: "Buyer submits what they want",
    icon: Plane,
  },
  {
    number: "03",
    label: "Traveler Matching",
    description: "Verified traveler is matched",
    icon: Wallet,
  },
  {
    number: "04",
    label: "Quote",
    description: "Traveller sends quote & fee",
    icon: PackageCheck,
  },
  {
    number: "05",
    label: "Order Journey",
    description: "Handover & OTP completion",
    icon: PackageCheck,
  },
];

export type JourneyIllustrationProps = Record<string, never>;

export function JourneyIllustration() {
  return (
    <section className="mt-20 relative">
      <div className="relative z-10 max-w-5xl mx-auto px-6">
        <div className="flex flex-col items-center gap-12 md:flex-row md:gap-20 lg:gap-32">
          {JOURNEY_STEPS.map((step, index) => (
            <div
              key={step.number}
              className="flex flex-col items-center gap-4 relative z-10"
            >
              {/* Connector line between steps */}
              {index < JOURNEY_STEPS.length - 1 && (
                <div className="absolute left-1/2 top-12 -translate-x-1/2 h-[44px] w-[2px] bg-border" />
              )}
              <div className="relative flex size-16 items-center justify-center rounded-full border-2 border-burgundy bg-champagne text-burgundy-deep font-serif text-2xl font-bold">
                {step.number}
              </div>
              <div className="mt-4 flex max-w-[220px] flex-col items-center gap-2 text-center">
                <step.icon className="size-5 text-champagne-strong" strokeWidth={1.5} aria-hidden="true" />
                <h4 className="text-sm font-semibold text-foreground">{step.label}</h4>
                <p className="text-[0.75rem] leading-relaxed text-muted">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Decorative connecting line behind the nodes */}
        <div className="absolute left-1/2 top-16 bottom-16 -translate-x-1/2 w-[2px] bg-gradient-to-b from-border via-transparent to-border" />
      </div>
    </section>
  );
}