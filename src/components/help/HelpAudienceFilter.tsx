"use client";

import type { FAQAudience } from "@/data/help-center";
import { FAQ_AUDIENCE_OPTIONS } from "@/data/help-center";
import { Users, ShoppingBag, Plane, HelpCircle } from "lucide-react";

interface HelpAudienceFilterProps {
  selectedAudience: FAQAudience;
  onSelectAudience: (audience: FAQAudience) => void;
}

const AUDIENCE_ICONS: Record<FAQAudience, typeof Users> = {
  all: Users,
  buyer: ShoppingBag,
  traveler: Plane,
  general: HelpCircle,
};

export function HelpAudienceFilter({
  selectedAudience,
  onSelectAudience,
}: HelpAudienceFilterProps) {
  return (
    <div
      className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-border bg-surface/60 p-1.5 shadow-sm"
      role="group"
      aria-label="Filter FAQs by target audience"
    >
      {FAQ_AUDIENCE_OPTIONS.map(({ id, label }) => {
        const Icon = AUDIENCE_ICONS[id];
        const isSelected = selectedAudience === id;

        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelectAudience(id)}
            aria-pressed={isSelected}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-all ${
              isSelected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

