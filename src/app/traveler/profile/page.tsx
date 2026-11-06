"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, Globe, Mail, MapPin, Phone, Plane, Shield, Star, KeyRound, AlertCircle, Upload, Loader2 } from "lucide-react";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { SectionHeading, ButtonLink, LoadingState } from "@/components/ui";
import {
  getInitials,
  passportKyc as demoPassportKyc,
  travelerProfile as demoTravelerProfile,
} from "@/lib/demo/traveler";
import { cn } from "@/lib/utils";
import { DocumentUpload } from "@/components/traveler/document-upload";
import { supabase } from "@/lib/supabase/client";
import { createProxiedApiClient, ApiError } from "@/lib/api/client";

interface BackendProfile {
  id: string;
  full_name: string | null;
  role: string;
  account_status: string;
  kyc_status: string;
  created_at: string | null;
}

interface KycUploadProps {
  documentType: "passport" | "selfie" | "address";
  label: string;
  acceptedFormats: string[];
  onUpload: (file: File) => Promise<void>;
  currentStatus: string;
}

function KycDocumentUpload({
  documentType,
  label,
  acceptedFormats,
  onUpload,
  currentStatus,
}: KycUploadProps) {
  const [document, setDocument] = useState<{ name: string; size: number; type: string; uploadedAt: string; status: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateFile = (file: File): string | null => {
    const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!acceptedFormats.includes(fileExtension)) {
      return `Invalid file type. Accepted formats: ${acceptedFormats.join(", ")}`;
    }
    if (file.size > 5 * 1024 * 1024) {
      return "File size exceeds 5 MB limit";
    }
    return null;
  };

  const handleFileSelect = async (file: File) => {
    setError(null);
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsUploading(true);
    try {
      await onUpload(file);
      setDocument({
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        status: "uploaded",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  if (document) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-emerald/40 bg-emerald/10">
            <Upload className="size-5 text-emerald" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground truncate">{document.name}</p>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                Uploaded - Pending Review
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {formatFileSize(document.size)} · Uploaded {new Date(document.uploadedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(",")}
          onChange={handleFileInput}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFileSelect(file);
        }}
        onDragOver={(e) => e.preventDefault()}
        className="relative rounded-lg border-2 border-dashed p-6 transition-colors hover:border-champagne/40 hover:bg-surface-muted/30"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="grid size-12 place-items-center rounded-lg border border-border bg-surface-muted">
            <Upload className="size-6 text-muted" strokeWidth={1.75} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Drag and drop your {label.toLowerCase()} here</p>
            <p className="mt-1 text-xs text-muted">
              or{" "}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-medium text-champagne-strong underline-offset-2 hover:underline"
              >
                browse files
              </button>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {acceptedFormats.join(", ").toUpperCase()} · Max 5 MB
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(",")}
          onChange={handleFileInput}
          className="hidden"
          disabled={isUploading}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-600/30 bg-red-50/50 px-3 py-2 text-xs text-red-800">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

export default function TravelerProfilePage() {
  const [profile, setProfile] = useState<BackendProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [submittingKyc, setSubmittingKyc] = useState(false);
  const [kycSubmitError, setKycSubmitError] = useState<string | null>(null);
  const [kycUploadError, setKycUploadError] = useState<string | null>(null);
  const fileInputRefPassport = useRef<HTMLInputElement>(null);
  const fileInputRefSelfie = useRef<HTMLInputElement>(null);
  const fileInputRefAddress = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    setIsLoading(true);
    setProfileError(null);
    try {
      if (!supabase) {
        setDemoMode(true);
        setIsLoading(false);
        return;
      }
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setDemoMode(true);
        setIsLoading(false);
        return;
      }
      const api = createProxiedApiClient();
      const result = await api.request("/me", { token });
      if (result.demo) {
        setDemoMode(true);
        setIsLoading(false);
        return;
      }
      const data = result.body as { data: BackendProfile };
      setProfile(data?.data ?? null);
    } catch (err) {
      if (err instanceof ApiError && err.demo) {
        setDemoMode(true);
      } else {
        setProfileError(err instanceof Error ? err.message : "Failed to load profile.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleKycSubmit = async () => {
    setSubmittingKyc(true);
    setKycSubmitError(null);
    try {
      if (!supabase) {
        setKycSubmitError("Supabase not configured.");
        return;
      }
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setKycSubmitError("Not authenticated.");
        return;
      }
      const api = createProxiedApiClient();
      await api.POST("/kyc/submit", { providerReference: `demo-${Date.now()}` }, { token });
      setSubmittingKyc(false);
      await fetchProfile(); // Refresh to show SUBMITTED status
    } catch (err) {
      setSubmittingKyc(false);
      setKycSubmitError(err instanceof Error ? err.message : "KYC submission failed.");
    }
  };

  const fullName = profile?.full_name ?? demoTravelerProfile.fullName;
  const baseCity = profile?.full_name ? "Portal-connected" : demoTravelerProfile.baseCity;
  const baseCountry = profile?.full_name ? "India" : demoTravelerProfile.baseCountry;
  const kycStatus = profile?.kyc_status ?? demoPassportKyc.status;
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : demoTravelerProfile.memberSince;
  const email = profile?.full_name ? (profile.id ? "connected@portal.demo" : "") : demoTravelerProfile.email;

  if (isLoading) {
    return (
      <TravelerShell active="profile">
        <LoadingState />
      </TravelerShell>
    );
  }

  return (
    <TravelerShell active="profile">
      {demoMode && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-champagne-strong/20 bg-champagne/10 px-3 py-2 text-[0.6875rem] leading-relaxed text-champagne-ink">
          <span className="mt-0.5 size-3.5 shrink-0 text-champagne-strong" aria-hidden="true">●</span>
          Demo mode — backend unavailable. Sample profile data shown.
        </div>
      )}
      {profileError && demoMode && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {profileError}
        </div>
      )}
      {kycSubmitError && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {kycSubmitError}
        </div>
      )}

      <header>
        <p className="eyebrow">Account details</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Profile & passport KYC</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Your profile, contact details and passport verification status for the Portal Traveler workspace.
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
              {getInitials(fullName)}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-medium text-ivory">{fullName}</h2>
              <p className="mt-1 text-sm text-ivory/60">{baseCity}, {baseCountry}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-champagne/40 bg-champagne/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-champagne">
                  <Star className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  Founding traveler
                </span>
                <span className="text-xs text-ivory/50">Member since {memberSince}</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="flex items-center gap-2">
                <Star className="size-4 fill-champagne text-champagne" strokeWidth={1.75} aria-hidden="true" />
                <span className="text-2xl font-medium tabular-nums text-champagne">4.9</span>
              </div>
              <p className="mt-1 text-xs text-ivory/60">18 carries</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact details ─────────────────────────────────────────────── */}
      <section className="mt-8">
        <SectionHeading eyebrow="Contact" title="Contact details" description="Your registered email, phone and location information." />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Email</p>
                  <p className="mt-1.5 text-sm text-foreground">{email}</p>
                </div>
              </div>
            </div>
          </article>
          <article className="rounded-2xl border border-border bg-surface p-5 sm:col-span-2">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Base location</p>
                  <p className="mt-1.5 text-sm text-foreground">{baseCity}, {baseCountry}</p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ── Passport KYC ────────────────────────────────────────────────── */}
      <section className="mt-12">
        <SectionHeading eyebrow="Identity verification" title="Passport KYC" description="Your passport verification status and document checklist." />

        <div className={cn("mt-6 overflow-hidden rounded-2xl border p-6", kycStatus === "VERIFIED" ? "border-champagne/30 bg-champagne/5" : "border-border bg-surface")}>
          <div className="flex items-start gap-4">
            <div className={cn("grid size-12 shrink-0 place-items-center rounded-xl border", kycStatus === "VERIFIED" ? "border-champagne/40 bg-champagne/15" : "border-border bg-surface-muted")}>
              <Shield className={cn("size-6", kycStatus === "VERIFIED" ? "text-champagne-strong" : "text-muted")} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium text-foreground">Passport KYC</h3>
                {kycStatus === "VERIFIED" && <CheckCircle2 className="size-5 text-champagne-strong" strokeWidth={2} aria-hidden="true" />}
              </div>
              <p className="mt-1 text-xs text-muted">
                Verification status:{ " "}
                <span className="font-medium text-foreground">
                  {kycStatus === "VERIFIED" ? "Verified" : kycStatus === "SUBMITTED" ? "Submitted — pending review" : "Not submitted"}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Passport number</p>
              <p className="mt-1 font-mono text-foreground">•••• 4821</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nationality</p>
              <p className="mt-1 text-foreground">British</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Issuing country</p>
              <p className="mt-1 text-foreground">United Kingdom</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Expiry date</p>
              <p className="mt-1 text-foreground">2031-08-14</p>
            </div>
          </div>

          {/* Document uploads */}
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Required Documents</p>
            <div className="mt-3 grid gap-4">
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted">
                    <Upload className="size-5 text-muted" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Passport Photo Page</p>
                    <p className="mt-1 text-xs text-muted">.jpg, .jpeg, .png, .pdf · Max 5 MB</p>
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => fileInputRefPassport.current?.click()}
                      disabled={submittingKyc}
                      className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Choose file
                    </button>
                  </div>
                </div>
                <input
                  ref={fileInputRefPassport}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setKycUploadError(
                        "KYC document upload requires a backend submission ID. " +
                          "Please submit KYC first, then document upload will be available " +
                          "once a kyc_submissions record exists.",
                      );
                    }
                  }}
                  className="hidden"
                />
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted">
                    <Upload className="size-5 text-muted" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Selfie Match</p>
                    <p className="mt-1 text-xs text-muted">.jpg, .jpeg, .png · Max 5 MB</p>
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => fileInputRefSelfie.current?.click()}
                      disabled={submittingKyc}
                      className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Choose file
                    </button>
                  </div>
                </div>
                <input
                  ref={fileInputRefSelfie}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setKycUploadError(
                        "KYC document upload requires a backend submission ID. " +
                          "Please submit KYC first.",
                      );
                    }
                  }}
                  className="hidden"
                />
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted">
                    <Upload className="size-5 text-muted" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Address Confirmation</p>
                    <p className="mt-1 text-xs text-muted">.jpg, .jpeg, .png, .pdf · Max 5 MB</p>
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => fileInputRefAddress.current?.click()}
                      disabled={submittingKyc}
                      className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Choose file
                    </button>
                  </div>
                </div>
                <input
                  ref={fileInputRefAddress}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setKycUploadError(
                        "KYC document upload requires a backend submission ID. " +
                          "Please submit KYC first.",
                      );
                    }
                  }}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-champagne/20 bg-champagne/5 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-blue-500" strokeWidth={2} aria-hidden="true" />
              <p className="text-xs leading-relaxed text-muted">
                <strong className="font-semibold text-foreground">Demo Mode:</strong>{" "}
                {demoMode ? "Document uploads are simulated." : "Document uploads require a backend KYC submission record."}
              </p>
            </div>
          </div>

          {/* KYC Submit button */}
          <div className="mt-6">
            <button
              type="button"
              disabled={submittingKyc || kycStatus === "VERIFIED" || kycStatus === "SUBMITTED"}
              onClick={handleKycSubmit}
              className={cn(
                "w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                submittingKyc || kycStatus === "VERIFIED" || kycStatus === "SUBMITTED"
                  ? "bg-surface-muted text-muted cursor-not-allowed"
                  : "bg-burgundy-deep text-ivory hover:bg-burgundy-ink",
              )}
            >
              {submittingKyc ? "Submitting…" : kycStatus === "VERIFIED" ? "KYC Verified" : kycStatus === "SUBMITTED" ? "Submitted — Pending Review" : "Submit KYC for Review"}
            </button>
            {kycStatus === "SUBMITTED" && (
              <p className="mt-2 text-xs text-muted">Your KYC submission is under review. You will be notified when a decision is made.</p>
            )}
            {kycStatus === "VERIFIED" && (
              <p className="mt-2 text-xs text-emerald-600">Your identity has been verified. You can now register trips.</p>
            )}
          </div>
        </div>
      </section>
    </TravelerShell>
  );
}
