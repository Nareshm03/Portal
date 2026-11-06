import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Help & Support Center Data Layer & Requirements", () => {
  const filePath = path.resolve("src/data/help-center.ts");
  const fileContent = fs.readFileSync(filePath, "utf-8");

  test("src/data/help-center.ts exists and can be read", () => {
    assert.ok(fs.existsSync(filePath), "help-center.ts should exist");
  });

  test("Contains all 8 required FAQ categories", () => {
    const requiredCategories = [
      "getting-started",
      "buyer-guide",
      "traveler-guide",
      "trips-requests",
      "quotes-matching",
      "payments-orders",
      "account-verification",
      "safety-policies",
    ];

    for (const cat of requiredCategories) {
      assert.ok(
        fileContent.includes(`id: "${cat}"`),
        `Category ${cat} must be defined in FAQ_CATEGORIES`
      );
    }
  });

  test("Contains Buyer, Traveler, and General audience filtering options", () => {
    const audiences = ["all", "buyer", "traveler", "general"];
    for (const aud of audiences) {
      assert.ok(
        fileContent.includes(`id: "${aud}"`),
        `Audience ${aud} must be supported`
      );
    }
  });

  test("Strictly conforms to Naresh's Order Engine contract", () => {
    // Primary linear order states
    assert.ok(fileContent.includes("ACCEPTED"), "Must mention ACCEPTED order state");
    assert.ok(fileContent.includes("LOCKED"), "Must mention LOCKED order state");
    assert.ok(fileContent.includes("PURCHASED"), "Must mention PURCHASED order state");
    assert.ok(fileContent.includes("LANDED"), "Must mention LANDED order state");
    assert.ok(fileContent.includes("COMPLETED"), "Must mention COMPLETED order state");

    // Exceptional order states
    assert.ok(fileContent.includes("DISPUTED"), "Must mention DISPUTED state");
    assert.ok(fileContent.includes("CANCELLED"), "Must mention CANCELLED state");
    assert.ok(fileContent.includes("REFUNDED"), "Must mention REFUNDED state");
    assert.ok(fileContent.includes("EXPIRED"), "Must mention EXPIRED state");
    assert.ok(fileContent.includes("FORFEITED"), "Must mention FORFEITED state");

    // Payment statuses separate from order states
    assert.ok(fileContent.includes("Payment Intent"), "Must discuss Payment Intent");
    assert.ok(fileContent.includes("CAPTURED"), "Must mention CAPTURED payment status");
  });

  test("Maintains accurate domain facts without unsupported promises", () => {
    // 12 Origin countries from buyer.ts
    assert.ok(fileContent.includes("12 countries"), "Must reflect 12 supported origin countries");
    // Escrow is internal ledger hold (ESCROW_HOLD)
    assert.ok(fileContent.includes("ESCROW_HOLD"), "Must mention ESCROW_HOLD ledger account");
    // Duty estimates are indicative only, not customs advice
    assert.ok(fileContent.includes("indicative"), "Duty estimates must be marked indicative");
    // Handover OTP
    assert.ok(fileContent.includes("6-digit Handover OTP") || fileContent.includes("Handover OTP"), "Must mention Handover OTP");
    // Prohibited items
    assert.ok(fileContent.includes("prohibited") || fileContent.includes("Prohibited"), "Must list prohibited goods");
  });

  test("UI components exist in src/components/help/", () => {
    const components = [
      "src/components/help/HelpHeader.tsx",
      "src/components/help/HelpSearch.tsx",
      "src/components/help/HelpAudienceFilter.tsx",
      "src/components/help/HelpCategories.tsx",
      "src/components/help/FAQAccordion.tsx",
      "src/components/help/HelpContactCard.tsx",
    ];

    for (const comp of components) {
      const full = path.resolve(comp);
      assert.ok(fs.existsSync(full), `Component ${comp} must exist`);
    }
  });

  test("Dedicated route page exists at src/app/help/page.tsx", () => {
    const pagePath = path.resolve("src/app/help/page.tsx");
    assert.ok(fs.existsSync(pagePath), "src/app/help/page.tsx must exist");
    const pageContent = fs.readFileSync(pagePath, "utf-8");
    assert.ok(pageContent.includes("How can we help you?"), "Page must contain the hero heading");
    assert.ok(pageContent.includes("HelpSearch"), "Page must use HelpSearch");
    assert.ok(pageContent.includes("HelpCategories"), "Page must use HelpCategories");
    assert.ok(pageContent.includes("FAQAccordion"), "Page must use FAQAccordion");
    assert.ok(pageContent.includes("EmptyState"), "Page must have an empty state");
    assert.ok(pageContent.includes("HelpAudienceFilter"), "Page must have audience filtering");
  });

  test("Interactive behaviors and keyboard accessibility check", () => {
    const accordionPath = path.resolve("src/components/help/FAQAccordion.tsx");
    const accordionContent = fs.readFileSync(accordionPath, "utf-8");
    assert.ok(accordionContent.includes("aria-expanded"), "Accordion must use aria-expanded");
    assert.ok(accordionContent.includes("aria-controls"), "Accordion must use aria-controls");
    assert.ok(accordionContent.includes("Expand all") || accordionContent.includes("Collapse all"), "Accordion must support expand/collapse all");

    const searchPath = path.resolve("src/components/help/HelpSearch.tsx");
    const searchContent = fs.readFileSync(searchPath, "utf-8");
    assert.ok(searchContent.includes("Escape"), "Search must handle Escape key");
    assert.ok(searchContent.includes("Clear search query"), "Search must have clear button with accessible label");

    const categoriesPath = path.resolve("src/components/help/HelpCategories.tsx");
    const categoriesContent = fs.readFileSync(categoriesPath, "utf-8");
    assert.ok(categoriesContent.includes("aria-pressed"), "Categories must use aria-pressed for active state");
  });
});
