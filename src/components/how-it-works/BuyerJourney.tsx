"use client";

import { Search, Plane, Users, Wallet, PackageCheck, CheckCircle2 } from "lucide-react";

const BUYER_STEPS = [
  {
    number: "01",
    title: "Create your account",
    description: "Register as a buyer on Portal with your email and verify your profile.",
    icon: Search,
  },
  {
    number: "02",
    title: "Submit a product request",
    description: "Tell us what you want to buy and where it’s located — any store, any country.",
    icon: Plane,
  },
  {
    number: "03",
    title: "Discover matching travelers",
    description: "We connect your request with verified travelers already flying into India.",
    icon: Users,
  },
  {
    number: "04",
    title: "Compare available quotes",
    description: "Review carrying fees, duty estimates and delivery timelines side by side.",
    icon: Wallet,
  },
  {
    number: "05",
    title: "Connect with your traveler",
    description: "Message your chosen traveler directly through Portal’s secure messaging.",
    icon: PackageCheck,
  },
  {
    number: "06",
    title: "Follow your order journey",
    description: "Track from purchase to verified handover, closed with a one-time OTP.",
    icon: CheckCircle2,
  },
];

export type BuyerJourneyProps = Record<string, never>;

export function BuyerJourney() {
  return (
    <section className="mt-20 space-y-12">
      <div className="flex flex-col gap-8">
        {BUYER_STEPS.map((step, index) => (
          <div
            key={step.number}
            className="group relative flex gap-6"
          >
            <div className="shrink-0 relative">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-burgundy bg-champagne text-burgundy-deep font-serif text-2xl font-bold">
                {step.number}
              </div>
              {index < BUYER_STEPS.length - 1 && (
                <div className="absolute left-1/2 top-12 h-full w-px bg-border" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <step.icon className="size-5 text-champagne-strong" strokeWidth={1.5} aria-hidden="true" />
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}