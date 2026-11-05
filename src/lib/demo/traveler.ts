import type { TrackingStatus } from "@/components/ui/status-badge";
import {
  AIRPORTS,
  AIRPORT_OPTIONS,
  ORDER_STAGES,
  ORIGIN_COUNTRIES,
  airportLabel,
  formatCurrency,
  formatDate,
  getInitials,
  type AirportCode,
} from "./buyer";

/**
 * Traveler workspace demo data.
 *
 * This is a typed fixture layer, not a backend. Nothing here is fetched,
 * persisted, or written to the Buyer workspace. Every surface that renders
 * these values labels them as demo data.
 *
 * Shared contracts reused from the Buyer demo layer:
 *   • AIRPORTS / AirportCode / airportLabel
 *   • ORIGIN_COUNTRIES
 *   • ORDER_STAGES (the agreed order lifecycle)
 *   • formatDate / formatCurrency / getInitials
 *   • TrackingStatus from @/components/ui/status-badge
 *
 * There is no shared order or money engine in this repository. The only
 * canonical lifecycle references are TRACKING_STATUSES and ORDER_STAGES, so
 * this module reuses them instead of introducing a competing state machine.
 * Earnings figures below are illustrative fixtures — not payout calculations.
 */
export const TRAVELER_DEMO_NOTICE =
  "Demo preview — sample traveler, trip, request, quote and order records. No live backend, passport verification, payments or buyer matches.";

export {
  AIRPORTS,
  AIRPORT_OPTIONS,
  ORDER_STAGES,
  ORIGIN_COUNTRIES,
  airportLabel,
  formatCurrency,
  formatDate,
  getInitials,
};
export type { AirportCode };

/* ── Profile & passport KYC ─────────────────────────────────────────────── */

export interface TravelerProfile {
  id: string;
  fullName: string;
  firstName: string;
  email: string;
  phone: string;
  baseCity: string;
  baseCountry: string;
  homeAirport: AirportCode;
  memberSince: string;
  tier: string;
  verification: string;
  rating: number;
  carries: number;
  languages: readonly string[];
  bio: string;
}

export const travelerProfile: TravelerProfile = {
  id: "traveler-demo-01",
  fullName: "Meera Kapoor",
  firstName: "Meera",
  email: "meera.kapoor@example.com",
  phone: "+44 7700 900000",
  baseCity: "London",
  baseCountry: "United Kingdom",
  homeAirport: "LHR",
  memberSince: "January 2025",
  tier: "Founding traveler",
  verification: "Mock passport KYC · demo",
  rating: 4.9,
  carries: 18,
  languages: ["English", "Hindi"],
  bio: "London-based, usually flying home to Mumbai. I travel light and pack carefully — receipts and condition photos come as standard.",
};

export interface PassportKycDocument {
  label: string;
  status: string;
}

export interface PassportKyc {
  status: "demo-verified" | "pending";
  label: string;
  passportNumberMasked: string;
  nationality: string;
  issuingCountry: string;
  expiryDate: string;
  checkedOn: string;
  documents: readonly PassportKycDocument[];
  note: string;
}

export const passportKyc: PassportKyc = {
  status: "demo-verified",
  label: "Mock passport KYC",
  passportNumberMasked: "•••• 4821",
  nationality: "British",
  issuingCountry: "United Kingdom",
  expiryDate: "2031-08-14",
  checkedOn: "2026-09-18",
  documents: [
    { label: "Passport photo page", status: "Sample on file" },
    { label: "Selfie match", status: "Simulated" },
    { label: "Address confirmation", status: "Not required in demo" },
  ],
  note: "Mock KYC only. No passport is uploaded, verified, stored or transmitted in this prototype.",
};

/* ── Trips ──────────────────────────────────────────────────────────────── */

export type TripStatus = "upcoming" | "completed";

