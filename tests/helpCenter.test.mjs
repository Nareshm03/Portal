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

  test("Covers core authentic Portal features without fictitious claims", () => {
    // Escrow protection
    assert.ok(fileContent.includes("Escrow") || fileContent.includes("escrow"), "Must mention Escrow");
    // Handover OTP
    assert.ok(fileContent.includes("OTP"), "Must explain Handover OTP verification");
    // HS code customs classification
    assert.ok(fileContent.includes("HS Code") || fileContent.includes("HS code"), "Must explain HS Code classification");
    // Prohibited items
    assert.ok(fileContent.includes("prohibited") || fileContent.includes("Prohibited"), "Must list prohibited goods");
    // Payout and carry rewards
    assert.ok(fileContent.includes("carry reward") || fileContent.includes("reward"), "Must explain carry reward");
    // Order stages
    assert.ok(fileContent.includes("LOCKED"), "Must mention LOCKED stage");
    assert.ok(fileContent.includes("LANDED"), "Must mention LANDED stage");
    assert.ok(fileContent.includes("DELIVERED"), "Must mention DELIVERED stage");
    // Disputes
    assert.ok(fileContent.includes("dispute") || fileContent.includes("Dispute"), "Must cover disputes");
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
