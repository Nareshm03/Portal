"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Globe, Mail, MapPin, Phone, Plane, Star, Eye, EyeOff, X } from "lucide-react";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { SectionHeading } from "@/components/ui";
import { airportLabel, buyerProfile, getInitials } from "@/lib/demo/buyer";

// Available product categories for selection
const AVAILABLE_CATEGORIES = {
  "Shopping & Products": [
    "Cameras & Optics",
    "Designer Fashion",
    "Fragrance & Beauty",
    "Watches & Accessories",
    "Electronics & Gadgets",
    "Luxury Handbags",
    "Footwear",
    "Jewellery",
  ],
  "Food & Lifestyle": [
    "Restaurants & Dining",
    "Groceries & Food Products",
    "Home & Kitchen",
    "Travel & Experiences",
  ],
} as const;

const DEFAULT_CATEGORIES = [
  "Cameras & Optics",
  "Designer Fashion",
  "Fragrance & Beauty",
];

const STORAGE_KEY = "buyer-preferred-categories";

// Load categories from localStorage
function loadSavedCategories(): string[] {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load saved categories", e);
  }
  
  return DEFAULT_CATEGORIES;
}

export default function BuyerProfilePage() {
  const router = useRouter();
  
  // Category selection state with localStorage persistence
  const [isEditingCategories, setIsEditingCategories] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(loadSavedCategories);
  const [categorySuccess, setCategorySuccess] = useState(false);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Handle category toggle
  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  // Handle save categories
  const handleSaveCategories = () => {
    // Persist to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedCategories));
    setIsEditingCategories(false);
    setCategorySuccess(true);
    setTimeout(() => setCategorySuccess(false), 3000);
  };

  // Handle password change
  const handlePasswordChange = () => {
    setPasswordError("");
    
    // Validation
    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
      setPasswordError("All fields are required");
      return;
    }

    if (passwordForm.new.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError("New password and confirmation do not match");
      return;
    }

    // In a real app, this would call the backend API
    // For demo purposes, we'll just show success
    setPasswordSuccess(true);
    setPasswordForm({ current: "", new: "", confirm: "" });
    setTimeout(() => {
      setPasswordSuccess(false);
      setShowPasswordForm(false);
    }, 2000);
  };

  return (
    <BuyerShell active="account">
      <header>
        <p className="eyebrow">Account management</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">
          Profile & settings
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Your buyer profile, contact details, verification status, and account
          preferences.
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
              {getInitials(buyerProfile.fullName)}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-medium text-ivory">
                {buyerProfile.fullName}
              </h2>
              <p className="mt-1 text-sm text-ivory/60">
                {buyerProfile.city}, {buyerProfile.country}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-champagne/40 bg-champagne/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-champagne">
                  <Star
                    className="size-3.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  {buyerProfile.tier}
                </span>
                <span className="text-xs text-ivory/50">
                  Member since {buyerProfile.memberSince}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact details with verification checkmarks ────────────────── */}
      <section className="mt-8">
        <SectionHeading
          eyebrow="Contact"
          title="Contact information"
          description="Your registered email, phone and location details."
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
                  <CheckCircle2
                    className="size-4 text-green-600"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1.5 text-sm text-foreground">
                  {buyerProfile.email}
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
                  <CheckCircle2
                    className="size-4 text-green-600"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1.5 text-sm text-foreground">
                  {buyerProfile.phone}
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
                    Location
                  </p>
                  <CheckCircle2
                    className="size-4 text-green-600"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1.5 text-sm text-foreground">
                  {buyerProfile.city}, {buyerProfile.country}
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
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Nearest airport
                </p>
                <p className="mt-1.5 text-sm text-foreground">
                  {airportLabel(buyerProfile.nearestAirport)}
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ── Verification status (KYC only) ──────────────────────────────── */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Trust & safety"
          title="Verification status"
          description="Your account verification and KYC compliance status."
        />

        <div className="mt-6">
          <article className="rounded-2xl border border-green-600/30 bg-green-50/50 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0 text-green-600"
                strokeWidth={2}
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">KYC Status</p>
                <p className="mt-1 text-xs text-muted">
                  {buyerProfile.kyc}
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ── Preferred categories with selection ─────────────────────────── */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Shopping preferences"
          title="Preferred categories"
          description="Product categories you typically request."
        />

        {categorySuccess && (
          <div className="mt-4 rounded-lg border border-green-600/30 bg-green-50/50 px-4 py-3 text-sm text-green-800">
            ✓ Your category preferences have been saved successfully
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-start gap-3">
            <Globe
              className="mt-0.5 size-5 shrink-0 text-muted"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  Your preferred categories
                </p>
                {!isEditingCategories && (
                  <button
                    type="button"
                    onClick={() => setIsEditingCategories(true)}
                    className="text-xs font-medium text-burgundy-deep transition-colors hover:text-burgundy-ink"
                  >
                    Edit Categories
                  </button>
                )}
              </div>

              {!isEditingCategories ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedCategories.length > 0 ? (
                    selectedCategories.map((category) => (
                      <span
                        key={category}
                        className="rounded-full border border-champagne/30 bg-champagne/10 px-3 py-1 text-xs font-medium text-champagne-ink"
                      >
                        {category}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-muted">
                      No categories selected. Click &ldquo;Edit Categories&rdquo; to choose your preferences.
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-5">
                  {Object.entries(AVAILABLE_CATEGORIES).map(([group, categories]) => (
                    <div key={group}>
                      <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {group}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {categories.map((category) => {
                          const isSelected = selectedCategories.includes(category);
                          return (
                            <button
                              key={category}
                              type="button"
                              onClick={() => toggleCategory(category)}
                              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                                isSelected
                                  ? "border-burgundy-deep bg-burgundy-deep text-ivory shadow-sm"
                                  : "border-champagne/40 bg-champagne/5 text-champagne-ink hover:border-burgundy-deep/50 hover:bg-champagne/15"
                              }`}
                            >
                              {category}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveCategories}
                      className="rounded-lg bg-burgundy-deep px-5 py-2 text-xs font-medium text-ivory transition-colors hover:bg-burgundy-ink"
                    >
                      Save Preferences
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingCategories(false)}
                      className="rounded-lg border border-border bg-surface px-5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Account settings (Notifications & Password only) ────────────── */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Account settings"
          title="Manage your account"
          description="Update notifications and password settings."
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* Notifications - navigates to Messages */}
          <article
            onClick={() => router.push("/buyer/messages")}
            className="cursor-pointer rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-burgundy-deep/30 hover:bg-burgundy-deep/5"
          >
            <h3 className="text-sm font-semibold text-foreground">
              Notifications
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              View your messages and receive updates from matched travelers
              regarding quotes, requests, and orders.
            </p>
            <div className="mt-3 text-xs font-medium text-burgundy-deep">
              Go to Messages →
            </div>
          </article>

          {/* Password - opens change password form */}
          <article
            onClick={() => setShowPasswordForm(true)}
            className="cursor-pointer rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-burgundy-deep/30 hover:bg-burgundy-deep/5"
          >
            <h3 className="text-sm font-semibold text-foreground">Password</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Change your account password or enable two-factor authentication.
            </p>
            <div className="mt-3 text-xs font-medium text-burgundy-deep">
              Change Password →
            </div>
          </article>
        </div>
      </section>

      {/* ── Password change modal ───────────────────────────────────────── */}
      {showPasswordForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setShowPasswordForm(false);
                setPasswordForm({ current: "", new: "", confirm: "" });
                setPasswordError("");
                setPasswordSuccess(false);
              }}
              className="absolute right-4 top-4 text-muted transition-colors hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-5" strokeWidth={1.75} />
            </button>

            <h2 className="text-xl font-semibold text-foreground">
              Change Password
            </h2>
            <p className="mt-1 text-xs text-muted">
              Enter your current password and choose a new one.
            </p>

            {passwordSuccess ? (
              <div className="mt-6 rounded-lg border border-green-600/30 bg-green-50/50 px-4 py-3 text-sm text-green-800">
                ✓ Password updated successfully
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handlePasswordChange();
                }}
                className="mt-6 space-y-4"
              >
                {passwordError && (
                  <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {passwordError}
                  </div>
                )}

                {/* Current Password */}
                <div>
                  <label
                    htmlFor="current-password"
                    className="block text-xs font-medium text-foreground"
                  >
                    Current Password
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id="current-password"
                      type={showPassword.current ? "text" : "password"}
                      value={passwordForm.current}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, current: e.target.value })
                      }
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 pr-10 text-sm text-foreground transition-colors focus:border-burgundy-deep focus:outline-none focus:ring-1 focus:ring-burgundy-deep"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword({
                          ...showPassword,
                          current: !showPassword.current,
                        })
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    >
                      {showPassword.current ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-xs font-medium text-foreground"
                  >
                    New Password
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id="new-password"
                      type={showPassword.new ? "text" : "password"}
                      value={passwordForm.new}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, new: e.target.value })
                      }
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 pr-10 text-sm text-foreground transition-colors focus:border-burgundy-deep focus:outline-none focus:ring-1 focus:ring-burgundy-deep"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword({
                          ...showPassword,
                          new: !showPassword.new,
                        })
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    >
                      {showPassword.new ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-[0.6875rem] text-muted">
                    Minimum 8 characters
                  </p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-xs font-medium text-foreground"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id="confirm-password"
                      type={showPassword.confirm ? "text" : "password"}
                      value={passwordForm.confirm}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, confirm: e.target.value })
                      }
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 pr-10 text-sm text-foreground transition-colors focus:border-burgundy-deep focus:outline-none focus:ring-1 focus:ring-burgundy-deep"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword({
                          ...showPassword,
                          confirm: !showPassword.confirm,
                        })
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    >
                      {showPassword.confirm ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-burgundy-deep px-4 py-2.5 text-sm font-medium text-ivory transition-colors hover:bg-burgundy-ink"
                  >
                    Update Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordForm({ current: "", new: "", confirm: "" });
                      setPasswordError("");
                    }}
                    className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </BuyerShell>
  );
}
