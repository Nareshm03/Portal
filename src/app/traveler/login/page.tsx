import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  TravelerAuthIntro,
  TravelerAuthShell,
} from "@/components/traveler/traveler-auth-shell";
import { TravelerLoginForm } from "@/components/traveler/traveler-login-form";

export const metadata: Metadata = { title: "Traveler sign in" };

export default function TravelerLoginPage() {
  return (
    <TravelerAuthShell>
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-2 lg:gap-12 lg:py-16">
        <TravelerAuthIntro
          eyebrow="Traveler entrance"
          title="Turn your journey into a trusted service."
          description="Sign in to register trips, discover requests along your route and earn carrying fees for luggage space you already have."
          bullets={[
            "Register upcoming routes and flights to India",
            "Browse buyer requests that fit your itinerary",
            "Submit quotes and manage active orders",
            "Upload purchase receipts and arrival evidence",
            "Confirm handovers and track demo earnings",
          ]}
        />

        <div className="flex flex-col justify-center">
          <div className="rounded-2xl border border-border bg-surface p-7 shadow-sm sm:p-9">
            <div>
              <p className="eyebrow">Welcome back</p>
              <h1 className="mt-2 text-3xl leading-tight">Sign in</h1>
              <p className="mt-3 text-sm text-muted">
                Demo Traveler authentication. Use any email and password to
                continue.
              </p>
            </div>

            <div className="mt-8">
              <TravelerLoginForm />
            </div>

            <div className="mt-6 border-t border-border pt-6 text-center text-sm text-muted">
              Don&apos;t have a Traveler account?{" "}
              <Link
                href="/traveler/register"
                className="font-medium text-burgundy transition-colors hover:text-burgundy-deep"
              >
                Register now
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
    </TravelerAuthShell>
  );
}