export interface TravelerTrip {
  id: string;
  reference: string;
  originCountry: string;
  originCity: string;
  originCode: string;
  departureDate: string;
  destinationAirport: AirportCode;
  arrivalDate: string;
  airline: string;
  flightNumber: string;
  status: TripStatus;
  luggageSpaceKg: number;
  note: string;
}

export const travelerTrips: readonly TravelerTrip[] = [
  {
    id: "trip-301",
    reference: "TR-301",
    originCountry: "United Kingdom",
    originCity: "London",
    originCode: "LHR",
    departureDate: "2026-12-12",
    destinationAirport: "BOM",
    arrivalDate: "2026-12-14",
    airline: "British Airways",
    flightNumber: "BA 139",
    status: "upcoming",
    luggageSpaceKg: 8,
    note: "Non-stop overnight flight. Two open requests are already within this route window.",
  },
  {
    id: "trip-298",
    reference: "TR-298",
    originCountry: "France",
    originCity: "Paris",
    originCode: "CDG",
    departureDate: "2026-12-22",
    destinationAirport: "BOM",
    arrivalDate: "2026-12-23",
    airline: "Air France",
    flightNumber: "AF 218",
    status: "upcoming",
    luggageSpaceKg: 6,
    note: "Six kilograms reserved for buyer requests. One accepted order is on this flight.",
  },
  {
    id: "trip-294",
    reference: "TR-294",
    originCountry: "Netherlands",
    originCity: "Amsterdam",
    originCode: "AMS",
    departureDate: "2026-12-27",
    destinationAirport: "BOM",
    arrivalDate: "2026-12-28",
    airline: "KLM",
    flightNumber: "KL 877",
    status: "upcoming",
    luggageSpaceKg: 5,
    note: "One accepted order is travelling on this route. Handover is planned for 29 December.",
  },
  {
    id: "trip-281",
    reference: "TR-281",
    originCountry: "France",
    originCity: "Paris",
    originCode: "CDG",
    departureDate: "2026-10-28",
    destinationAirport: "BOM",
    arrivalDate: "2026-10-29",
    airline: "Air France",
    flightNumber: "AF 218",
    status: "completed",
    luggageSpaceKg: 4,
    note: "Completed demo trip with one delivered order and a recorded demo carrying fee.",
  },
];

export const nextTravelerTrip = travelerTrips[0];

/* ── Available buyer requests ───────────────────────────────────────────── */

export type RequestRegion = "Europe" | "Asia" | "North America";

export interface AvailableRequest {
  id: string;
  reference: string;
  productName: string;
  brand: string;
  model: string;
  variant: string;
  description: string;
  category: string;
  region: RequestRegion;
  originCity: string;
  originCountry: string;
  destinationAirport: AirportCode;
  /** ISO date (YYYY-MM-DD). */
  requiredBy: string;
  /** Null when the buyer has not shared a ceiling. */
  budgetUsd: number | null;
  status: TrackingStatus;
  imageUrl: string;
  luggageEstimateKg: number;
  buyerFirstName: string;
  postedLabel: string;
}

