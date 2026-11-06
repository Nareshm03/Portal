import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { MessageSquare, LayoutDashboard, Plane } from "lucide-react";

export function HelpContactCard() {
  return (
    <Card className="border-champagne-strong/40 bg-gradient-to-br from-surface to-surface-muted shadow-sm">
      <CardContent className="flex flex-col items-center justify-between gap-6 p-6 sm:flex-row sm:p-8">
        <div className="space-y-1.5 text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <span className="grid size-8 place-items-center rounded-full bg-champagne/25 text-champagne-strong">
              <MessageSquare className="size-4" aria-hidden="true" />
            </span>
            <h3 className="font-serif text-lg font-medium text-foreground">
              Still have questions?
            </h3>
          </div>
          <p className="max-w-md text-xs sm:text-sm text-muted leading-relaxed">
            Can&apos;t find what you&apos;re looking for? Return to your workspace or explore active order support directly within Portal.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <ButtonLink
            href="/buyer/dashboard"
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <LayoutDashboard className="size-3.5" aria-hidden="true" />
            Buyer Workspace
          </ButtonLink>
          <ButtonLink
            href="/traveler/dashboard"
            variant="champagne"
            size="sm"
            className="text-xs"
          >
            <Plane className="size-3.5" aria-hidden="true" />
            Traveler Workspace
          </ButtonLink>
        </div>
      </CardContent>
    </Card>
  );
}
