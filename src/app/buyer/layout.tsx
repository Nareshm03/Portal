import type { Metadata } from "next";
import { WORKSPACES } from "@/lib/workspaces";

const workspace = WORKSPACES.buyer;

export const metadata: Metadata = {
  title: { default: "Buyer", template: "%s · Buyer · Portal" },
  description: workspace.tagline,
};

/**
 * Workspace-level metadata only. Signed-in screens render BuyerShell and the
 * auth screens render BuyerAuthShell, so each can control its own chrome.
 */
export default function BuyerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
