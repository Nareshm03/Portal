"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  FAQ_ITEMS,
  FAQ_CATEGORIES,
  type FAQAudience,
  type FAQCategoryId,
} from "@/data/help-center";
import { HelpHeader } from "@/components/help/HelpHeader";
import { HelpSearch } from "@/components/help/HelpSearch";
import { HelpCategories } from "@/components/help/HelpCategories";
import { HelpAudienceFilter } from "@/components/help/HelpAudienceFilter";
import { FAQAccordion } from "@/components/help/FAQAccordion";
import { HelpContactCard } from "@/components/help/HelpContactCard";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SearchX, RotateCcw, HelpCircle, ArrowLeft } from "lucide-react";

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FAQCategoryId | "all">("all");
  const [selectedAudience, setSelectedAudience] = useState<FAQAudience>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();

  // Compute category counts based on current audience filter
  const categoryCounts = useMemo(() => {
    const counts: Record<FAQCategoryId | "all", number> = {
      all: 0,
      "getting-started": 0,
      "buyer-guide": 0,
      "traveler-guide": 0,
      "trips-requests": 0,
      "quotes-matching": 0,
      "payments-orders": 0,
      "account-verification": 0,
      "safety-policies": 0,
    };

    FAQ_ITEMS.forEach((item) => {
      const matchesAudience =
        selectedAudience === "all" ||
        item.audience === selectedAudience ||
        item.audience === "all" ||
        item.audience === "general";

      if (matchesAudience) {
        counts.all += 1;
        counts[item.categoryId] = (counts[item.categoryId] || 0) + 1;
      }
    });

    return counts;
  }, [selectedAudience]);

  // Filtered FAQ items based on search query, category, and audience
  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return FAQ_ITEMS.filter((item) => {
      // 1. Category Filter
      if (selectedCategory !== "all" && item.categoryId !== selectedCategory) {
        return false;
      }

      // 2. Audience Filter
      if (selectedAudience !== "all") {
        const matches =
          item.audience === selectedAudience ||
          item.audience === "all" ||
          item.audience === "general";
        if (!matches) return false;
      }

      // 3. Search Query Filter
      if (normalizedQuery) {
        const inQuestion = item.question.toLowerCase().includes(normalizedQuery);
        const inAnswer = item.answer.toLowerCase().includes(normalizedQuery);
        const inKeywords = item.keywords.some((k) =>
          k.toLowerCase().includes(normalizedQuery)
        );
        const categoryMeta = FAQ_CATEGORIES.find((c) => c.id === item.categoryId);
        const inCategory = categoryMeta?.title.toLowerCase().includes(normalizedQuery);

        return inQuestion || inAnswer || inKeywords || !!inCategory;
      }

      return true;
    });
  }, [searchQuery, selectedCategory, selectedAudience]);

  // Handlers for accordion expansion
  const toggleFaq = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    startTransition(() => {
      setExpandedIds(new Set(filteredItems.map((item) => item.id)));
    });
  };

  const collapseAll = () => {
    startTransition(() => {
      setExpandedIds(new Set());
    });
  };

  const resetAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedAudience("all");
    setExpandedIds(new Set());
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedCategory !== "all" ||
    selectedAudience !== "all";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navigation */}
      <HelpHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-surface via-surface/80 to-background py-12 sm:py-16">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-champagne-strong/30 bg-champagne/15 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-champagne-strong mb-4">
              <HelpCircle className="size-3.5" aria-hidden="true" />
              <span>Portal Help Center</span>
            </div>

            <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground sm:text-5xl">
              How can we help you?
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base leading-relaxed text-muted">
              Learn how Portal makes cross-border peer shopping seamless and secure.
              Find guides for buyers, travelers, escrow protection, and customs compliance.
            </p>

            {/* Search Bar */}
            <div className="mt-8">
              <HelpSearch
                query={searchQuery}
                onQueryChange={setSearchQuery}
                resultCount={filteredItems.length}
                totalCount={FAQ_ITEMS.length}
              />
            </div>
          </div>
        </section>

        {/* Content Section */}
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12 space-y-10">
          {/* Audience Filter Bar */}
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                Audience Filter
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Target questions specific to your role
              </p>
            </div>
            <HelpAudienceFilter
              selectedAudience={selectedAudience}
              onSelectAudience={setSelectedAudience}
            />
          </div>

          {/* Category Cards Grid */}
          <HelpCategories
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            categoryCounts={categoryCounts}
          />

          {/* Active Filter Summary if filtered */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface/50 px-4 py-2.5 text-xs text-muted">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">Active filters:</span>
                {selectedCategory !== "all" && (
                  <span className="rounded bg-burgundy/10 px-2 py-0.5 text-burgundy font-medium">
                    Category: {FAQ_CATEGORIES.find((c) => c.id === selectedCategory)?.title}
                  </span>
                )}
                {selectedAudience !== "all" && (
                  <span className="rounded bg-champagne/20 px-2 py-0.5 text-champagne-strong font-medium">
                    Audience: {selectedAudience}
                  </span>
                )}
                {searchQuery.trim() && (
                  <span className="rounded bg-surface-muted px-2 py-0.5 text-foreground font-medium">
                    Query: &ldquo;{searchQuery}&rdquo;
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 font-medium text-burgundy hover:underline"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                Reset all filters
              </button>
            </div>
          )}

          {/* FAQ Accordion or Empty State */}
          {filteredItems.length > 0 ? (
            <section aria-label="FAQ Questions">
              <FAQAccordion
                items={filteredItems}
                expandedIds={expandedIds}
                onToggle={toggleFaq}
                onExpandAll={expandAll}
                onCollapseAll={collapseAll}
              />
            </section>
          ) : (
            <EmptyState
              icon={SearchX}
              title="No matching questions found"
              description={`We couldn't find any questions matching "${searchQuery}". Try adjusting your keywords, selecting a different topic, or clearing your active filters.`}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetAllFilters}
                  className="gap-2"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Clear all filters & search
                </Button>
              }
              className="py-16"
            />
          )}

          {/* Contact / Help Footer Card */}
          <HelpContactCard />

          {/* Bottom Breadcrumbs / Quick Return */}
          <div className="flex items-center justify-between border-t border-border pt-6 text-xs text-muted">
            <div className="flex items-center gap-2">
              <Link href="/" className="hover:text-burgundy transition-colors">
                Portal
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium">Help Center</span>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-1 hover:text-burgundy transition-colors"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Return to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
