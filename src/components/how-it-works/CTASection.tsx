"use client";

import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export type CTASectionProps = Record<string, never>;

export function CTASection() {
  return (
    <section className="relative mt-20 overflow-hidden rounded-2xl border border-burgundy bg-burgundy text-ivory p-6 sm:p-8 lg:px-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 -bottom-40 w-72 rounded-full bg-champagne/20 blur-[100px]"
      />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <p className="eyebrow text-champagne">Ready to get started?</p>
        <h2 className="mt-4 max-w-md font-serif text-3xl text-ivory lg:text-4xl">
          Join Portal today
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-ivory/70 sm:text-base">
          Join a marketplace built on real travelers, clear costs and verified
          handovers — from anywhere in the world to your door in India.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <ButtonLink
            href="/buyer/register"
            variant="champagne"
            size="lg"
            fullWidth={true}
            leadingIcon={<ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />}
          >
            Create a Buyer account
          </ButtonLink>
          <ButtonLink
            href="/traveler/register"
            variant="outline"
            size="lg"
            fullWidth={true}
          >
            Join as Traveller
          </ButtonLink>
        </div>

        <p className="mt-10 text-[0.6875rem] text-ivory/50 uppercase tracking-[0.18em]">
          Prototype — mock verification and payments
        </p>
      </div>
    </section>
  );
}