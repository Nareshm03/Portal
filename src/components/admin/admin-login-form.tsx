"use client";

import { useState } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { signInAdmin } from "@/lib/auth/admin";
import { WORKSPACES } from "@/lib/workspaces";

interface AdminLoginFormProps {
  onAuthenticated?: () => void;
}

export function AdminLoginForm({ onAuthenticated }: AdminLoginFormProps = {}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await signInAdmin({ email, password });
      if (result.ok) {
        if (onAuthenticated) {
          onAuthenticated();
        } else {
          redirect(WORKSPACES.admin.dashboardPath);
        }
      } else {
        setError(
          result.error === "not-authorized"
            ? "This account is not authorised for the Admin workspace. Admin access is invite-only."
            : "Email or password is incorrect."
        );
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="grid gap-5">
      {error && (
        <div className="rounded-lg border border-red-600/20 bg-red-600/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
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
          aria-invalid={error ? "true" : undefined}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground">
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
          aria-invalid={error ? "true" : undefined}
        />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending && (
          <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
        )}
        {pending ? "Signing in…" : "Sign in to Admin console"}
      </Button>

      <p className="text-center text-xs text-muted">
        Admin access is invite-only. Accounts are provisioned by an existing
        admin; there is no public registration.
      </p>
    </form>
  );
}
