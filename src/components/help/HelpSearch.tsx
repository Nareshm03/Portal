"use client";

import { useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

interface HelpSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  resultCount: number;
  totalCount: number;
}

const POPULAR_SEARCHES = [
  "Escrow hold",
  "Handover OTP",
  "Customs duty",
  "Traveler payout",
  "Prohibited items",
  "Dispute resolution",
];

export function HelpSearch({
  query,
  onQueryChange,
  resultCount,
  totalCount,
}: HelpSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        onQueryChange("");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onQueryChange]);

  return (
    <section className="mx-auto w-full max-w-2xl" aria-label="Search FAQs">
      <div className="relative">
        <label htmlFor="faq-search-input" className="sr-only">
          Search Help Center and FAQs
        </label>
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-muted">
          <Search className="size-5" aria-hidden="true" />
        </div>
        <input
          ref={inputRef}
          id="faq-search-input"
          type="search"
          role="searchbox"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by topic, question, or keyword (e.g. Escrow, OTP, Duty)..."
          className="w-full rounded-xl border border-border bg-surface py-3.5 pl-11 pr-11 text-base text-foreground shadow-sm placeholder:text-muted/70 transition-all focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/20"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              onQueryChange("");
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted hover:text-burgundy focus:outline-none"
            aria-label="Clear search query"
          >
            <span className="grid size-6 place-items-center rounded-full bg-surface-muted hover:bg-champagne/30">
              <X className="size-3.5" aria-hidden="true" />
            </span>
          </button>
        )}
      </div>

      {/* Popular quick searches */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-medium text-muted">Popular:</span>
        {POPULAR_SEARCHES.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onQueryChange(tag)}
            className={`rounded-full px-2.5 py-1 transition-colors border ${
              query.toLowerCase() === tag.toLowerCase()
                ? "border-burgundy bg-burgundy/10 text-burgundy font-medium"
                : "border-border bg-surface/80 text-muted hover:border-champagne-strong hover:text-burgundy"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Query Status / Count */}
      {query.trim().length > 0 && (
        <p
          className="mt-3 text-xs text-muted"
          role="status"
          aria-live="polite"
        >
          Found <span className="font-medium text-foreground">{resultCount}</span> {resultCount === 1 ? "result" : "results"} for &ldquo;<span className="font-medium text-burgundy">{query}</span>&rdquo; (out of {totalCount} questions)
        </p>
      )}
    </section>
  );
}