export const availableRequests: readonly AvailableRequest[] = [
  {
    id: "req-t101",
    reference: "TRV-101",
    productName: "Le Labo Santal 33 discovery set",
    brand: "Le Labo",
    model: "Santal 33",
    variant: "3 × 15 ml travel set",
    description:
      "Looking for the travel set from the Liberty counter. Please confirm batch date and keep the outer box.",
    category: "Fragrance & beauty",
    region: "Europe",
    originCity: "London",
    originCountry: "United Kingdom",
    destinationAirport: "BOM",
    requiredBy: "2026-12-18",
    budgetUsd: 260,
    status: "requested",
    imageUrl:
      "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80",
    luggageEstimateKg: 1,
    buyerFirstName: "Ishaan",
    postedLabel: "2 days ago",
  },
  {
    id: "req-t102",
    reference: "TRV-102",
    productName: "Fortnum & Mason Piccadilly tea hamper",
    brand: "Fortnum & Mason",
    model: "Piccadilly",
    variant: "Medium · 12 teas",
    description:
      "A medium hamper for a family gift. Please keep the ribbon intact and include the gift receipt.",
    category: "Food & gifting",
    region: "Europe",
    originCity: "London",
    originCountry: "United Kingdom",
    destinationAirport: "BOM",
    requiredBy: "2026-12-16",
    budgetUsd: 180,
    status: "requested",
    imageUrl:
      "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80",
    luggageEstimateKg: 2,
    buyerFirstName: "Sara",
    postedLabel: "4 days ago",
  },
  {
    id: "req-t103",
    reference: "TRV-103",
    productName: "Acne Studios Musubi shoulder bag",
    brand: "Acne Studios",
    model: "Musubi",
    variant: "Mini · Black leather",
    description:
      "The mini Musubi in black, bought from the Galeries Lafayette concession. Condition photos before purchase please.",
    category: "Designer fashion",
    region: "Europe",
    originCity: "Paris",
    originCountry: "France",
    destinationAirport: "BOM",
    requiredBy: "2026-12-28",
    budgetUsd: 1450,
    status: "matched",
    imageUrl:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80",
    luggageEstimateKg: 2,
    buyerFirstName: "Naina",
    postedLabel: "1 week ago",
  },
  {
    id: "req-t104",
    reference: "TRV-104",
    productName: "On Running Cloudmonster 2",
    brand: "On",
    model: "Cloudmonster 2",
    variant: "UK 8 · White / Sand",
    description:
      "Please keep the original box if it fits. Happy with either the Patta or the flagship store.",
    category: "Footwear",
    region: "Europe",
    originCity: "Amsterdam",
    originCountry: "Netherlands",
    destinationAirport: "BOM",
    requiredBy: "2027-01-02",
    budgetUsd: 210,
    status: "matched",
    imageUrl:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    luggageEstimateKg: 2,
    buyerFirstName: "Kabir",
    postedLabel: "1 week ago",
  },
];

/* ── Quotes sent by the traveler ────────────────────────────────────────── */

export type TravelerQuoteStatus = Extract<
  TrackingStatus,
  "quoted" | "matched" | "cancelled"
>;

export interface TravelerQuote {
  id: string;
  requestId: string;
  requestName: string;
  originCity: string;
  originCountry: string;
  destinationAirport: AirportCode;
  priceMinUsd: number;
  priceMaxUsd: number;
  carryingFeeUsd: number;
  /** ISO date (YYYY-MM-DD). */
  estimatedFulfilment: string;
  message: string;
  submittedOn: string;
  status: TravelerQuoteStatus;
}

