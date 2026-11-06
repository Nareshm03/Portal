import type { Metadata } from "next";
import { WORKSPACES } from "@/lib/workspaces";

const workspace = WORKSPACES.traveler;

export const metadata: Metadata = {
  title: { default: "Traveler", template: "%s · Traveler · Portal" },
  description: workspace.tagline,
};

/**
 * Workspace-level metadata only. Signed-in screens render TravelerShell and
 * auth screens render TravelerAuthShell, so each can control its own chrome.
 */
export default function TravelerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
