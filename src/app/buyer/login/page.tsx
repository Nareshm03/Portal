import type { Metadata } from "next";
import { BuyerAuthShell } from "@/components/buyer/buyer-auth-shell";
import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { WORKSPACES } from "@/lib/workspaces";

export const metadata: Metadata = { title: "Buyer sign in" };

export default function BuyerLoginPage() {
  return (
    <BuyerAuthShell>
      <PlaceholderPage
        workspace={WORKSPACES.buyer}
        eyebrow="Buyer access"
        title="Sign in to your Buyer account"
        description="A dedicated entrance for Buyers to discover and acquire exceptional stays. Mock authentication is wired and ready — the sign-in form arrives in the next iteration."
        upcoming={[
          "Email and password sign-in form",
          "Buyer-scoped session cookie",
          "Redirect to the Buyer dashboard",
          "Password reset flow",
        ]}
        actions={[
          { href: "/buyer/register", label: "Create a Buyer account" },
          { href: "/buyer/dashboard", label: "Preview dashboard" },
        ]}
      />
    </BuyerAuthShell>
  );
}