export const travelerQuotes: readonly TravelerQuote[] = [
  {
    id: "tquote-01",
    requestId: "req-t103",
    requestName: "Acne Studios Musubi shoulder bag",
    originCity: "Paris",
    originCountry: "France",
    destinationAirport: "BOM",
    priceMinUsd: 1280,
    priceMaxUsd: 1380,
    carryingFeeUsd: 120,
    estimatedFulfilment: "2026-12-24",
    message:
      "I can collect it from Galeries Lafayette on 22 December and hand it over in Mumbai on 24 December.",
    submittedOn: "2026-11-02",
    status: "matched",
  },
  {
    id: "tquote-02",
    requestId: "req-t104",
    requestName: "On Running Cloudmonster 2",
    originCity: "Amsterdam",
    originCountry: "Netherlands",
    destinationAirport: "BOM",
    priceMinUsd: 170,
    priceMaxUsd: 190,
    carryingFeeUsd: 30,
    estimatedFulfilment: "2026-12-29",
    message:
      "Flying Amsterdam to Mumbai on 27 December. I can check both stores and send box photos before buying.",
    submittedOn: "2026-11-03",
    status: "matched",
  },
  {
    id: "tquote-03",
    requestId: "req-t101",
    requestName: "Le Labo Santal 33 discovery set",
    originCity: "London",
    originCountry: "United Kingdom",
    destinationAirport: "BOM",
    priceMinUsd: 220,
    priceMaxUsd: 245,
    carryingFeeUsd: 35,
    estimatedFulfilment: "2026-12-18",
    message:
      "Happy to visit Liberty on 12 December. I will confirm the batch date and share a counter photo before paying.",
    submittedOn: "2026-11-04",
    status: "quoted",
  },
  {
    id: "tquote-04",
    requestId: "req-t102",
    requestName: "Fortnum & Mason Piccadilly tea hamper",
    originCity: "London",
    originCountry: "United Kingdom",
    destinationAirport: "BOM",
    priceMinUsd: 150,
    priceMaxUsd: 170,
    carryingFeeUsd: 28,
    estimatedFulfilment: "2026-12-16",
    message:
      "I can carry the medium hamper flat in a protected bag. Ribbon and gift receipt will stay intact.",
    submittedOn: "2026-11-04",
    status: "quoted",
  },
  {
    id: "tquote-05",
    requestId: "req-t099",
    requestName: "Maison Michel barrette",
    originCity: "Paris",
    originCountry: "France",
    destinationAirport: "BOM",
    priceMinUsd: 240,
    priceMaxUsd: 260,
    carryingFeeUsd: 25,
    estimatedFulfilment: "2026-10-30",
    message:
      "I could collect this from the Palais Royal boutique during my October trip.",
    submittedOn: "2026-10-21",
    status: "cancelled",
  },
];

/* ── Message threads ────────────────────────────────────────────────────── */

export interface TravelerMessage {
  id: string;
  from: "traveler" | "buyer";
  body: string;
  timeLabel: string;
}

export interface TravelerConversation {
  id: string;
  buyerName: string;
  requestName: string;
  orderReference: string | null;
  snippet: string;
  timeLabel: string;
  unread: boolean;
  messages: readonly TravelerMessage[];
}

export const travelerConversations: readonly TravelerConversation[] = [
  {
    id: "tconv-01",
    buyerName: "Naina Verma",
    requestName: "Acne Studios Musubi shoulder bag",
    orderReference: "P-3127",
    snippet:
      "The boutique confirmed the black mini is in stock. Could you send a photo of the stitching before you pay?",
    timeLabel: "2h",
    unread: true,
    messages: [
      {
        id: "m-01",
        from: "buyer",
        body: "Hello Meera — thank you for accepting the order. Is the Galeries Lafayette concession still holding the black mini?",
        timeLabel: "09:02",
      },
      {
        id: "m-02",
        from: "traveler",
        body: "Yes, they have one on hold until this evening. I am heading over after lunch.",
        timeLabel: "09:10",
      },
      {
        id: "m-03",
        from: "buyer",
        body: "Perfect. Could you send a photo of the stitching and the serial card before you pay?",
        timeLabel: "09:12",
      },
      {
        id: "m-04",
        from: "traveler",
        body: "Of course. I will add both to the purchase evidence as soon as I am at the counter.",
        timeLabel: "09:18",
      },
    ],
  },
  {
    id: "tconv-02",
    buyerName: "Kabir Menon",
    requestName: "On Running Cloudmonster 2",
    orderReference: "P-3094",
    snippet:
      "If the box is too bulky, flat-pack it — the shoes matter more than the packaging.",
    timeLabel: "Yesterday",
    unread: true,
    messages: [
      {
        id: "m-05",
        from: "buyer",
        body: "Thanks for the update from Amsterdam. Any luck finding the white / sand pair in UK 8?",
        timeLabel: "Yesterday",
      },
      {
        id: "m-06",
        from: "traveler",
        body: "Found them at the flagship store. I have the box and receipt with me.",
        timeLabel: "Yesterday",
      },
      {
        id: "m-07",
        from: "buyer",
        body: "Great. If the box is too bulky, flat-pack it — the shoes matter more than the packaging.",
        timeLabel: "Yesterday",
      },
    ],
  },
  {
    id: "tconv-03",
    buyerName: "Ishaan Mehta",
    requestName: "Le Labo Santal 33 discovery set",
    orderReference: null,
    snippet:
      "No rush on the batch date — the gift is for the 20th, so your 18 December arrival works well.",
    timeLabel: "3d",
    unread: false,
    messages: [
      {
        id: "m-08",
        from: "traveler",
        body: "I have quoted for the travel set from Liberty. I can bring it into Mumbai on 18 December.",
        timeLabel: "3d",
      },
      {
        id: "m-09",
        from: "buyer",
        body: "No rush on the batch date — the gift is for the 20th, so your 18 December arrival works well.",
        timeLabel: "3d",
      },
    ],
  },
  {
    id: "tconv-04",
    buyerName: "Aditi Sen",
    requestName: "Bang & Olufsen Beoplay HX",
    orderReference: "P-2871",
    snippet:
      "The headphones arrived perfectly. Thank you for the careful handover and the extra photos.",
    timeLabel: "1w",
    unread: false,
    messages: [
      {
        id: "m-10",
        from: "buyer",
        body: "The headphones arrived perfectly. Thank you for the careful handover and the extra photos.",
        timeLabel: "1w",
      },
      {
        id: "m-11",
        from: "traveler",
        body: "Glad they arrived safely. I hope the trip home was a good one.",
        timeLabel: "1w",
      },
    ],
  },
];

