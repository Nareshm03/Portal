import type { Metadata } from "next";
import { BuyerAuthShell } from "@/components/buyer/buyer-auth-shell";
import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { WORKSPACES } from "@/lib/workspaces";

export const metadata: Metadata = { title: "Buyer registration" };

export default function BuyerRegisterPage() {
  return (
    <BuyerAuthShell>
      <PlaceholderPage
        workspace={WORKSPACES.buyer}
        eyebrow="Buyer registration"
        title="Create your Buyer account"
        description="Registration is reserved for Buyers. Accounts are created in an isolated Buyer store and can never be used to enter the Traveler or Admin workspaces."
        upcoming={[
          "Name, email and password form",
          "Client-side validation",
          "Duplicate email detection",
          "Automatic sign-in after registration",
        ]}
        actions={[
          { href: "/buyer/login", label: "Already registered? Sign in" },
          { href: "/buyer/dashboard", label: "Preview dashboard" },
        ]}
      />
    </BuyerAuthShell>
  );
}
