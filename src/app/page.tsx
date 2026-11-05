import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Calculator,
  Camera,
  Check,
  ChevronDown,
  Globe2,
  Lock,
  Menu,
  PackageCheck,
  Plane,
  QrCode,
  Search,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { PortalMark } from "@/components/shared/portal-mark";

export const metadata: Metadata = {
  title: "Portal — The world has it. We’ll bring it closer.",
  description:
    "An international shopping marketplace connecting Indian buyers with verified travelers flying into India.",
};

const STEPS = [
  {
    number: "01",
    title: "Discover a product",
    description:
      "Find what you love from stores, boutiques and marketplaces anywhere in the world.",
    icon: Search,
  },
  {
    number: "02",
    title: "Get matched with a traveler",
    description:
      "We connect your request with a verified traveler already flying into India.",
    icon: Plane,
  },
  {
    number: "03",
    title: "Compare quotes and secure payment",
    description:
      "Review carrying fees and duty estimates, then pay safely through escrow.",
    icon: Wallet,
  },
  {
    number: "04",
    title: "Receive through verified handover",
    description:
      "Meet your traveler, confirm with a one-time code and take your product home.",
    icon: PackageCheck,
  },
];

const TRUST_ITEMS = [
  {
    title: "Mock KYC verification",
    description:
      "Every traveler completes identity checks before carrying a single item.",
    icon: BadgeCheck,
  },
  {
    title: "Customs duty estimate",
    description:
      "See an indicative duty estimate before you commit, with no surprises at handover.",
    icon: Calculator,
  },
  {
    title: "Escrow payment tracking",
    description:
      "Funds are held securely and released only when delivery is confirmed.",
    icon: Lock,
  },
  {
    title: "Receipt and photo proof",
    description:
      "Purchase receipts and condition photos travel with every order.",
    icon: Camera,
  },
  {
    title: "OTP-based handover",
    description:
      "A one-time code closes the handover, so both sides know it is complete.",
    icon: QrCode,
  },
];

const BUYER_POINTS = [
  "Request products from international stores and boutiques",
  "Compare quotes from travelers already flying into India",
  "Track every purchase from request to verified handover",
];

