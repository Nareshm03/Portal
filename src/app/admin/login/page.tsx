import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { WORKSPACES } from "@/lib/workspaces";

export const metadata: Metadata = { title: "Admin sign in" };

export default function AdminLoginPage() {
  return (
    <PlaceholderPage
      workspace={WORKSPACES.admin}
      eyebrow="Administrator access"
      title="Sign in to the Admin console"
      description="Admin access is invite-only; there is no public registration. Mock authentication is wired and ready — the sign-in form arrives in the next iteration."
      upcoming={[
        "Email and password sign-in form",
        "Admin-scoped session cookie",
        "Redirect to the Admin dashboard",
        "Audit logging",
      ]}
      actions={[
        { href: "/admin/dashboard", label: "Preview dashboard" },
        { href: "/", label: "Back to the entrance" },
      ]}
    />
  );
}
