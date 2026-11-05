"use client";

import { useState } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { signUpBuyer } from "@/lib/auth/buyer";
import { WORKSPACES } from "@/lib/workspaces";

interface BuyerRegisterFormProps {
  onAuthenticated?: () => void;
}

export function BuyerRegisterForm({ onAuthenticated }: BuyerRegisterFormProps = {}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await signUpBuyer({ name, email, password });
      if (result.ok) {
        if (result.requiresEmailConfirmation) {
          setEmailConfirmationRequired(true);
        } else if (onAuthenticated) {
          onAuthenticated();
        } else {
          redirect(WORKSPACES.buyer.dashboardPath);
        }
      } else {
        setError(
          result.error === "email-taken"
            ? "An account already exists for this email."
            : "Account could not be created. Please try again."
        );
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-5">
      {emailConfirmationRequired ? (
        <div className="rounded-lg border border-champagne-strong/20 bg-champagne/10 p-4">
          <p className="text-sm font-medium text-foreground">
            Account created — confirm your email
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            A confirmation email has been sent. Please confirm your email
            address before signing in.
          </p>
        </div>
      ) : (
        <form action={handleSubmit} className="grid gap-5">
          {error && (
            <div className="rounded-lg border border-red-600/20 bg-red-600/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground">
              Full name
            </label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              disabled={pending}
              placeholder="Meera Kapoor"
              className="mt-1.5"
            />
          </div>

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
              autoComplete="new-password"
              required
              disabled={pending}
              placeholder="••••••••"
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted">Minimum 8 characters</p>
          </div>

          <Button type="submit" disabled={pending} className="w-full">
            {pending && (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            )}
            {pending ? "Creating account…" : "Create Buyer account"}
          </Button>

          <p className="text-center text-xs text-muted">
            Your profile is created as a Buyer with pending status. An admin
            must provision your account before Buyer features are available.
          </p>
        </form>
      )}
    </div>
  );
}
