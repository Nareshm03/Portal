import type { TrackingStatus } from "@/components/ui/status-badge";

/**
 * Buyer workspace demo data.
 *
 * This is a typed fixture layer, not a backend. Nothing here is fetched,
 * persisted, or shared with the Traveler or Admin workspaces. Every surface
 * that renders these values labels them as demo data.
 */
export const BUYER_DEMO_NOTICE =
  "Demo preview — sample buyer, traveler, quote and order records. No live backend, payments or traveler matches.";

export const AIRPORTS = {
  DEL: { code: "DEL", city: "Delhi", name: "Indira Gandhi International" },
  BOM: {
    code: "BOM",
    city: "Mumbai",
    name: "Chhatrapati Shivaji Maharaj International",
  },
  BLR: { code: "BLR", city: "Bengaluru", name: "Kempegowda International" },
  MAA: { code: "MAA", city: "Chennai", name: "Chennai International" },
  HYD: {
    code: "HYD",
    city: "Hyderabad",
    name: "Rajiv Gandhi International",
  },
  CCU: {
    code: "CCU",
    city: "Kolkata",
    name: "Netaji Subhas Chandra Bose International",
  },
  COK: { code: "COK", city: "Kochi", name: "Cochin International" },
  AMD: {
    code: "AMD",
    city: "Ahmedabad",
    name: "Sardar Vallabhbhai Patel International",
  },
  GOI: { code: "GOI", city: "Goa", name: "Manohar International" },
  PNQ: { code: "PNQ", city: "Pune", name: "Pune International" },
  LHR: { code: "LHR", city: "London", name: "Heathrow" },
} as const;

export type AirportCode = keyof typeof AIRPORTS;

export const AIRPORT_OPTIONS = Object.values(AIRPORTS);

export function airportLabel(code: AirportCode | string): string {
  const airport = AIRPORTS[code as AirportCode];
  return airport ? `${airport.code} · ${airport.city}` : code;
}

export const ORIGIN_COUNTRIES = [
  "Australia",
  "France",
  "Germany",
  "Italy",
  "Japan",
  "Netherlands",
  "Singapore",
  "South Korea",
  "Spain",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
] as const;

export interface BuyerProfile {
  id: string;
  fullName: string;
  firstName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  nearestAirport: AirportCode;
  memberSince: string;
  tier: string;
  kyc: string;
  preferredCategories: readonly string[];
}

export const buyerProfile: BuyerProfile = {
  id: "buyer-demo-01",
  fullName: "Ananya Rao",
  firstName: "Ananya",
  email: "ananya.rao@example.com",
  phone: "+91 98200 00000",
  city: "Mumbai",
  country: "India",
  nearestAirport: "BOM",
  memberSince: "March 2024",
  tier: "Founding buyer",
  kyc: "Verified · demo",
  preferredCategories: ["Cameras & optics", "Designer fashion", "Fragrance & beauty"],
};

export interface ProductRequest {
  id: string;
  name: string;
  originCity: string;
  originCountry: string;
  destinationAirport: AirportCode;
  budgetUsd: number;
  /** ISO date (YYYY-MM-DD). */
  requiredBy: string;
  variant: string;
  imageUrl: string;
  status: TrackingStatus;
  matchedTravelers: number;
  quotesReceived: number;
  /** 0–100, illustrative demo signal only. */
  matchProgress: number;
}

export const productRequests: readonly ProductRequest[] = [
  {
    id: "req-1042",
    name: "Leica Q3 compact camera",
    originCity: "Tokyo",
    originCountry: "Japan",
    destinationAirport: "BOM",
    budgetUsd: 5800,
    requiredBy: "2026-12-18",
    variant: "Black · 28mm f/1.7",
    imageUrl:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80",
    status: "matched",
    matchedTravelers: 3,
    quotesReceived: 2,
    matchProgress: 72,
  },
  {
    id: "req-1039",
    name: "Goyard Saint Louis tote",
    originCity: "Paris",
    originCountry: "France",
    destinationAirport: "BOM",
    budgetUsd: 1850,
    requiredBy: "2026-12-04",
    variant: "GM · Black / tan",
    imageUrl:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80",
    status: "quoted",
    matchedTravelers: 2,
    quotesReceived: 2,
    matchProgress: 58,
  },
  {
    id: "req-1034",
    name: "Nike Air Max 1 ‘Patta’",
    originCity: "Amsterdam",
    originCountry: "Netherlands",
    destinationAirport: "BOM",
    budgetUsd: 320,
    requiredBy: "2026-11-28",
    variant: "UK 8 · Monarch / Rush Maroon",
    imageUrl:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
    status: "requested",
    matchedTravelers: 1,
    quotesReceived: 0,
    matchProgress: 22,
  },
];

export interface MatchedTraveler {
  id: string;
  name: string;
  fromCity: string;
  fromCode: string;
  toCity: string;
  toCode: string;
  travelWindow: string;
  luggageSpaceKg: number;
  verified: boolean;
  rating: number;
  carries: number;
  matchedRequest: string;
}

