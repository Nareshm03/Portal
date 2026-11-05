/**
 * Shared shape for auth form state returned by Traveler server actions.
 *
 * Kept free of server-only imports so client components can use the type and
 * the initial value without pulling the mock account store into the bundle.
 */
export interface AuthFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const INITIAL_AUTH_STATE: AuthFormState = { status: "idle" };
