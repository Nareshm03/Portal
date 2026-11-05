import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { WORKSPACES } from "@/lib/workspaces";

export const metadata: Metadata = { title: "Traveler dashboard" };

export default function TravelerDashboardPage() {
  return (
    <PlaceholderPage
      workspace={WORKSPACES.traveler}
      eyebrow="Traveler workspace"
      title="Your Traveler dashboard"
      description="The Traveler dashboard will gather curated itineraries, reservations and property notes. This screen is intentionally unbuilt for now."
      upcoming={[
        "Upcoming journeys and itineraries",
        "Saved stays and private notes",
        "Reservation timeline",
        "Travel preferences",
      ]}
      actions={[
        { href: "/traveler/login", label: "Go to sign in" },
        { href: "/", label: "Back to the entrance" },
      ]}
    />
  );
}