export const matchedTravelers: readonly MatchedTraveler[] = [
  {
    id: "trav-01",
    name: "Meera Kapoor",
    fromCity: "London",
    fromCode: "LHR",
    toCity: "Mumbai",
    toCode: "BOM",
    travelWindow: "12–14 Dec",
    luggageSpaceKg: 8,
    verified: true,
    rating: 4.9,
    carries: 18,
    matchedRequest: "Leica Q3",
  },
  {
    id: "trav-02",
    name: "Arjun Shah",
    fromCity: "Paris",
    fromCode: "CDG",
    toCity: "Mumbai",
    toCode: "BOM",
    travelWindow: "2–4 Dec",
    luggageSpaceKg: 6,
    verified: true,
    rating: 4.8,
    carries: 12,
    matchedRequest: "Goyard tote",
  },
  {
    id: "trav-03",
    name: "Rhea Nair",
    fromCity: "Amsterdam",
    fromCode: "AMS",
    toCity: "Mumbai",
    toCode: "BOM",
    travelWindow: "20–22 Nov",
    luggageSpaceKg: 4,
    verified: true,
    rating: 4.9,
    carries: 9,
    matchedRequest: "Air Max 1",
  },
];

export interface Quote {
  id: string;
  travelerName: string;
  requestName: string;
  itemPrice: number;
  carryingFee: number;
  dutyEstimate: number;
  status: TrackingStatus;
  recommended: boolean;
  /** ISO date (YYYY-MM-DD). */
  validUntil: string;
}

export const quotesReceived: readonly Quote[] = [
  {
    id: "quote-01",
    travelerName: "Meera Kapoor",
    requestName: "Leica Q3 compact camera",
    itemPrice: 5400,
    carryingFee: 240,
    dutyEstimate: 780,
    status: "quoted",
    recommended: true,
    validUntil: "2026-11-28",
  },
  {
    id: "quote-02",
    travelerName: "Arjun Shah",
    requestName: "Goyard Saint Louis tote",
    itemPrice: 1720,
    carryingFee: 110,
    dutyEstimate: 205,
    status: "quoted",
    recommended: false,
    validUntil: "2026-11-24",
  },
  {
    id: "quote-03",
    travelerName: "Rhea Nair",
    requestName: "Nike Air Max 1 ‘Patta’",
    itemPrice: 260,
    carryingFee: 45,
    dutyEstimate: 38,
    status: "quoted",
    recommended: false,
    validUntil: "2026-11-18",
  },
];

export function quoteTotal(quote: Quote): number {
  return quote.itemPrice + quote.carryingFee + quote.dutyEstimate;
}

export interface Conversation {
  id: string;
  travelerName: string;
  requestName: string;
  snippet: string;
  timeLabel: string;
  unread: boolean;
}

/** Demo conversations that reference backend conversation IDs. */
export const conversations: readonly Conversation[] = [
  {
    id: "conv-01",
    travelerName: "Meera Kapoor",
    requestName: "Leica Q3 compact camera",
    snippet:
      "I can collect it from Ginza on the 12th. Would you like the spare battery added as well?",
    timeLabel: "2h",
    unread: true,
  },
  {
    id: "conv-02",
    travelerName: "Arjun Shah",
    requestName: "Goyard Saint Louis tote",
    snippet:
      "The boutique has the GM in black. I'll send condition photos before I pay.",
    timeLabel: "Yesterday",
    unread: false,
  },
  {
    id: "conv-03",
    travelerName: "Rhea Nair",
    requestName: "Nike Air Max 1 ‘Patta’",
    snippet:
      "Happy to carry these — would you like the original box kept, or is flat packing easier?",
    timeLabel: "3d",
    unread: true,
  },
];

export const ORDER_STAGES = [
  "Requested",
  "Traveler matched",
  "Quote accepted",
  "Payment secured",
  "In transit",
  "Customs",
  "Delivered",
] as const;

export interface BuyerOrder {
  id: string;
  reference: string;
  productName: string;
  originCity: string;
  originCountry: string;
  destinationAirport: AirportCode;
  imageUrl: string;
  status: TrackingStatus;
  /** Index into ORDER_STAGES. */
  stageIndex: number;
  /** ISO date (YYYY-MM-DD). */
  handoverDate: string;
  travelerName: string;
  amountUsd: number;
  escrow: "held" | "released";
  note: string;
}

export const activeOrders: readonly BuyerOrder[] = [
  {
    id: "ord-2481",
    reference: "P-2481",
    productName: "Bose QuietComfort Ultra headphones",
    originCity: "Tokyo",
    originCountry: "Japan",
    destinationAirport: "BOM",
    imageUrl:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
    status: "in-transit",
    stageIndex: 4,
    handoverDate: "2026-12-14",
    travelerName: "Meera Kapoor",
    amountUsd: 429,
    escrow: "held",
    note: "Departed Tokyo Narita. Receipt and condition photos live in the demo timeline.",
  },
  {
    id: "ord-2418",
    reference: "P-2418",
    productName: "Aesop Resurrection hand balm set",
    originCity: "London",
    originCountry: "United Kingdom",
    destinationAirport: "BOM",
    imageUrl:
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
    status: "customs",
    stageIndex: 5,
    handoverDate: "2026-12-09",
    travelerName: "Arjun Shah",
    amountUsd: 96,
    escrow: "held",
    note: "Awaiting a simulated customs assessment in Mumbai. No live shipment exists.",
  },
];

export const buyerHeroImage =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1600&q=80";

export const buyerSnapshot = {
  activeRequests: productRequests.length,
  matchedTravelers: matchedTravelers.length,
  quotesToReview: quotesReceived.filter((quote) => quote.status === "quoted")
    .length,
  inTransit: activeOrders.filter(
    (order) => order.status === "in-transit" || order.status === "customs",
  ).length,
  unreadMessages: conversations.filter((conversation) => conversation.unread)
    .length,
} as const;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return DATE_FORMATTER.format(date);
}

export function formatCurrency(
  amount: number,
  currency = "USD",
  maximumFractionDigits = 0,
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(amount);
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
