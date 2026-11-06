import type { Metadata } from "next";
import Link from "next/link";
import { PortalMark } from "@/components/shared/portal-mark";
import { SectionHeading } from "@/components/ui/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRight, Plane } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoleSelector } from "@/components/how-it-works/RoleSelector";
import { BuyerJourney } from "@/components/how-it-works/BuyerJourney";
import { TravellerJourney } from "@/components/how-it-works/TravelerJourney";
import { JourneyIllustration } from "@/components/how-it-works/JourneyIllustration";
import { RoleComparison } from "@/components/how-it-works/RoleComparison";
import { FAQPreview } from "@/components/how-it-works/FAQPreview";
import { CTASection } from "@/components/how-it-works/CTASection";

export const metadata: Metadata = {
  title: "How It Works — Portal",
  description: "Learn how Portal connects Indian buyers with verified travelers flying into India. Request products, compare quotes, and complete verified handovers.",
};

export default function HowItWorksPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* ── Navbar ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6">
          <PortalMark className="text-foreground" />

          <nav aria-label="Primary" className="hidden items-center gap-8 text-sm md:flex">
            <Link
              href="/"
              className="text-muted transition-colors hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="#how-it-works"
              className="text-foreground font-medium"
              aria-current="page"
            >
              How it works
            </Link>
            <Link
              href="/buyer/register"
              className="text-muted transition-colors hover:text-foreground"
            >
              Become a Buyer
            </Link>
            <Link
              href="/traveler/register"
              className="text-muted transition-colors hover:text-foreground"
            >
              Become a Traveller
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden bg-background text-foreground py-24 sm:py-32">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_80%_at_75%_0%,rgba(91,26,43,0.10),transparent_65%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-40 bottom-0 size-[28rem] rounded-full bg-champagne/5 blur-3xl"
          />

          <div className="relative mx-auto grid w-full max-w-7xl gap-16 px-6 pb-24 pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:pb-32 lg:pt-28">
            <div className="animate-rise">
              <div className="flex items-center gap-3">
                <span className="gold-rule" />
                <p className="eyebrow text-champagne-strong">How Portal works</p>
              </div>

              <h1 className="mt-7 max-w-2xl text-balance text-foreground">
                Global Shopping.<br />
                <span className="italic text-champagne-strong">Smarter Connections.</span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                Portal connects buyers who want products from other countries
                with travellers who can help bring them. Request anything,
                compare quotes, and receive your order with a verified handover.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink
                  href="/buyer/register"
                  variant="primary"
                  size="lg"
                  leadingIcon={<ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />}
                >
                  Become a Buyer
                </ButtonLink>
                <ButtonLink
                  href="/traveler/register"
                  variant="outline"
                  size="lg"
                >
                  Join as Traveller
                </ButtonLink>
              </div>

              <ul className="mt-12 flex flex-wrap gap-x-7 gap-y-3 text-xs uppercase tracking-[0.16em] text-muted/60">
                <li className="flex items-center gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full border border-champagne/30 bg-champagne/10">
                    <span className="size-1.5 rounded-full bg-current" />
                  </span>
                  Verified travelers
                </li>
                <li className="flex items-center gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full border border-champagne/30 bg-champagne/10">
                    <span className="size-1.5 rounded-full bg-current" />
                  </span>
                  Escrow protected
                </li>
                <li className="flex items-center gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full border border-champagne/30 bg-champagne/10">
                    <span className="size-1.5 rounded-full bg-current" />
                  </span>
                  OTP handover
                </li>
              </ul>
            </div>

            <aside
              className="animate-rise relative rounded-2xl border border-border bg-white/[0.05] p-7 sm:p-9"
              style={{ animationDelay: "140ms" }}
            >
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-champagne/40 to-transparent" />
              <p className="eyebrow text-champagne-strong">How it works</p>

              <div className="mt-9 flex items-center gap-4">
                <div>
                  <p className="font-serif text-2xl text-foreground">Buyer</p>
                  <p className="mt-1 text-[0.625rem] uppercase tracking-[0.18em] text-muted/60">
                    Shops abroad
                  </p>
                </div>

                <div className="relative flex-1">
                  <div className="border-t border-dashed border-border" />
                  <span className="absolute left-1/2 top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-champagne/40 bg-background">
                    <Plane className="size-4 text-champagne-strong" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                </div>

                <div className="text-right">
                  <p className="font-serif text-2xl text-foreground">Traveller</p>
                  <p className="mt-1 text-[0.625rem] uppercase tracking-[0.18em] text-muted/60">
                    Brings it home
                  </p>
                </div>
              </div>

              <dl className="mt-9 space-y-4 border-t border-border pt-6 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted/60">Product request</dt>
                  <dd className="font-medium text-foreground">Confirmed</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted/60">Traveler match</dt>
                  <dd className="font-medium text-champagne-strong">Verified</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted/60">Duty estimate</dt>
                  <dd className="font-medium text-foreground">Included</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted/60">Payment</dt>
                  <dd className="font-medium text-foreground">In escrow</dd>
                </div>
              </dl>

              <p className="mt-8 rounded-lg border border-champagne/30 bg-champagne/10 px-4 py-3 text-xs leading-relaxed text-champagne-ink">
                Every handover is confirmed with a one-time code.
              </p>
            </aside>
          </div>
        </section>

        {/* ── Role Selector ───────────────────────────────────────── */}
        <section className="relative scroll-mt-24 bg-background py-24 sm:py-32">
          <div className="mx-auto w-full max-w-7xl px-6">
            <SectionHeading
              eyebrow="Choose your role"
              title="Two roles, one marketplace"
              description="Buyers request products. Travellers carry them. Both sides benefit from a secure, verified handover."
            />
            <RoleSelector
              selectedRole="buyer"
              onRoleChange={() => {}}
            />
          </div>
        </section>

        {/* ── Buyer & Traveller Journeys ──────────────────────────── */}
        <section className="relative scroll-mt-24 bg-background py-24 sm:py-32">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="grid gap-16 lg:grid-cols-2">
              <BuyerJourney />
              <TravellerJourney />
            </div>
          </div>
        </section>

        {/* ── Journey Illustration ────────────────────────────────── */}
        <section className="relative scroll-mt-24 bg-background py-24 sm:py-32">
          <JourneyIllustration />
        </section>

        {/* ── Role Comparison ─────────────────────────────────────── */}
        <section className="relative scroll-mt-24 bg-background py-24 sm:py-32">
          <RoleComparison />
        </section>

        {/* ── FAQ Preview ─────────────────────────────────────────── */}
        <section className="relative scroll-mt-24 bg-background py-24 sm:py-32">
          <FAQPreview />
        </section>

        {/* ── Final CTA ───────────────────────────────────────────── */}
        <section className="relative scroll-mt-24 bg-background py-24 sm:py-32">
          <CTASection />
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-background text-foreground">
        <div className="mx-auto w-full max-w-7xl px-6 py-16">
          <div className="grid gap-12 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <PortalMark className="text-foreground" />
              <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">
                An international shopping marketplace connecting Indian buyers
                with verified travelers flying into India.
              </p>
            </div>

            <nav aria-label="Buyer links">
              <h6 className="text-burgundy">Buyers</h6>
              <ul className="mt-5 space-y-3 text-sm text-muted/60">
                <li>
                  <Link href="/buyer/register" className="transition-colors hover:text-burgundy">
                    Create an account
                  </Link>
                </li>
                <li>
                  <Link href="/buyer/login" className="transition-colors hover:text-burgundy">
                    Sign in
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label="Traveler links">
              <h6 className="text-burgundy">Travellers</h6>
              <ul className="mt-5 space-y-3 text-sm text-muted/60">
                <li>
                  <Link href="/traveler/register" className="transition-colors hover:text-burgundy">
                    Register a trip
                  </Link>
                </li>
                <li>
                  <Link href="/traveler/login" className="transition-colors hover:text-burgundy">
                    Sign in
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label="Resources">
              <h6 className="text-burgundy">Help</h6>
              <ul className="mt-5 space-y-3 text-sm text-muted/60">
                <li>
                  <Link href="/help" className="transition-colors hover:text-burgundy">
                    Help center
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          <div className="mt-14 border-t border-border pt-8">
            <p className="max-w-3xl text-xs leading-relaxed text-muted/60">
              Portal is a marketplace technology platform. Portal does not sell,
              ship or import goods, and does not provide legal, customs or tax
              advice. Duty estimates are indicative only. Buyers and travelers
              are responsible for complying with Indian customs regulations and
              applicable law.
            </p>
            <div className="mt-6 flex flex-col gap-2 text-xs text-muted/40 sm:flex-row sm:items-center sm:justify-between">
              <span>© {new Date().getFullYear()} Portal. All rights reserved.</span>
              <span>Prototype — mock verification and payments.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}