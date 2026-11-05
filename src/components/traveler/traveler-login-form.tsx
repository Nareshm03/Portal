"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { loginTravelerAction } from "@/app/traveler/actions";
import { Button, Input } from "@/components/ui";

const initialState = { status: "idle" as const };

export function TravelerLoginForm() {
  const [state, formAction, pending] = useActionState(
    loginTravelerAction,
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
          htmlFor="password"
          className="block text-sm font-medium text-foreground"
        >
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending && (
          <Loader2
            className="size-4 animate-spin"
            strokeWidth={2}
            aria-hidden="true"
          />
        )}
        {pending ? "Signing in…" : "Sign in to Traveler workspace"}
      </Button>

      <p className="text-center text-xs text-muted">
        Mock authentication. Any email and password combination will succeed.
      </p>
    </form>
  );
}
