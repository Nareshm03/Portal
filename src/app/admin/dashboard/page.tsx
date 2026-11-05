import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { WORKSPACES } from "@/lib/workspaces";

export const metadata: Metadata = { title: "Admin dashboard" };

export default function AdminDashboardPage() {
  return (
    <PlaceholderPage
      workspace={WORKSPACES.admin}
      eyebrow="Admin workspace"
      title="Admin console"
      description="The Admin console will oversee Buyers, Travelers, listings and platform health. This screen is intentionally unbuilt for now."
      upcoming={[
        "Buyer and Traveler oversight",
        "Listing and property moderation",
        "Workspace access and invitations",
        "Platform metrics",
      ]}
      actions={[
        { href: "/admin/login", label: "Go to sign in" },
        { href: "/", label: "Back to the entrance" },
      ]}
    />
  );
}
