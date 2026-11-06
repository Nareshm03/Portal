import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { BuyerAuthShell } from "@/components/buyer/buyer-auth-shell";
import { BuyerLoginForm } from "@/components/buyer/buyer-login-form";

export const metadata: Metadata = { title: "Buyer sign in" };

export default function BuyerLoginPage() {
  return (
    <BuyerAuthShell>
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-2 lg:gap-12 lg:py-16">
        {/* Left: Intro */}
        <div className="flex flex-col justify-center">
          <div className="inline-flex size-12 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <ShoppingBag
              className="size-6"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </div>
          <p className="mt-6 eyebrow">Buyer entrance</p>
          <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">
            Access your Buyer workspace
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
            Sign in to browse product requests, connect with travelers, track
            orders and manage deliveries.
          </p>

          <ul className="mt-8 grid gap-3 text-sm text-muted">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-gold" />
              <span>Create product requests with destination and dates</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-gold" />
              <span>Review quotes from verified travelers</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-gold" />
              <span>Track orders with receipt and arrival evidence</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-gold" />
              <span>Coordinate handover and confirm delivery</span>
            </li>
          </ul>
        </div>

        {/* Right: Form */}
        <div className="flex flex-col justify-center">
          <div className="rounded-2xl border border-border bg-surface p-7 shadow-sm sm:p-9">
            <div>
              <p className="eyebrow">Welcome back</p>
              <h2 className="mt-2 text-3xl leading-tight">Sign in</h2>
              <p className="mt-3 text-sm text-muted">
                Demo Buyer authentication. Use the credentials below or create a
                new account.
              </p>
            </div>

            <div className="mt-8">
              <BuyerLoginForm />
            </div>

            <div className="mt-6 border-t border-border pt-6 text-center text-sm text-muted">
              Don&apos;t have a Buyer account?{" "}
              <Link
                href="/buyer/register"
                className="font-medium text-burgundy transition-colors hover:text-burgundy-deep"
              >
                Create one now
              </Link>
            </div>
          </div>

          <Link
            href="/"
            className="mx-auto mt-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            Back to Portal entrance
            <ArrowRight
              className="size-4"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </BuyerAuthShell>
  );
}
