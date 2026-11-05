"use server";

import { redirect } from "next/navigation";
import type { AuthFormState } from "@/lib/auth/form-state";
import {
  signInTraveler,
  signOutTraveler,
  signUpTraveler,
} from "@/lib/auth/traveler";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSPORT_PATTERN = /^[A-Z0-9]{6,9}$/i;

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function errorState(
  fieldErrors: Record<string, string>,
  message = "Check the highlighted fields and try again.",
): AuthFormState {
  return { status: "error", message, fieldErrors };
}

export async function loginTravelerAction(
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

  const result = await signInTraveler({ email, password });

  if (!result.ok) {
    return {
      status: "error",
      message:
        result.error === "invalid-credentials"
          ? "That email and password do not match the demo traveler account."
          : "Enter a valid email and password.",
    };
  }

  redirect("/traveler/dashboard");
}

export async function registerTravelerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fullName = read(formData, "fullName");
  const email = read(formData, "email");
  const phone = read(formData, "phone");
  const baseCity = read(formData, "baseCity");
  const baseCountry = read(formData, "baseCountry");
  const password = read(formData, "password");
  const confirmPassword = read(formData, "confirmPassword");
  const passportNumber = read(formData, "passportNumber");
  const nationality = read(formData, "nationality");
  const passportExpiry = read(formData, "passportExpiry");
  const consent = formData.get("consent") === "on";

  const fieldErrors: Record<string, string> = {};

  if (fullName.length < 2) {
    fieldErrors.fullName = "Enter your full name.";
  }

  if (!email) {
    fieldErrors.email = "Enter your email address.";
  } else if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (phone.replace(/\D/g, "").length < 7) {
    fieldErrors.phone = "Enter a phone number with at least 7 digits.";
  }

  if (!baseCity) {
    fieldErrors.baseCity = "Tell us which city you are based in.";
  }

  if (!baseCountry) {
    fieldErrors.baseCountry = "Tell us which country you are based in.";
  }

  if (password.length < 8) {
    fieldErrors.password = "Use at least 8 characters.";
  }

  if (confirmPassword !== password) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (!PASSPORT_PATTERN.test(passportNumber)) {
    fieldErrors.passportNumber =
      "Use 6–9 letters or numbers for the demo passport field.";
  }

  if (!nationality) {
    fieldErrors.nationality = "Enter the nationality on your passport.";
  }

  if (!passportExpiry) {
    fieldErrors.passportExpiry = "Choose the passport expiry date.";
  } else if (passportExpiry <= today()) {
    fieldErrors.passportExpiry = "The demo passport must not be expired.";
  }

  if (!consent) {
    fieldErrors.consent =
      "Confirm that you understand this is a mock KYC step.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return errorState(fieldErrors);
  }

  /*
   * The mock auth contract only accepts name, email and password. The extra
   * profile and passport fields are validated for the demo but deliberately
   * not persisted: there is no profile or KYC store in this prototype.
   */
  const result = await signUpTraveler({
    name: fullName,
    email,
    password,
  });

  if (!result.ok) {
    if (result.error === "email-taken") {
      return errorState(
        { email: "An account already exists for this email." },
        "That email is already registered in the demo store.",
      );
    }

    return {
      status: "error",
      message:
        "The demo account could not be created. Check your details and try again.",
    };
  }

  redirect("/traveler/dashboard");
}

export async function signOutTravelerAction(): Promise<void> {
  await signOutTraveler();
  redirect("/traveler/login");
}
