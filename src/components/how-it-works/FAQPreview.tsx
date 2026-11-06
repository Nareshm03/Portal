"use client";

import Link from "next/link";
import { ChevronRight, HelpCircle } from "lucide-react";

const FAQS = [
  {
    question: "What is Portal?",
    answer: "Portal connects Indian buyers with verified travelers flying into India, so you can request products from anywhere in the world and have them carried personally to you.",
  },
  {
    question: "How do I become a buyer?",
    answer: "Create a buyer account, submit a product request, and receive quotes from matched travelers. Payment is held in escrow until handover is confirmed.",
  },
  {
    question: "How do I become a traveller?",
    answer: "Register as a traveller, complete mock passport KYC verification, publish your trip route, and respond to buyer requests that match your flight.",
  },
  {
    question: "How does payment work?",
    answer: "Funds are held in escrow and released only after the traveller confirms arrival and you verify the handover with a one-time OTP.",
  },
  {
    question: "Is my purchase protected?",
    answer: "Yes. Every order includes purchase receipts, condition photos, and OTP-based handover confirmation so both parties are protected.",
  },
];

export type FAQPreviewProps = Record<string, never>;

export function FAQPreview() {
  return (
    <section className="mt-20 bg-surface rounded-2xl border border-border p-6 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2 mb-6">
          <HelpCircle className="size-5 text-champagne-strong" strokeWidth={1.5} aria-hidden="true" />
          <h2 className="text-2xl font-serif text-foreground">Frequently asked questions</h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq) => (
            <div
              key={faq.question}
              className="group relative border-b border-border pb-4"
            >
              <div className="flex items-start justify-between gap-4 cursor-pointer">
                <h3 className="text-base font-medium text-foreground leading-tight">
                  {faq.question}
                </h3>
                <ChevronRight className="size-4 text-muted transition-transform duration-200 group-hover:rotate-90" aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-end">
          <Link
            href="/help"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-burgundy transition-colors hover:text-burgundy-deep"
          >
            Browse all help topics
            <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}