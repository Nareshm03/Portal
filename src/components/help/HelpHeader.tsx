"use client";

import { PortalMark } from "@/components/shared/portal-mark";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { LayoutDashboard, Plane, ArrowLeft } from "lucide-react";

export function HelpHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <PortalMark />
          <span className="text-border-strong select-none" aria-hidden="true">
            /
          </span>
          <Badge variant="champagne" className="hidden sm:inline-flex">
            Help & Support
          </Badge>
        </div>

        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Support navigation">
          <ButtonLink
            href="/buyer/dashboard"
            variant="outline"
            size="sm"
            className="hidden text-xs sm:inline-flex"
          >
            <LayoutDashboard className="size-3.5" aria-hidden="true" />
            Buyer Dashboard
          </ButtonLink>
          <ButtonLink
            href="/traveler/dashboard"
            variant="outline"
            size="sm"
            className="hidden text-xs sm:inline-flex"
          >
            <Plane className="size-3.5" aria-hidden="true" />
            Traveler Dashboard
          </ButtonLink>
          <ButtonLink
            href="/"
            variant="ghost"
            size="sm"
            className="text-xs text-muted hover:text-burgundy"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to Portal
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