/* ── Orders, proof and handover ─────────────────────────────────────────── */

export const EVIDENCE_SLOTS = [
  "receipt",
  "product",
  "serial",
  "extra",
] as const;

export type EvidenceSlot = (typeof EVIDENCE_SLOTS)[number];

export interface EvidenceItem {
  slot: EvidenceSlot;
  label: string;
  hint: string;
  fileName: string | null;
  required: boolean;
}

export interface TravelerOrder {
  id: string;
  reference: string;
  productName: string;
  originCity: string;
  originCountry: string;
  destinationAirport: AirportCode;
  imageUrl: string;
  status: TrackingStatus;
  /** Index into the shared ORDER_STAGES lifecycle. */
  stageIndex: number;
  /** ISO date (YYYY-MM-DD). */
  handoverDate: string;
  buyerName: string;
  buyerFirstName: string;
  orderValueUsd: number;
  note: string;
  purchase: {
    storeName: string;
    /** ISO date (YYYY-MM-DD). */
    purchaseDate: string;
    receiptTotalUsd: number;
    evidence: readonly EvidenceItem[];
    lastUpdatedLabel: string;
  };
  arrival: {
    airline: string;
    flightNumber: string;
    scheduledAtLabel: string;
    airport: AirportCode;
    terminal: string;
    trackingNote: string;
    arrivalMarked: boolean;
  };
  handover: {
    location: string;
    demoOtp: string;
    prepared: boolean;
    completed: boolean;
    /** ISO date (YYYY-MM-DD) when completed, otherwise null. */
    completedOn: string | null;
  };
  /** Illustrative demo figure only. Not a payout calculation. */
  demoCarryingFeeUsd: number;
}

