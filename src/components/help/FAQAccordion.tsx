"use client";

import type { FAQItem } from "@/data/help-center";
import { FAQ_CATEGORIES } from "@/data/help-center";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronsUpDown } from "lucide-react";

interface FAQAccordionProps {
  items: FAQItem[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function FAQAccordion({
  items,
  expandedIds,
  onToggle,
  onExpandAll,
  onCollapseAll,
}: FAQAccordionProps) {
  const categoryMap = new Map(FAQ_CATEGORIES.map((c) => [c.id, c.title]));
  const allExpanded = items.length > 0 && items.every((i) => expandedIds.has(i.id));

  return (
    <div className="w-full space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Frequently Asked Questions ({items.length})
        </span>

        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={allExpanded ? onCollapseAll : onExpandAll}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface-muted hover:text-burgundy transition-colors"
            >
              <ChevronsUpDown className="size-3.5" aria-hidden="true" />
              <span>{allExpanded ? "Collapse all" : "Expand all"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Accordion list */}
      <div className="space-y-3" role="region" aria-label="FAQ Accordion">
        {items.map((item) => {
          const isExpanded = expandedIds.has(item.id);
          const categoryTitle = categoryMap.get(item.categoryId) || item.categoryId;
          const buttonId = `faq-btn-${item.id}`;
          const contentId = `faq-content-${item.id}`;

          return (
            <div
              key={item.id}
              className={`rounded-xl border transition-all duration-200 ${
                isExpanded
                  ? "border-champagne-strong/50 bg-surface shadow-[0_2px_8px_rgba(43,10,19,0.04)]"
                  : "border-border bg-surface/80 hover:border-champagne-strong/40 hover:bg-surface"
              }`}
            >
              <button
                id={buttonId}
                type="button"
                onClick={() => onToggle(item.id)}
                aria-expanded={isExpanded}
                aria-controls={contentId}
                className="flex w-full items-start justify-between gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy rounded-xl"
              >
                <div className="space-y-1.5 pr-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-champagne-strong uppercase tracking-wider">
                      {categoryTitle}
                    </span>
                    {item.audience !== "all" && (
                      <Badge
                        variant={item.audience === "buyer" ? "burgundy" : item.audience === "traveler" ? "champagne" : "outline"}
                        className="text-[0.625rem] px-2 py-0"
                      >
                        {item.audience === "buyer" ? "Buyer" : item.audience === "traveler" ? "Traveler" : "General"}
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-base font-semibold leading-snug text-foreground sm:text-lg">
                    {item.question}
                  </h3>
                </div>

                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full border border-border bg-surface-muted transition-transform duration-200 ${
                    isExpanded ? "rotate-180 text-burgundy border-burgundy/30 bg-burgundy/5" : "text-muted"
                  }`}
                  aria-hidden="true"
                >
                  <ChevronDown className="size-4" />
                </span>
              </button>

              {isExpanded && (
                <div
                  id={contentId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="border-t border-border/60 px-5 pb-5 pt-4 text-sm leading-relaxed text-muted animate-in fade-in-50 duration-200"
                >
                  <p className="whitespace-pre-line text-foreground/90 font-normal">
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

