"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { loginBuyerAction } from "@/app/buyer/actions";
import { Button, Input } from "@/components/ui";

const initialState = { status: "idle" as const };

export function BuyerLoginForm() {
  const [state, formAction, pending] = useActionState(
    loginBuyerAction,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);

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
        <div className="relative mt-1.5">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={pending}
            placeholder="••••••••"
            className="pr-10"
            aria-invalid={showError && state.fieldErrors?.password ? "true" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={pending}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-foreground disabled:opacity-50"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="size-4" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Eye className="size-4" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        </div>
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
        {pending ? "Signing in…" : "Sign in to Buyer workspace"}
      </Button>

      <p className="text-center text-xs text-muted">
        Demo authentication · Use buyer@portal.demo / portal-demo or create a new account
      </p>
    </form>
  );
}
