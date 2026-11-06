"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { AuthFormState } from "@/lib/auth/form-state";
import {
  signInBuyer,
  signOutBuyer,
  signUpBuyer,
} from "@/lib/auth/buyer";
import { createSession, destroySession } from "@/lib/auth/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function errorState(
  fieldErrors: Record<string, string>,
  message = "Check the highlighted fields and try again.",
): AuthFormState {
  return { status: "error", message, fieldErrors };
}

export async function loginBuyerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = read(formData, "email");
  const password = read(formData, "password");
  const fieldErrors: Record<string, string> = {};

  if (!email) {
    fieldErrors.email = "Enter your email address.";
  } else if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (!password) {
    fieldErrors.password = "Enter your password.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return errorState(fieldErrors);
  }

  const result = await signInBuyer({ email, password });

  if (!result.ok) {
    return {
      status: "error",
      message:
        result.error === "invalid-credentials"
          ? "That email and password combination was not found. Try again or create a new account."
          : "Enter a valid email and password.",
    };
  }

  // Create a mock workspace session so the middleware (proxy.ts) recognises
  // the signed-in buyer. Supabase remains the auth authority; the cookie is
  // only for middleware path gating.
  if (result.user) {
    try {
      await createSession({
        user: {
          id: result.user.id,
          name: result.user.email ?? "",
          email: result.user.email ?? "",
          workspace: "buyer",
        },
        issuedAt: Date.now(),
      });
    } catch {
      // Cookie setting may fail in some server contexts; non-fatal.
    }
  }

  redirect("/buyer/dashboard");
}

export async function registerBuyerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fullName = read(formData, "fullName");
  const email = read(formData, "email");
  const password = read(formData, "password");
  const confirmPassword = read(formData, "confirmPassword");

  const fieldErrors: Record<string, string> = {};

  if (fullName.length < 2) {
    fieldErrors.fullName = "Enter your full name.";
  }

  if (!email) {
    fieldErrors.email = "Enter your email address.";
  } else if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (password.length < 8) {
    fieldErrors.password = "Use at least 8 characters.";
  }

  if (confirmPassword !== password) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return errorState(fieldErrors);
  }

  const result = await signUpBuyer({
    name: fullName,
    email,
    password,
  });

  if (!result.ok) {
    if (result.error === "email-taken") {
      return errorState(
        { email: "An account already exists for this email." },
        "That email is already registered. Sign in instead or use a different email.",
      );
    }

    return {
      status: "error",
      message:
        "The account could not be created. Check your details and try again.",
    };
  }

  // Create a mock workspace session so the middleware recognises the new buyer.
  if (result.user) {
    try {
      await createSession({
        user: {
          id: result.user.id,
          name: fullName,
          email,
          workspace: "buyer",
        },
        issuedAt: Date.now(),
      });
    } catch {
      // Non-fatal.
    }
  }

  redirect("/buyer/dashboard");
}

export async function signOutBuyerAction(): Promise<void> {
  await signOutBuyer();
  try {
    await destroySession("buyer");
  } catch {
    // Non-fatal.
  }
  redirect("/buyer/login");
}
