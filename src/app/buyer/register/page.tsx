import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { BuyerAuthShell } from "@/components/buyer/buyer-auth-shell";
import { BuyerRegisterForm } from "@/components/buyer/buyer-register-form";

export const metadata: Metadata = { title: "Buyer registration" };

export default function BuyerRegisterPage() {
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
          <p className="mt-6 eyebrow">Buyer registration</p>
          <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">
            Create your Buyer account
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
            Register to request products from around the world and connect with
            verified travelers bringing items to your destination.
          </p>

          <ul className="mt-8 grid gap-3 text-sm text-muted">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-gold" />
              <span>
                Post product requests with your destination and delivery date
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-gold" />
              <span>Receive quotes from travelers matching your route</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-gold" />
              <span>Track purchase receipts and arrival notifications</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-gold" />
              <span>Confirm delivery and complete your orders</span>
            </li>
          </ul>

          <div className="mt-8 rounded-lg border border-gold/20 bg-gold/5 p-4">
            <p className="text-xs leading-relaxed text-muted">
              Buyer accounts are separate from Traveler and Admin workspaces.
              Your credentials will only work in the Buyer workspace.
            </p>
          </div>
        </div>

        {/* Right: Form */}
        <div className="flex flex-col justify-center">
          <div className="rounded-2xl border border-border bg-surface p-7 shadow-sm sm:p-9">
            <div>
              <p className="eyebrow">Get started</p>
              <h2 className="mt-2 text-3xl leading-tight">Create account</h2>
              <p className="mt-3 text-sm text-muted">
                Demo registration. Your account will be stored temporarily in
                memory.
              </p>
            </div>

            <div className="mt-8">
              <BuyerRegisterForm />
            </div>

            <div className="mt-6 border-t border-border pt-6 text-center text-sm text-muted">
              Already have a Buyer account?{" "}
              <Link
                href="/buyer/login"
                className="font-medium text-burgundy transition-colors hover:text-burgundy-deep"
              >
                Sign in instead
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
