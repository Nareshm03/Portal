"use client";

import { Plane, FileCheck, Wallet, MessageCircle, CheckCircle2 } from "lucide-react";

const TRAVELLER_STEPS = [
  {
    number: "01",
    title: "Create a traveller account",
    description: "Register as a traveller on Portal with your email and complete mock passport KYC verification.",
    icon: Plane,
  },
  {
    number: "02",
    title: "Complete account verification",
    description: "Verify your identity and passport details so buyers can trust you with their purchases.",
    icon: FileCheck,
  },
  {
    number: "03",
    title: "Publish an upcoming trip",
    description: "Add your flight route, dates and available luggage space so buyers can find you.",
    icon: Plane,
  },
  {
    number: "04",
    title: "Discover relevant buyer requests",
    description: "Browse buyer requests that match your route and have the luggage capacity you can offer.",
    icon: Wallet,
  },
  {
    number: "05",
    title: "Respond with a quote",
    description: "Submit your carrying fee, duty estimate and delivery timeline for the buyer to review.",
    icon: MessageCircle,
  },
  {
    number: "06",
    title: "Coordinate with the buyer",
    description: "Meet the buyer on arrival, confirm with a one-time OTP and complete the handover.",
    icon: CheckCircle2,
  },
];

export interface TravellerJourneyProps {}

export function TravellerJourney() {
  return (
    <section className="mt-20 space-y-12">
      <div className="flex flex-col gap-8">
        {TRAVELLER_STEPS.map((step, index) => (
          <div
            key={step.number}
            className="group relative flex gap-6"
          >
            <div className="shrink-0 relative">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-burgundy bg-champagne text-burgundy-deep font-serif text-2xl font-bold">
                {step.number}
              </div>
              {index < TRAVELLER_STEPS.length - 1 && (
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