const TRAVELER_POINTS = [
  "Register upcoming trips and the routes you are flying",
  "Discover buyer requests that fit your itinerary and luggage",
  "Earn carrying fees for the space you already have",
];

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-obsidian">
      {/* ── Navbar ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-obsidian/90 backdrop-blur-md">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6">
          <PortalMark className="text-on-obsidian" />

          <nav
            aria-label="Primary"
            className="hidden items-center gap-8 text-sm md:flex"
          >
            <a
              href="#how-it-works"
              className="text-on-obsidian/70 transition-colors hover:text-gold"
            >
              How it works
            </a>
            <a
              href="#for-buyers"
              className="text-on-obsidian/70 transition-colors hover:text-gold"
            >
              For Buyers
            </a>
            <a
              href="#for-travelers"
              className="text-on-obsidian/70 transition-colors hover:text-gold"
            >
              For Travelers
            </a>

            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-gold/40 px-4 py-2 font-medium text-gold transition-colors hover:border-gold hover:bg-gold/10 [&::-webkit-details-marker]:hidden">
                Sign in
                <ChevronDown
                  className="size-4 transition-transform duration-200 group-open:rotate-180"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </summary>
              <div className="absolute right-0 top-full mt-3 w-64 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-2xl">
                <Link
                  href="/buyer/login"
                  className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-muted"
                >
                  <span className="block text-sm font-medium text-foreground">
                    Buyer sign in
                  </span>
                  <span className="block text-xs text-muted">
                    Request and track products
                  </span>
                </Link>
                <Link
                  href="/traveler/login"
                  className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-muted"
                >
                  <span className="block text-sm font-medium text-foreground">
                    Traveler sign in
                  </span>
                  <span className="block text-xs text-muted">
                    Register trips and carry
                  </span>
                </Link>
              </div>
            </details>
          </nav>

          {/* Mobile navigation */}
          <details className="group relative md:hidden">
            <summary
              aria-label="Open menu"
              className="grid size-10 cursor-pointer list-none place-items-center rounded-full border border-white/15 text-on-obsidian transition-colors hover:border-gold hover:text-gold [&::-webkit-details-marker]:hidden"
            >
              <Menu className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </summary>
            <div className="absolute right-0 top-full mt-3 w-72 rounded-xl border border-white/10 bg-obsidian-soft p-3 shadow-2xl">
              <div className="grid gap-1 text-sm">
                <a
                  href="#how-it-works"
                  className="rounded-lg px-3 py-2.5 text-on-obsidian/80 hover:bg-white/5 hover:text-gold"
                >
                  How it works
                </a>
                <a
                  href="#for-buyers"
                  className="rounded-lg px-3 py-2.5 text-on-obsidian/80 hover:bg-white/5 hover:text-gold"
                >
                  For Buyers
                </a>
                <a
                  href="#for-travelers"
                  className="rounded-lg px-3 py-2.5 text-on-obsidian/80 hover:bg-white/5 hover:text-gold"
                >
                  For Travelers
                </a>
              </div>
              <div className="mt-3 grid gap-2 border-t border-white/10 pt-3">
                <Link
                  href="/buyer/login"
                  className="rounded-lg border border-gold/40 px-3 py-2.5 text-sm font-medium text-gold hover:bg-gold/10"
                >
                  Buyer sign in
                </Link>
                <Link
                  href="/traveler/login"
                  className="rounded-lg border border-gold/40 px-3 py-2.5 text-sm font-medium text-gold hover:bg-gold/10"
                >
                  Traveler sign in
                </Link>
              </div>
            </div>
          </details>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden bg-obsidian text-on-obsidian">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_80%_at_75%_0%,rgba(198,166,100,0.20),transparent_65%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-40 bottom-0 size-[28rem] rounded-full bg-gold/5 blur-3xl"
          />

          <div className="relative mx-auto grid w-full max-w-7xl gap-16 px-6 pb-24 pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:pb-32 lg:pt-28">
            <div className="animate-rise">
              <div className="flex items-center gap-3">
                <span className="gold-rule" />
                <p className="eyebrow text-gold">International shopping, personally delivered</p>
              </div>

              <h1 className="mt-7 max-w-2xl text-balance text-on-obsidian">
                The world has it.
                <br />
                <span className="italic text-gold">We&apos;ll bring it closer.</span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-relaxed text-on-obsidian/70 sm:text-lg">
                Discover products from around the world. Connect with verified
                travelers flying to India and get what you love, brought
                personally to you.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/buyer/login"
                  className="group inline-flex items-center justify-center gap-2 rounded-md bg-gold px-6 py-3.5 text-sm font-semibold text-obsidian transition-all duration-300 hover:bg-gold-soft hover:shadow-[0_10px_40px_-12px_rgba(198,166,100,0.7)]"
                >
                  Explore as Buyer
                  <ArrowRight
                    className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  href="/traveler/login"
                  className="group inline-flex items-center justify-center gap-2 rounded-md border border-white/20 px-6 py-3.5 text-sm font-medium text-on-obsidian transition-colors duration-300 hover:border-gold hover:text-gold"
                >
                  Join as Traveler
                  <ArrowUpRight
                    className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </Link>
              </div>

              <ul className="mt-12 flex flex-wrap gap-x-7 gap-y-3 text-xs uppercase tracking-[0.16em] text-on-obsidian/50">
                <li className="flex items-center gap-2">
                  <BadgeCheck className="size-4 text-gold" strokeWidth={1.75} aria-hidden="true" />
                  Verified travelers
                </li>
                <li className="flex items-center gap-2">
                  <Lock className="size-4 text-gold" strokeWidth={1.75} aria-hidden="true" />
                  Escrow protected
                </li>
                <li className="flex items-center gap-2">
                  <QrCode className="size-4 text-gold" strokeWidth={1.75} aria-hidden="true" />
                  OTP handover
                </li>
              </ul>
            </div>

            {/* Editorial route card */}
            <aside
              className="animate-rise relative rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-sm sm:p-9"
              style={{ animationDelay: "140ms" }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"
              />
              <p className="eyebrow text-gold">A live route</p>

              <div className="mt-9 flex items-center gap-4">
                <div>
                  <p className="font-serif text-2xl text-on-obsidian">Abroad</p>
                  <p className="mt-1 text-[0.625rem] uppercase tracking-[0.18em] text-on-obsidian/45">
                    Store of choice
                  </p>
                </div>

                <div className="relative flex-1">
                  <div className="border-t border-dashed border-gold/40" />
                  <span className="absolute left-1/2 top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-gold/40 bg-obsidian">
                    <Plane
                      className="size-4 text-gold"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </span>
                </div>

                <div className="text-right">
                  <p className="font-serif text-2xl text-on-obsidian">India</p>
                  <p className="mt-1 text-[0.625rem] uppercase tracking-[0.18em] text-on-obsidian/45">
                    Your doorstep
                  </p>
                </div>
              </div>

              <dl className="mt-9 space-y-4 border-t border-white/10 pt-6 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-on-obsidian/55">Product request</dt>
                  <dd className="font-medium text-on-obsidian">Confirmed</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-on-obsidian/55">Traveler match</dt>
                  <dd className="font-medium text-gold">Verified</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-on-obsidian/55">Duty estimate</dt>
                  <dd className="font-medium text-on-obsidian">Included</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-on-obsidian/55">Payment</dt>
                  <dd className="font-medium text-on-obsidian">In escrow</dd>
                </div>
              </dl>

              <p className="mt-8 rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-xs leading-relaxed text-gold">
                Every handover is confirmed with a one-time code.
              </p>
            </aside>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────── */}
        <section
          id="how-it-works"
          className="scroll-mt-24 bg-background py-24 text-foreground sm:py-32"
        >
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
              <div>
                <p className="eyebrow">How it works</p>
                <h2 className="mt-4 max-w-lg text-balance">
                  From a wish abroad to your hands in India.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-muted lg:justify-self-end lg:text-base">
                Portal turns an international purchase into a clear, protected
                journey — matched to a real traveler, priced up front and closed
                with a verified handover.
              </p>
            </div>

            <ol className="mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {STEPS.map((step, index) => {
                const Icon = step.icon;

                return (
                  <li
                    key={step.number}
                    className="animate-rise group relative border-t border-border-strong pt-6 transition-colors duration-300 hover:border-gold"
                    style={{ animationDelay: `${index * 90}ms` }}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-serif text-4xl leading-none text-gold-strong">
                        {step.number}
                      </span>
                      <span className="grid size-10 place-items-center rounded-full border border-border bg-surface transition-colors duration-300 group-hover:border-gold/60 group-hover:bg-gold/10">
                        <Icon
                          className="size-[1.125rem] text-gold-strong"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                    <h3 className="mt-8 text-xl">{step.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      {step.description}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ── For Buyers ───────────────────────────────────────────── */}
        <section
          id="for-buyers"
          className="relative scroll-mt-24 overflow-hidden border-y border-white/10 bg-obsidian py-24 text-on-obsidian sm:py-32"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 size-96 rounded-full bg-gold/5 blur-3xl"
          />

          <div className="relative mx-auto grid w-full max-w-7xl gap-14 px-6 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="eyebrow text-gold">For Buyers</p>
              <h2 className="mt-4 max-w-md text-balance text-on-obsidian">
                Request anything.
                <br />
                <span className="italic text-gold">We&apos;ll find the way.</span>
              </h2>
              <p className="mt-6 max-w-lg text-sm leading-relaxed text-on-obsidian/65 sm:text-base">
                Tell us what you want and where it lives. Portal brings you
                quotes from travelers already heading to India, with duty
                estimates and escrow protection built in.
              </p>

              <ul className="mt-9 space-y-4">
                {BUYER_POINTS.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-3 text-sm text-on-obsidian/75"
                  >
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-gold/40 bg-gold/10">
                      <Check
                        className="size-3 text-gold"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/buyer/register"
                  className="group inline-flex items-center justify-center gap-2 rounded-md bg-gold px-5 py-3 text-sm font-semibold text-obsidian transition-all duration-300 hover:bg-gold-soft"
                >
                  Create a Buyer account
                  <ArrowRight
                    className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  href="/buyer/login"
                  className="inline-flex items-center justify-center rounded-md border border-white/20 px-5 py-3 text-sm font-medium text-on-obsidian transition-colors duration-300 hover:border-gold hover:text-gold"
                >
                  Buyer sign in
                </Link>
              </div>
            </div>

            <div className="grid content-start gap-4 lg:pt-4">
              {[
                {
                  icon: Globe2,
                  title: "Any store, any city",
                  copy: "From flagship boutiques to independent makers, request what you cannot find at home.",
                },
                {
                  icon: Wallet,
                  title: "Quotes you can compare",
                  copy: "See carrying fees and indicative customs duty side by side before you decide.",
                },
                {
                  icon: PackageCheck,
                  title: "Track every purchase",
                  copy: "Follow your request from match to handover, with receipts and photo proof attached.",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="group rounded-xl border border-white/10 bg-white/[0.02] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:bg-white/[0.04]"
                  >
                    <span className="grid size-10 place-items-center rounded-full border border-gold/30 bg-gold/10">
                      <Icon
                        className="size-[1.125rem] text-gold"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    </span>
                    <h3 className="mt-5 text-lg text-on-obsidian">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-on-obsidian/60">
                      {item.copy}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── For Travelers ────────────────────────────────────────── */}
        <section
          id="for-travelers"
          className="scroll-mt-24 bg-background py-24 text-foreground sm:py-32"
        >
          <div className="mx-auto grid w-full max-w-7xl gap-14 px-6 lg:grid-cols-2 lg:gap-20">
            <div className="order-2 grid content-start gap-4 lg:order-1 lg:pt-4">
              {[
                {
                  icon: Plane,
                  title: "Register your route",
                  copy: "Add your upcoming flights and the luggage space you can spare.",
                },
                {
                  icon: ShoppingBag,
                  title: "Requests that fit",
                  copy: "Browse buyer requests along your route and accept only what suits you.",
                },
                {
                  icon: Wallet,
                  title: "Earn carrying fees",
                  copy: "Get paid for space you already have, released after confirmed handover.",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="group rounded-xl border border-border bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold/60 hover:shadow-[0_18px_50px_-30px_rgba(12,12,13,0.5)]"
                  >
                    <span className="grid size-10 place-items-center rounded-full border border-gold/40 bg-gold/10">
                      <Icon
                        className="size-[1.125rem] text-gold-strong"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    </span>
                    <h3 className="mt-5 text-lg">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {item.copy}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="order-1 lg:order-2">
              <p className="eyebrow">For Travelers</p>
              <h2 className="mt-4 max-w-md text-balance">
                Already flying?
                <br />
                <span className="italic text-gold-strong">Make the trip count.</span>
              </h2>
              <p className="mt-6 max-w-lg text-sm leading-relaxed text-muted sm:text-base">
                Turn unused luggage space into a trusted service. Register your
                trips, choose requests that fit your route and carry with the
                backing of verification and escrow.
              </p>

              <ul className="mt-9 space-y-4">
                {TRAVELER_POINTS.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-3 text-sm text-foreground/80"
                  >
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-gold/50 bg-gold/10">
                      <Check
                        className="size-3 text-gold-strong"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/traveler/register"
                  className="group inline-flex items-center justify-center gap-2 rounded-md bg-obsidian px-5 py-3 text-sm font-semibold text-on-obsidian transition-all duration-300 hover:bg-obsidian-soft hover:shadow-[0_10px_40px_-16px_rgba(12,12,13,0.8)]"
                >
                  Join as Traveler
                  <ArrowRight
                    className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  href="/traveler/login"
                  className="inline-flex items-center justify-center rounded-md border border-border-strong px-5 py-3 text-sm font-medium text-foreground transition-colors duration-300 hover:border-gold hover:text-gold-strong"
                >
                  Traveler sign in
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust and safety ─────────────────────────────────────── */}
        <section className="border-t border-white/10 bg-obsidian py-24 text-on-obsidian sm:py-32">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="max-w-2xl">
              <p className="eyebrow text-gold">Trust and safety</p>
              <h2 className="mt-4 text-balance text-on-obsidian">
                Protected at every step.
              </h2>
              <p className="mt-5 text-sm leading-relaxed text-on-obsidian/60 sm:text-base">
                Cross-border shopping depends on trust. Portal layers
                verification, transparent costs and proof into every handover.
              </p>
            </div>

            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {TRUST_ITEMS.map((item, index) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="animate-rise group rounded-xl border border-white/10 bg-white/[0.02] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:bg-white/[0.04]"
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <Icon
                      className="size-6 text-gold"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <h3 className="mt-6 text-base leading-snug text-on-obsidian">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-xs leading-relaxed text-on-obsidian/55">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-background py-24 sm:py-32">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(198,166,100,0.18),transparent_70%)]"
          />
          <div className="relative mx-auto w-full max-w-4xl px-6 text-center">
            <p className="eyebrow">Begin your journey</p>
            <h2 className="mx-auto mt-6 max-w-2xl text-balance">
              Your next favourite find is just a journey away.
            </h2>
            <div className="gold-rule mx-auto mt-8" />
            <p className="mx-auto mt-7 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              Join a marketplace built on real travelers, clear costs and
              verified handovers — from anywhere in the world to your door in
              India.
            </p>

            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/buyer/login"
                className="group inline-flex items-center justify-center gap-2 rounded-md bg-obsidian px-6 py-3.5 text-sm font-semibold text-on-obsidian transition-all duration-300 hover:bg-obsidian-soft hover:shadow-[0_12px_40px_-16px_rgba(12,12,13,0.8)]"
              >
                Explore as Buyer
                <ArrowRight
                  className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/traveler/login"
                className="inline-flex items-center justify-center rounded-md border border-border-strong bg-surface px-6 py-3.5 text-sm font-medium text-foreground transition-colors duration-300 hover:border-gold hover:text-gold-strong"
              >
                Join as Traveler
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-obsidian text-on-obsidian">
        <div className="mx-auto w-full max-w-7xl px-6 py-16">
          <div className="grid gap-12 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <PortalMark className="text-on-obsidian" />
              <p className="mt-5 max-w-xs text-sm leading-relaxed text-on-obsidian/55">
                An international shopping marketplace connecting Indian buyers
                with verified travelers flying into India.
              </p>
              <p className="mt-6 text-[0.625rem] uppercase tracking-[0.2em] text-on-obsidian/35">
                Obsidian · Champagne · Cream
              </p>
            </div>

            <nav aria-label="Buyer links">
              <h6 className="text-gold">Buyers</h6>
              <ul className="mt-5 space-y-3 text-sm text-on-obsidian/60">
                <li>
                  <Link
                    href="/buyer/register"
                    className="transition-colors hover:text-gold"
                  >
                    Create an account
                  </Link>
                </li>
                <li>
                  <Link
                    href="/buyer/login"
                    className="transition-colors hover:text-gold"
                  >
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link
                    href="/buyer/dashboard"
                    className="transition-colors hover:text-gold"
                  >
                    Buyer dashboard
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label="Traveler links">
              <h6 className="text-gold">Travelers</h6>
              <ul className="mt-5 space-y-3 text-sm text-on-obsidian/60">
                <li>
                  <Link
                    href="/traveler/register"
                    className="transition-colors hover:text-gold"
                  >
                    Register a trip
                  </Link>
                </li>
                <li>
                  <Link
                    href="/traveler/login"
                    className="transition-colors hover:text-gold"
                  >
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link
                    href="/traveler/dashboard"
                    className="transition-colors hover:text-gold"
                  >
                    Traveler dashboard
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          <div className="mt-14 border-t border-white/10 pt-8">
            <p className="max-w-3xl text-xs leading-relaxed text-on-obsidian/40">
              Portal is a marketplace technology platform. Portal does not sell,
              ship or import goods, and does not provide legal, customs or tax
              advice. Duty estimates are indicative only. Buyers and travelers
              are responsible for complying with Indian customs regulations and
              applicable law.
            </p>
            <div className="mt-6 flex flex-col gap-2 text-xs text-on-obsidian/35 sm:flex-row sm:items-center sm:justify-between">
              <span>© {new Date().getFullYear()} Portal. All rights reserved.</span>
              <span>Prototype — mock verification and payments.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