export const travelerOrders: readonly TravelerOrder[] = [
  {
    id: "ord-3127",
    reference: "P-3127",
    productName: "Acne Studios Musubi shoulder bag",
    originCity: "Paris",
    originCountry: "France",
    destinationAirport: "BOM",
    imageUrl:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80",
    status: "customs",
    stageIndex: 5,
    handoverDate: "2026-12-24",
    buyerName: "Naina Verma",
    buyerFirstName: "Naina",
    orderValueUsd: 1450,
    note: "Simulated customs assessment in Mumbai. Receipt, product and serial evidence are already on file.",
    purchase: {
      storeName: "Acne Studios · Galeries Lafayette, Paris",
      purchaseDate: "2026-12-21",
      receiptTotalUsd: 1360,
      lastUpdatedLabel: "23 Dec 2026",
      evidence: [
        {
          slot: "receipt",
          label: "Purchase receipt",
          hint: "Store receipt or invoice",
          fileName: "acne-receipt-demo.pdf",
          required: true,
        },
        {
          slot: "product",
          label: "Product photo",
          hint: "Full item, front and back",
          fileName: "musubi-front-demo.jpg",
          required: true,
        },
        {
          slot: "serial",
          label: "Serial or authenticity card",
          hint: "Serial number or brand card",
          fileName: "musubi-card-demo.jpg",
          required: true,
        },
        {
          slot: "extra",
          label: "Additional photo",
          hint: "Condition, packaging or detail",
          fileName: "musubi-stitching-demo.jpg",
          required: false,
        },
      ],
    },
    arrival: {
      airline: "Air France",
      flightNumber: "AF 218",
      scheduledAtLabel: "23 Dec 2026 · 08:15",
      airport: "BOM",
      terminal: "Terminal 2",
      trackingNote:
        "Landed in Mumbai. Awaiting a simulated customs assessment before handover.",
      arrivalMarked: true,
    },
    handover: {
      location: "BOM Terminal 2 · arrivals coffee lounge",
      demoOtp: "482196",
      prepared: false,
      completed: false,
      completedOn: null,
    },
    demoCarryingFeeUsd: 120,
  },
  {
    id: "ord-3094",
    reference: "P-3094",
    productName: "On Running Cloudmonster 2",
    originCity: "Amsterdam",
    originCountry: "Netherlands",
    destinationAirport: "BOM",
    imageUrl:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    status: "in-transit",
    stageIndex: 4,
    handoverDate: "2026-12-29",
    buyerName: "Kabir Menon",
    buyerFirstName: "Kabir",
    orderValueUsd: 210,
    note: "Departed Amsterdam. Product and receipt photos are attached; serial evidence is still to be added.",
    purchase: {
      storeName: "On Flagship Store · Amsterdam",
      purchaseDate: "2026-12-27",
      receiptTotalUsd: 190,
      lastUpdatedLabel: "27 Dec 2026",
      evidence: [
        {
          slot: "receipt",
          label: "Purchase receipt",
          hint: "Store receipt or invoice",
          fileName: "on-receipt-demo.pdf",
          required: true,
        },
        {
          slot: "product",
          label: "Product photo",
          hint: "Full item, front and back",
          fileName: "cloudmonster-pair-demo.jpg",
          required: true,
        },
        {
          slot: "serial",
          label: "Serial or authenticity card",
          hint: "Serial number or brand card",
          fileName: null,
          required: true,
        },
        {
          slot: "extra",
          label: "Additional photo",
          hint: "Condition, packaging or detail",
          fileName: "cloudmonster-box-demo.jpg",
          required: false,
        },
      ],
    },
    arrival: {
      airline: "KLM",
      flightNumber: "KL 877",
      scheduledAtLabel: "28 Dec 2026 · 09:40",
      airport: "BOM",
      terminal: "Terminal 2",
      trackingNote:
        "Departed Amsterdam. Demo tracking only — no live flight or shipment feed is connected.",
      arrivalMarked: false,
    },
    handover: {
      location: "BOM Terminal 2 · departures forecourt",
      demoOtp: "730415",
      prepared: false,
      completed: false,
      completedOn: null,
    },
    demoCarryingFeeUsd: 30,
  },
  {
    id: "ord-2871",
    reference: "P-2871",
    productName: "Bang & Olufsen Beoplay HX",
    originCity: "London",
    originCountry: "United Kingdom",
    destinationAirport: "BOM",
    imageUrl:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
    status: "delivered",
    stageIndex: 6,
    handoverDate: "2026-10-29",
    buyerName: "Aditi Sen",
    buyerFirstName: "Aditi",
    orderValueUsd: 520,
    note: "Completed demo handover. Buyer OTP was confirmed and the demo carrying fee was recorded.",
    purchase: {
      storeName: "Selfridges · London",
      purchaseDate: "2026-10-27",
      receiptTotalUsd: 480,
      lastUpdatedLabel: "29 Oct 2026",
      evidence: [
        {
          slot: "receipt",
          label: "Purchase receipt",
          hint: "Store receipt or invoice",
          fileName: "beoplay-receipt-demo.pdf",
          required: true,
        },
        {
          slot: "product",
          label: "Product photo",
          hint: "Full item, front and back",
          fileName: "beoplay-front-demo.jpg",
          required: true,
        },
        {
          slot: "serial",
          label: "Serial or authenticity card",
          hint: "Serial number or brand card",
          fileName: "beoplay-serial-demo.jpg",
          required: true,
        },
        {
          slot: "extra",
          label: "Additional photo",
          hint: "Condition, packaging or detail",
          fileName: "beoplay-case-demo.jpg",
          required: false,
        },
      ],
    },
    arrival: {
      airline: "British Airways",
      flightNumber: "BA 139",
      scheduledAtLabel: "29 Oct 2026 · 07:20",
      airport: "BOM",
      terminal: "Terminal 2",
      trackingNote: "Arrived and handed over. This order is complete in the demo.",
      arrivalMarked: true,
    },
    handover: {
      location: "BOM Terminal 2 · arrivals coffee lounge",
      demoOtp: "118204",
      prepared: true,
      completed: true,
      completedOn: "2026-10-29",
    },
    demoCarryingFeeUsd: 90,
  },
];

