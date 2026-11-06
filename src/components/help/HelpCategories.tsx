"use client";

import type { FAQCategory, FAQCategoryId } from "@/data/help-center";
import { FAQ_CATEGORIES } from "@/data/help-center";
import {
  Compass,
  ShoppingBag,
  Plane,
  PackageSearch,
  GitCompare,
  ShieldCheck,
  UserCheck,
  Scale,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

interface HelpCategoriesProps {
  selectedCategory: FAQCategoryId | "all";
  onSelectCategory: (categoryId: FAQCategoryId | "all") => void;
  categoryCounts: Record<FAQCategoryId | "all", number>;
}

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  Compass,
  ShoppingBag,
  Plane,
  PackageSearch,
  GitCompare,
  ShieldCheck,
  UserCheck,
  Scale,
};

export function HelpCategories({
  selectedCategory,
  onSelectCategory,
  categoryCounts,
}: HelpCategoriesProps) {
  return (
    <section aria-label="Browse by Category" className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">
          Browse by Topic
        </h2>
        {selectedCategory !== "all" && (
          <button
            type="button"
            onClick={() => onSelectCategory("all")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-burgundy hover:underline"
          >
            <LayoutGrid className="size-3.5" aria-hidden="true" />
            Show all topics ({categoryCounts.all})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* All Categories Card */}
        <button
          type="button"
          onClick={() => onSelectCategory("all")}
          aria-pressed={selectedCategory === "all"}
          className={`flex flex-col text-left rounded-xl border p-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy ${
            selectedCategory === "all"
              ? "border-burgundy bg-burgundy/5 shadow-[0_2px_8px_rgba(91,26,43,0.08)] ring-1 ring-burgundy/30"
              : "border-border bg-surface hover:border-champagne-strong/60 hover:bg-surface-muted"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span
              className={`grid size-9 place-items-center rounded-lg ${
                selectedCategory === "all"
                  ? "bg-burgundy text-white"
                  : "bg-champagne/20 text-champagne-strong"
              }`}
            >
              <LayoutGrid className="size-4.5" aria-hidden="true" />
            </span>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">
              {categoryCounts.all}
            </span>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">
            All Questions
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
            Explore every question across the Portal ecosystem.
          </p>
        </button>

        {/* 8 Specific Categories */}
        {FAQ_CATEGORIES.map((cat: FAQCategory) => {
          const Icon = CATEGORY_ICON_MAP[cat.icon] || Compass;
          const isSelected = selectedCategory === cat.id;
          const count = categoryCounts[cat.id] || 0;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(isSelected ? "all" : cat.id)}
              aria-pressed={isSelected}
              className={`flex flex-col text-left rounded-xl border p-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy ${
                isSelected
                  ? "border-burgundy bg-burgundy/5 shadow-[0_2px_8px_rgba(91,26,43,0.08)] ring-1 ring-burgundy/30"
                  : "border-border bg-surface hover:border-champagne-strong/60 hover:bg-surface-muted"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`grid size-9 place-items-center rounded-lg ${
                    isSelected
                      ? "bg-burgundy text-white"
                      : "bg-champagne/20 text-champagne-strong"
                  }`}
                >
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">
                  {count}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                {cat.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                {cat.description}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

