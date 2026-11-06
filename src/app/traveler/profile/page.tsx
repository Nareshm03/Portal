"use client";

import { CheckCircle2, Globe, Mail, MapPin, Phone, Plane, Shield, Star, KeyRound, AlertCircle } from "lucide-react";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { SectionHeading } from "@/components/ui";
import {
  getInitials,
  passportKyc,
  travelerProfile,
} from "@/lib/demo/traveler";
import { cn } from "@/lib/utils";
import { DocumentUpload } from "@/components/traveler/document-upload";

export default function TravelerProfilePage() {
  // For demo purposes, assuming session exists (in real app would use session hook)
  const session = true;
  return (
    <TravelerShell active="profile">
      <header>
        <p className="eyebrow">Account details</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">
          Profile & passport KYC
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Your profile, contact details and passport verification status for the
          Portal Traveler workspace.
        </p>
      </header>

      {/* ── Profile overview ────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="relative overflow-hidden rounded-2xl bg-burgundy-deep p-8 text-ivory">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(214,185,140,0.3),transparent_60%)]"
          />
          <div className="relative flex items-start gap-6">
            <div className="grid size-20 shrink-0 place-items-center rounded-2xl border border-champagne/40 bg-champagne/15 text-2xl font-semibold text-champagne">
              {getInitials(travelerProfile.fullName)}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-medium text-ivory">
                {travelerProfile.fullName}
              </h2>
              <p className="mt-1 text-sm text-ivory/60">
                {travelerProfile.baseCity}, {travelerProfile.baseCountry}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-champagne/40 bg-champagne/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-champagne">
                  <Star
                    className="size-3.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  {travelerProfile.tier}
                </span>
                <span className="text-xs text-ivory/50">
                  Member since {travelerProfile.memberSince}
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="flex items-center gap-2">
                <Star
                  className="size-4 fill-champagne text-champagne"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="text-2xl font-medium tabular-nums text-champagne">
                  {travelerProfile.rating}
                </span>
              </div>
              <p className="mt-1 text-xs text-ivory/60">
                {travelerProfile.carries} carries
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact details ─────────────────────────────────────────────── */}
      <section className="mt-8">
        <SectionHeading
          eyebrow="Contact"
          title="Contact details"
          description="Your registered email, phone and location information."
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-start gap-3">
              <Mail
                className="mt-0.5 size-5 shrink-0 text-muted"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Email
                  </p>
                  {travelerProfile.emailVerified && (
                    <CheckCircle2
                      className="size-4 text-emerald"
                      strokeWidth={2}
                      aria-label="Verified"
                    />
                  )}
                </div>
                <p className="mt-1.5 text-sm text-foreground">
                  {travelerProfile.email}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-start gap-3">
              <Phone
                className="mt-0.5 size-5 shrink-0 text-muted"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Phone
                  </p>
                  {travelerProfile.phoneVerified && (
                    <CheckCircle2
                      className="size-4 text-emerald"
                      strokeWidth={2}
                      aria-label="Verified"
                    />
                  )}
                </div>
                <p className="mt-1.5 text-sm text-foreground">
                  {travelerProfile.phone}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-start gap-3">
              <MapPin
                className="mt-0.5 size-5 shrink-0 text-muted"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Base location
                  </p>
                  {travelerProfile.locationVerified && (
                    <CheckCircle2
                      className="size-4 text-emerald"
                      strokeWidth={2}
                      aria-label="Verified"
                    />
                  )}
                </div>
                <p className="mt-1.5 text-sm text-foreground">
                  {travelerProfile.baseCity}, {travelerProfile.baseCountry}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-start gap-3">
              <Plane
                className="mt-0.5 size-5 shrink-0 text-muted"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Home airport
                  </p>
                  {travelerProfile.airportVerified && (
                    <CheckCircle2
                      className="size-4 text-emerald"
                      strokeWidth={2}
                      aria-label="Verified"
                    />
                  )}
                </div>
                <p className="mt-1.5 text-sm text-foreground">
                  {travelerProfile.homeAirport}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5 sm:col-span-2">
            <div className="flex items-start gap-3">
              <Globe
                className="mt-0.5 size-5 shrink-0 text-muted"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Languages
                  </p>
                  {travelerProfile.languagesVerified && (
                    <CheckCircle2
                      className="size-4 text-emerald"
                      strokeWidth={2}
                      aria-label="Verified"
                    />
                  )}
                </div>
                <p className="mt-1.5 text-sm text-foreground">
                  {travelerProfile.languages.join(", ")}
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ── Bio ─────────────────────────────────────────────────────────── */}
      <section className="mt-8">
        <SectionHeading
          eyebrow="About"
          title="Traveler bio"
          description="A short introduction visible to buyers when you submit quotes."
        />

        <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm leading-relaxed text-foreground">
            {travelerProfile.bio}
          </p>
        </div>
      </section>

      {/* ── Passport KYC ────────────────────────────────────────────────── */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Identity verification"
          title="Passport KYC"
          description="Your passport verification status and document checklist."
        />

        <div
          className={cn(
            "mt-6 overflow-hidden rounded-2xl border p-6",
            passportKyc.status === "demo-verified"
              ? "border-champagne/30 bg-champagne/5"
              : "border-border bg-surface",
          )}
        >
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "grid size-12 shrink-0 place-items-center rounded-xl border",
                passportKyc.status === "demo-verified"
                  ? "border-champagne/40 bg-champagne/15"
                  : "border-border bg-surface-muted",
              )}
            >
              <Shield
                className={cn(
                  "size-6",
                  passportKyc.status === "demo-verified"
                    ? "text-champagne-strong"
                    : "text-muted",
                )}
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium text-foreground">
                  {passportKyc.label}
                </h3>
                {passportKyc.status === "demo-verified" && (
                  <CheckCircle2
                    className="size-5 text-champagne-strong"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                )}
              </div>
              <p className="mt-1 text-xs text-muted">
                Verification status:{" "}
                <span className="font-medium text-foreground">
                  {passportKyc.status === "demo-verified"
                    ? "Demo verified"
                    : "Pending"}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Passport number
              </p>
              <p className="mt-1 font-mono text-foreground">
                {passportKyc.passportNumberMasked}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Nationality
              </p>
              <p className="mt-1 text-foreground">{passportKyc.nationality}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Issuing country
              </p>
              <p className="mt-1 text-foreground">
                {passportKyc.issuingCountry}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Expiry date
              </p>
              <p className="mt-1 text-foreground">{passportKyc.expiryDate}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Checked on
              </p>
              <p className="mt-1 text-foreground">{passportKyc.checkedOn}</p>
            </div>
          </div>

          {/* Demo Mode Notice */}
          <div className="mt-6 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle
                className="mt-0.5 size-4 shrink-0 text-blue-500"
                strokeWidth={2}
                aria-hidden="true"
              />
              <p className="text-xs leading-relaxed text-muted">
                <strong className="font-semibold text-foreground">Demo Mode:</strong>{" "}
                Document uploads are stored locally in your browser. No backend storage is configured. 
                Files will persist until browser data is cleared.
              </p>
            </div>
          </div>

          {/* Document Uploads */}
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Required Documents
            </p>
            <div className="mt-3 grid gap-4">
              <DocumentUpload
                documentType="passport"
                label="Passport Photo Page"
                acceptedFormats={[".jpg", ".jpeg", ".png", ".pdf"]}
                currentStatus="Not uploaded"
              />
              <DocumentUpload
                documentType="selfie"
                label="Selfie Match"
                acceptedFormats={[".jpg", ".jpeg", ".png"]}
                currentStatus="Not uploaded"
              />
              <DocumentUpload
                documentType="address"
                label="Address Confirmation"
                acceptedFormats={[".jpg", ".jpeg", ".png", ".pdf"]}
                currentStatus="Not uploaded"
              />
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-champagne/20 bg-champagne/5 p-4">
            <p className="text-xs leading-relaxed text-muted">
              {passportKyc.note}
            </p>
          </div>
        </div>
      </section>

      {/* ── Verification status ─────────────────────────────────────────── */}
      <section className="mt-8">
        <SectionHeading
          eyebrow="Trust & safety"
          title="Verification status"
          description="Trust indicators visible to buyers when you submit quotes."
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-champagne/30 bg-champagne/5 p-5">
            <div className="flex items-start gap-3">
              <Shield
                className="mt-0.5 size-5 shrink-0 text-champagne-strong"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Passport KYC
                </p>
                <p className="mt-1 text-xs text-muted">
                  {passportKyc.label}
                </p>
              </div>
            </div>
          </article>

          <article
            className={cn(
              "rounded-2xl border p-5",
              session
                ? "border-emerald/30 bg-emerald/5"
                : "border-border bg-surface",
            )}
          >
            <div className="flex items-start gap-3">
              {session ? (
                <CheckCircle2
                  className="mt-0.5 size-5 shrink-0 text-emerald"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              ) : (
                <KeyRound
                  className="mt-0.5 size-5 shrink-0 text-muted"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              )}
              <div className="flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    session
                      ? "text-foreground"
                      : "text-muted",
                  )}
                >
                  Password Verified
                </p>
                <p className="mt-1 text-xs text-muted">
                  {session
                    ? "Account authenticated"
                    : "Authentication required"}
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>
    </TravelerShell>
  );
}
