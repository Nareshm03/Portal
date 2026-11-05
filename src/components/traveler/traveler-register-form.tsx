"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { registerTravelerAction } from "@/app/traveler/actions";
import { Button, Input } from "@/components/ui";

const initialState = { status: "idle" as const };

export function TravelerRegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerTravelerAction,
    initialState,
  );

  const showError = state.status === "error";

  return (
    <form action={formAction} className="grid gap-5">
      {showError && state.message && (
        <div className="rounded-lg border border-red-600/20 bg-red-600/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {state.message}
        </div>
      )}

      <div>
        <label
          htmlFor="fullName"
          className="block text-sm font-medium text-foreground"
        >
          Full name
        </label>
        <Input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          disabled={pending}
          placeholder="Meera Kapoor"
          className="mt-1.5"
          aria-invalid={showError && state.fieldErrors?.fullName ? "true" : undefined}
        />
        {showError && state.fieldErrors?.fullName && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
            {state.fieldErrors.fullName}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground"
        >
          Email address
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          placeholder="your@email.com"
          className="mt-1.5"
          aria-invalid={showError && state.fieldErrors?.email ? "true" : undefined}
        />
        {showError && state.fieldErrors?.email && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
            {state.fieldErrors.email}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="phone"
          className="block text-sm font-medium text-foreground"
        >
          Phone number
        </label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          disabled={pending}
          placeholder="+44 7700 900000"
          className="mt-1.5"
          aria-invalid={showError && state.fieldErrors?.phone ? "true" : undefined}
        />
        {showError && state.fieldErrors?.phone && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
            {state.fieldErrors.phone}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="baseCity"
            className="block text-sm font-medium text-foreground"
          >
            Base city
          </label>
          <Input
            id="baseCity"
            name="baseCity"
            type="text"
            required
            disabled={pending}
            placeholder="London"
            className="mt-1.5"
            aria-invalid={showError && state.fieldErrors?.baseCity ? "true" : undefined}
          />
          {showError && state.fieldErrors?.baseCity && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.baseCity}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="baseCountry"
            className="block text-sm font-medium text-foreground"
          >
            Base country
          </label>
          <Input
            id="baseCountry"
            name="baseCountry"
            type="text"
            required
            disabled={pending}
            placeholder="United Kingdom"
            className="mt-1.5"
            aria-invalid={showError && state.fieldErrors?.baseCountry ? "true" : undefined}
          />
          {showError && state.fieldErrors?.baseCountry && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.baseCountry}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground"
          >
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            disabled={pending}
            placeholder="••••••••"
            className="mt-1.5"
            aria-invalid={showError && state.fieldErrors?.password ? "true" : undefined}
          />
          {showError && state.fieldErrors?.password && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.password}
            </p>
          )}
          {!showError && (
            <p className="mt-1.5 text-xs text-muted">Minimum 8 characters</p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-foreground"
          >
            Confirm password
          </label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            disabled={pending}
            placeholder="••••••••"
            className="mt-1.5"
            aria-invalid={showError && state.fieldErrors?.confirmPassword ? "true" : undefined}
          />
          {showError && state.fieldErrors?.confirmPassword && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.confirmPassword}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-champagne-strong/20 bg-champagne/10 p-4">
        <p className="text-sm font-medium text-foreground">
          Mock passport KYC
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Registration includes simulated identity verification. No passport is
          uploaded, verified or stored in this demo.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="passportNumber"
              className="block text-xs font-medium text-foreground"
            >
              Passport number
            </label>
            <Input
              id="passportNumber"
              name="passportNumber"
              type="text"
              required
              disabled={pending}
              placeholder="A1234567"
              className="mt-1.5"
              aria-invalid={showError && state.fieldErrors?.passportNumber ? "true" : undefined}
            />
            {showError && state.fieldErrors?.passportNumber && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                {state.fieldErrors.passportNumber}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="nationality"
              className="block text-xs font-medium text-foreground"
            >
              Nationality
            </label>
            <Input
              id="nationality"
              name="nationality"
              type="text"
              required
              disabled={pending}
              placeholder="British"
              className="mt-1.5"
              aria-invalid={showError && state.fieldErrors?.nationality ? "true" : undefined}
            />
            {showError && state.fieldErrors?.nationality && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                {state.fieldErrors.nationality}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label
            htmlFor="passportExpiry"
            className="block text-xs font-medium text-foreground"
          >
            Passport expiry date
          </label>
          <Input
            id="passportExpiry"
            name="passportExpiry"
            type="date"
            required
            disabled={pending}
            className="mt-1.5"
            aria-invalid={showError && state.fieldErrors?.passportExpiry ? "true" : undefined}
          />
          {showError && state.fieldErrors?.passportExpiry && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.passportExpiry}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2">
          <input
            type="checkbox"
            id="consent"
            name="consent"
            required
            disabled={pending}
            className="mt-0.5 size-4 rounded border-border accent-burgundy"
            aria-invalid={showError && state.fieldErrors?.consent ? "true" : undefined}
          />
          <label htmlFor="consent" className="text-xs text-muted">
            I understand this is a mock KYC verification for demonstration only
          </label>
        </div>
        {showError && state.fieldErrors?.consent && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
            {state.fieldErrors.consent}
          </p>
        )}
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending && (
          <Loader2
            className="size-4 animate-spin"
            strokeWidth={2}
            aria-hidden="true"
          />
        )}
        {pending ? "Creating account…" : "Create Traveler account"}
      </Button>

      <p className="text-center text-xs text-muted">
        Mock registration. Any details will succeed and create a demo session.
      </p>
    </form>
  );
}
