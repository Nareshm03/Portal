import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  TravelerAuthIntro,
  TravelerAuthShell,
} from "@/components/traveler/traveler-auth-shell";
import { TravelerRegisterForm } from "@/components/traveler/traveler-register-form";

export const metadata: Metadata = { title: "Traveler registration" };

export default function TravelerRegisterPage() {
  return (
    <TravelerAuthShell>
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-2 lg:gap-12 lg:py-16">
        <TravelerAuthIntro
          eyebrow="Join as a traveler"
          title="Already flying? Make the trip count."
          description="Register as a traveler, add your routes and turn unused luggage space into a trusted service with verified handovers and escrow protection."
          bullets={[
            "Complete mock passport KYC verification",
            "Register trips flying into India",
            "Earn carrying fees for available luggage space",
            "Upload purchase receipts and condition photos",
            "Secure handovers with one-time codes",
          ]}
        />

        <div className="flex flex-col justify-center">
          <div className="rounded-2xl border border-border bg-surface p-7 shadow-sm sm:p-9">
            <div>
              <p className="eyebrow">Become a traveler</p>
              <h1 className="mt-2 text-3xl leading-tight">Create account</h1>
              <p className="mt-3 text-sm text-muted">
                Demo Traveler registration with mock passport KYC. Use any
                details to continue.
              </p>
            </div>

            <div className="mt-8">
              <TravelerRegisterForm />
            </div>

            <div className="mt-6 border-t border-border pt-6 text-center text-sm text-muted">
              Already have a Traveler account?{" "}
              <Link
                href="/traveler/login"
                className="font-medium text-burgundy transition-colors hover:text-burgundy-deep"
              >
                Sign in
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