export const activeTravelerOrders = travelerOrders.filter(
  (order) => order.status !== "delivered" && order.status !== "cancelled",
);

/* ── Demo earnings ──────────────────────────────────────────────────────── */

export interface DemoEarningEntry {
  id: string;
  reference: string;
  productName: string;
  route: string;
  /** ISO date (YYYY-MM-DD). */
  completedOn: string;
  demoCarryingFeeUsd: number;
}

export interface TravelerEarnings {
  lifetimeUsd: number;
  releasedUsd: number;
  awaitingHandoverUsd: number;
  thisMonthUsd: number;
  completedCarries: number;
  recent: readonly DemoEarningEntry[];
  note: string;
}

export const travelerEarnings: TravelerEarnings = {
  lifetimeUsd: 1240,
  releasedUsd: 980,
  awaitingHandoverUsd: 260,
  thisMonthUsd: 340,
  completedCarries: 7,
  recent: [
    {
      id: "earn-01",
      reference: "P-2871",
      productName: "Bang & Olufsen Beoplay HX",
      route: "London → Mumbai",
      completedOn: "2026-10-29",
      demoCarryingFeeUsd: 90,
    },
    {
      id: "earn-02",
      reference: "P-2740",
      productName: "Porter Yoshida tanker pouch",
      route: "Tokyo → Mumbai",
      completedOn: "2026-09-18",
      demoCarryingFeeUsd: 60,
    },
    {
      id: "earn-03",
      reference: "P-2662",
      productName: "Diptyque Baies candle set",
      route: "Paris → Mumbai",
      completedOn: "2026-08-27",
      demoCarryingFeeUsd: 45,
    },
  ],
  note: "Illustrative demo totals only. No payment, escrow or payout engine is connected to this workspace.",
};

/* ── Snapshot ───────────────────────────────────────────────────────────── */

export const travelerSnapshot = {
  upcomingTrips: travelerTrips.filter((trip) => trip.status === "upcoming")
    .length,
  completedTrips: travelerTrips.filter((trip) => trip.status === "completed")
    .length,
  matchingRequests: availableRequests.length,
  openRequests: availableRequests.filter(
    (request) => request.status === "requested",
  ).length,
  pendingQuotes: travelerQuotes.filter((quote) => quote.status === "quoted")
    .length,
  activeOrders: activeTravelerOrders.length,
  unreadMessages: travelerConversations.filter(
    (conversation) => conversation.unread,
  ).length,
} as const;

export const travelerHeroImage =
  "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1800&q=80";
