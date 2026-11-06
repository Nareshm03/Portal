export type FAQAudience = "all" | "buyer" | "traveler" | "general";

export type FAQCategoryId =
  | "getting-started"
  | "buyer-guide"
  | "traveler-guide"
  | "trips-requests"
  | "quotes-matching"
  | "payments-orders"
  | "account-verification"
  | "safety-policies";

export interface FAQCategory {
  id: FAQCategoryId;
  title: string;
  description: string;
  icon: string;
}

export interface FAQItem {
  id: string;
  categoryId: FAQCategoryId;
  audience: FAQAudience;
  question: string;
  answer: string;
  keywords: string[];
}

export const FAQ_CATEGORIES: FAQCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Overview of Portal, how peer delivery works, and setting up your workspace.",
    icon: "Compass",
  },
  {
    id: "buyer-guide",
    title: "Buyer Guide",
    description: "Creating product requests, reviewing quotes, escrow checkout, and OTP handovers.",
    icon: "ShoppingBag",
  },
  {
    id: "traveler-guide",
    title: "Traveler Guide",
    description: "Listing upcoming trips, monetizing unused luggage space, and claiming payouts.",
    icon: "Plane",
  },
  {
    id: "trips-requests",
    title: "Trips & Product Requests",
    description: "Supported origin countries, destination airports, parcel dimensions, and HS codes.",
    icon: "PackageSearch",
  },
  {
    id: "quotes-matching",
    title: "Quotes & Matching",
    description: "How smart matching works, submitting carry quotes, and agreeing on delivery terms.",
    icon: "GitCompare",
  },
  {
    id: "payments-orders",
    title: "Payments & Orders",
    description: "Escrow protection, ledger accounting, order stages, receipts, and payout settlements.",
    icon: "ShieldCheck",
  },
  {
    id: "account-verification",
    title: "Account & Verification",
    description: "Passport KYC verification, phone authentication, and role switching.",
    icon: "UserCheck",
  },
  {
    id: "safety-policies",
    title: "Safety & Policies",
    description: "Prohibited goods, customs duty guidelines, dispute resolution, and cancellations.",
    icon: "Scale",
  },
];

export const FAQ_AUDIENCE_OPTIONS: { id: FAQAudience; label: string }[] = [
  { id: "all", label: "All Audiences" },
  { id: "buyer", label: "Buyers" },
  { id: "traveler", label: "Travelers" },
  { id: "general", label: "General" },
];

export const FAQ_ITEMS: FAQItem[] = [
  // 1. Getting Started
  {
    id: "gs-1",
    categoryId: "getting-started",
    audience: "all",
    question: "What is Portal and how does it work?",
    answer:
      "Portal is a peer-to-peer marketplace technology platform connecting Indian buyers seeking authentic international products with verified travelers flying to India with spare baggage capacity. Buyers publish requests, travelers submit carrying quotes with item costs, carrying fees, and indicative customs duty, and payments are held in an internal escrow hold until in-person handover is verified via a secure OTP code.",
    keywords: ["portal", "how it works", "overview", "basics", "introduction", "peer delivery"],
  },
  {
    id: "gs-2",
    categoryId: "getting-started",
    audience: "all",
    question: "Can I use Portal as both a Buyer and a Traveler?",
    answer:
      "Yes. Your single Portal account lets you switch between the Buyer workspace and the Traveler workspace using the top navigation header or profile switcher. You can place product requests when in India, and list upcoming international itineraries to earn carrying rewards when traveling.",
    keywords: ["switch role", "buyer and traveler", "account", "dual role", "profile"],
  },
  {
    id: "gs-3",
    categoryId: "getting-started",
    audience: "all",
    question: "What is Demo Mode vs Live Mode?",
    answer:
      "Portal includes a comprehensive Demo Mode with pre-seeded sample trips, mock product requests, illustrative quotes, and simulated order lifecycles. Demo mode enables end-to-end evaluation without live payment gateways, active bank accounts, or real passport verification. In Live mode, operations interact with configured database services, SMS OTP delivery, and payment provider integrations.",
    keywords: ["demo mode", "live mode", "preview", "test mode", "offline"],
  },
  {
    id: "gs-4",
    categoryId: "getting-started",
    audience: "all",
    question: "Which destination airports are supported in India?",
    answer:
      "Portal supports primary international arrival airports across India: Delhi (DEL), Mumbai (BOM), Bengaluru (BLR), Chennai (MAA), Hyderabad (HYD), Kolkata (CCU), Kochi (COK), Ahmedabad (AMD), Goa (GOI), and Pune (PNQ). Physical handovers are coordinated near arrival terminals or agreed public city meetup spots.",
    keywords: ["airports", "cities", "delhi", "mumbai", "bangalore", "bengaluru", "chennai", "hubs", "locations"],
  },

  // 2. Buyer Guide
  {
    id: "bg-1",
    categoryId: "buyer-guide",
    audience: "buyer",
    question: "How do I create a product request as a Buyer?",
    answer:
      "Navigate to the Buyer workspace and select 'New Request'. Provide the product title, merchant web link, category, declared purchase value (in foreign currency or INR), desired destination airport, and required delivery date. Our system assigns an indicative HS Code customs classification for compliance review before matching with eligible travelers.",
    keywords: ["create request", "order item", "buy", "product link", "new request"],
  },
  {
    id: "bg-2",
    categoryId: "buyer-guide",
    audience: "buyer",
    question: "How does payment protection and escrow hold work?",
    answer:
      "When you accept a traveler's quote, an order is created in the ACCEPTED state. Once you authorize upfront payment (item cost, carrying fee, indicative duty, and platform fee), the payment intent transitions to CAPTURED, the order moves to LOCKED, and funds are allocated to an ESCROW_HOLD account on our append-only double-entry ledger. Funds remain locked in escrow and are never released to the traveler upfront.",
    keywords: ["escrow", "payment safety", "deposit", "money hold", "when charged", "protection"],
  },
  {
    id: "bg-3",
    categoryId: "buyer-guide",
    audience: "buyer",
    question: "What is the Handover OTP and how does physical delivery complete?",
    answer:
      "When the traveler arrives in India and marks the order as LANDED, a unique 6-digit Handover OTP is generated on your Buyer order view. You meet the traveler at the agreed meetup location, inspect the item packaging and store receipt, and only then disclose your OTP to the traveler. When the traveler submits the OTP, cryptographic verification completes the handover, transitioning the order to COMPLETED and initiating settlement.",
    keywords: ["otp", "handover", "delivery code", "meetup", "inspect", "confirmation"],
  },
  {
    id: "bg-4",
    categoryId: "buyer-guide",
    audience: "buyer",
    question: "What happens if a traveler cannot purchase my item?",
    answer:
      "If a traveler cannot fulfill the item abroad (e.g. out of stock), the traveler cancels the order prior to arrival while in LOCKED or PURCHASED state. Because payment was captured, an automated full refund is initiated, transitioning the order to CANCELLED and subsequently REFUNDED on the internal ledger.",
    keywords: ["out of stock", "unfulfilled", "refund", "cannot find", "cancelled order"],
  },

  // 3. Traveler Guide
  {
    id: "tg-1",
    categoryId: "traveler-guide",
    audience: "traveler",
    question: "How do I list trips and earn carrying fees as a Traveler?",
    answer:
      "When traveling to India, post your flight itinerary specifying your origin city/country, Indian arrival airport, flight dates, and available spare luggage capacity (e.g. 2–8 kg). Portal matches you with compatible buyer requests. You submit a quote detailing item cost, your requested carrying fee, and indicative customs duty. Once accepted, you purchase the item during your journey and deliver it upon arrival.",
    keywords: ["earn money", "traveler earnings", "carry reward", "post trip", "baggage space"],
  },
  {
    id: "tg-2",
    categoryId: "traveler-guide",
    audience: "traveler",
    question: "Do travelers purchase items using their own funds upfront?",
    answer:
      "Yes. Travelers purchase requested items abroad using their own funds and upload proof of purchase (merchant receipt and condition photos). The buyer's total upfront payment is already captured and held in ESCROW_HOLD before you buy, ensuring verified funds are reserved on the ledger for reimbursement and fees upon delivery.",
    keywords: ["upfront cost", "purchase item", "receipt", "store receipt", "reimbursement"],
  },
  {
    id: "tg-3",
    categoryId: "traveler-guide",
    audience: "traveler",
    question: "How and when is traveler payout processed?",
    answer:
      "When you verify the buyer's 6-digit Handover OTP at delivery, the order transitions to COMPLETED. The internal ledger posts an ORDER_SETTLED journal transaction crediting your payable balance (item reimbursement plus carrying fee). In demo mode, settlement is posted strictly to the internal ledger without moving real banking funds; in production, payouts are disbursed via supported provider rails.",
    keywords: ["payout", "settlement", "bank transfer", "upi", "when paid", "receive earnings"],
  },
  {
    id: "tg-4",
    categoryId: "traveler-guide",
    audience: "traveler",
    question: "What happens if a buyer does not complete the handover?",
    answer:
      "If a buyer does not arrive for the scheduled handover within the permitted window after landing, the order enters exceptional handling. If the handover deadline expires without buyer verification, the order can transition to FORFEITED via scheduled background reconciliation, protecting the traveler's fulfillment investment.",
    keywords: ["no show", "buyer absent", "handover issue", "escalation", "support", "forfeited"],
  },

  // 4. Trips and Product Requests
  {
    id: "tr-1",
    categoryId: "trips-requests",
    audience: "general",
    question: "What items can be requested through Portal?",
    answer:
      "Eligible items include consumer electronics, personal audio, designer apparel, cosmetics, specialty books, and lifestyle accessories for personal use that fit within standard airline carry-on or checked baggage allowances. Commercial-scale quantities, resale cargo, and goods violating Indian Customs passenger baggage rules are prohibited.",
    keywords: ["eligible items", "what can i buy", "products", "cosmetics", "electronics", "fashion"],
  },
  {
    id: "tr-2",
    categoryId: "trips-requests",
    audience: "general",
    question: "Which origin countries are supported on Portal?",
    answer:
      "Portal supports itineraries originating from 12 countries: Australia, France, Germany, Italy, Japan, Netherlands, Singapore, South Korea, Spain, United Arab Emirates, United Kingdom, and the United States. Requests can be matched with travelers departing from international airports within these regions.",
    keywords: ["origin countries", "united states", "usa", "uk", "dubai", "uae", "singapore", "japan", "france", "germany"],
  },
  {
    id: "tr-3",
    categoryId: "trips-requests",
    audience: "general",
    question: "What are HS Codes and how are they used?",
    answer:
      "Harmonized System (HS) Codes are standardized international customs codes used to classify imported items (e.g. HS 8517 for communications equipment, HS 3304 for cosmetics). Portal assigns an HS code to evaluate whether the item qualifies under passenger baggage rules and to compute an indicative duty assessment before matching.",
    keywords: ["hs code", "customs classification", "duty code", "tariff", "compliance"],
  },
  {
    id: "tr-4",
    categoryId: "trips-requests",
    audience: "traveler",
    question: "How do luggage capacity limits work?",
    answer:
      "When listing a trip, travelers declare their available spare baggage weight (typically between 2 kg and 10 kg). The matching engine filters requests based on declared item weights and dimensions so travelers are never matched with packages exceeding their declared spare luggage allowance.",
    keywords: ["baggage limit", "weight", "dimensions", "luggage space", "capacity"],
  },

  // 5. Quotes and Matching
  {
    id: "qm-1",
    categoryId: "quotes-matching",
    audience: "all",
    question: "How does Portal match buyers with travelers?",
    answer:
      "Matching aligns approved, open buyer requests with active traveler trips based on origin country match, Indian destination airport proximity, and date compatibility (traveler arrival date on or before buyer's required delivery date). Matching requests only become visible to travelers after compliance review approval.",
    keywords: ["matching", "smart match", "algorithm", "itinerary match", "compatibility"],
  },
  {
    id: "qm-2",
    categoryId: "quotes-matching",
    audience: "all",
    question: "What are the components of a Quote?",
    answer:
      "A Portal quote itemizes four transparent components: 1) Item Purchase Price (in foreign currency and converted to INR), 2) Traveler Carrying Fee, 3) Indicative Customs Duty (reviewed by compliance), and 4) Platform Service Fee. Together, these form the total upfront payment captured when the order enters LOCKED state.",
    keywords: ["quote breakdown", "pricing", "carry reward", "customs fee", "transparent fee"],
  },
  {
    id: "qm-3",
    categoryId: "quotes-matching",
    audience: "buyer",
    question: "Can a buyer receive multiple quotes for the same request?",
    answer:
      "Yes. Multiple verified travelers flying compatible routes can submit independent quotes for an open request. You can compare traveler ratings, total carries, flight arrival dates, and carrying fees before selecting a quote to accept.",
    keywords: ["multiple quotes", "compare travelers", "best price", "select traveler"],
  },
  {
    id: "qm-4",
    categoryId: "quotes-matching",
    audience: "traveler",
    question: "Can an active quote be withdrawn or expired?",
    answer:
      "Travelers can withdraw an open quote anytime before a buyer accepts it. Additionally, quotes have validity deadlines; unaccepted quotes expire automatically. Once a buyer accepts a quote via accept_quote, the quote transitions to ACCEPTED and an order is created.",
    keywords: ["edit quote", "cancel quote", "withdraw", "binding quote", "quote expiry"],
  },

  // 6. Payments and Orders
  {
    id: "po-1",
    categoryId: "payments-orders",
    audience: "all",
    question: "What is the canonical order lifecycle in Naresh's Order Engine?",
    answer:
      "The primary order lifecycle progresses through 5 linear states: ACCEPTED → LOCKED → PURCHASED → LANDED → COMPLETED.\n\n• ACCEPTED: Quote accepted by buyer; payment pending within payment deadline window.\n• LOCKED: Upfront payment captured; order locked and funds held in internal escrow.\n• PURCHASED: Traveler confirmed item purchase abroad and uploaded store receipt proof.\n• LANDED: Traveler arrived in India awaiting in-person handover.\n• COMPLETED: Handover confirmed via 6-digit OTP verification; settlement ledger posted.\n\nIn addition, the state machine enforces separate exceptional states: DISPUTED (mediation hold), CANCELLED, REFUNDED (financial reversal posted), EXPIRED (payment window elapsed in ACCEPTED), and FORFEITED (handover deadline elapsed in LANDED).",
    keywords: ["order lifecycle", "stages", "accepted", "locked", "purchased", "landed", "completed", "state machine", "order engine"],
  },
  {
    id: "po-2",
    categoryId: "payments-orders",
    audience: "all",
    question: "How do payment statuses differ from order states?",
    answer:
      "Payment statuses track the lifecycle of the financial intent through the payment provider and are kept strictly distinct from order states. A Payment Intent progresses through CREATING → CREATED → AUTHORIZED → CAPTURED, or FAILED / REFUNDED. In order tracking, payment state is summarized as PENDING, CAPTURED, FAILED, REFUNDED, or NONE. An order only moves from ACCEPTED to LOCKED once its payment intent status is confirmed as CAPTURED.",
    keywords: ["payment intent", "payment status", "captured", "authorized", "refunded", "order state difference"],
  },
  {
    id: "po-3",
    categoryId: "payments-orders",
    audience: "all",
    question: "How does the internal double-entry ledger operate?",
    answer:
      "Portal uses an immutable, append-only double-entry financial ledger (post_ledger_transaction). Every financial transition requires balanced debits and credits: on LOCKED, funds move from PAYMENT_CLEARING to ESCROW_HOLD; on COMPLETED, escrow moves to TRAVELLER_PAYABLE, DUTY_PAYABLE, and PLATFORM_REVENUE; on refund, balanced reversal entries are posted. Historical ledger records can never be modified or deleted.",
    keywords: ["ledger", "double entry", "accounting", "immutable", "audit trail", "financial integrity"],
  },
  {
    id: "po-4",
    categoryId: "payments-orders",
    audience: "all",
    question: "What are the cancellation and refund rules by order state?",
    answer:
      "Cancellation eligibility strictly adheres to state machine rules:\n\n• ACCEPTED: The buyer may cancel before payment capture; no refund is required, transitioning order to CANCELLED.\n• LOCKED: Buyer or traveler may cancel; because payment was captured, an automated refund is required, transitioning the order to CANCELLED then REFUNDED.\n• PURCHASED: Only the traveler may cancel before landing (e.g. store stock unavailable), which triggers a full buyer refund. Buyers cannot unilaterally cancel once purchase is confirmed.\n• LANDED & COMPLETED: Cancellation is not permitted. If issues occur at handover, participants raise a dispute.\n• DISPUTED: Cancellations and refunds are blocked until formal dispute resolution.",
    keywords: ["cancellation", "refund policy", "refund timeline", "cancel order", "eligibility"],
  },

  // 7. Account and Verification
  {
    id: "av-1",
    categoryId: "account-verification",
    audience: "traveler",
    question: "What verification is required for Travelers before quoting?",
    answer:
      "Travelers must complete identity verification before their trips can be activated and before they can submit quotes. This includes passport KYC review, mobile phone verification, and itinerary validation. In demo mode, accounts feature simulated KYC submissions for safe offline walkthroughs.",
    keywords: ["traveler verification", "kyc", "passport", "identity check", "trust badge"],
  },
  {
    id: "av-2",
    categoryId: "account-verification",
    audience: "all",
    question: "How does Portal handle user privacy and contact details?",
    answer:
      "Personal contact details such as direct telephone numbers and private home addresses are protected and not displayed across public marketplace listings. Communication and handover arrangements occur through Portal's in-app messaging, and phone numbers in administrative logs are masked for privacy.",
    keywords: ["privacy", "phone number", "personal data", "security", "anonymity"],
  },
  {
    id: "av-3",
    categoryId: "account-verification",
    audience: "all",
    question: "How do traveler reputation ratings and carries work?",
    answer:
      "Traveler profiles display verifiable platform milestones: total completed carries, average review rating, founding traveler tier badges, member join dates, and verified origin routes. Metrics update only when handovers reach COMPLETED status via OTP verification.",
    keywords: ["rating", "reputation", "tiers", "reviews", "founding traveler", "stars"],
  },
  {
    id: "av-4",
    categoryId: "account-verification",
    audience: "all",
    question: "How does authentication work on Portal?",
    answer:
      "Portal uses passwordless magic-link and OTP phone authentication. If you encounter sign-in issues, check your spam folder for login links or request a fresh OTP SMS. If your contact information changes, administrators can update your verified profile records.",
    keywords: ["login issue", "magic link", "otp login", "account recovery", "cannot log in"],
  },

  // 8. Safety and Policies
  {
    id: "sp-1",
    categoryId: "safety-policies",
    audience: "all",
    question: "What items are strictly prohibited on Portal?",
    answer:
      "Portal strictly prohibits illegal substances, prescription medicines, firearms, ammunition, hazardous chemicals, flammable items, currency, bullion, counterfeit goods, commercial-scale inventory, and third-party commercial shipments under passenger baggage. Product requests are screened automatically and reviewed by compliance reviewers before matching is enabled.",
    keywords: ["prohibited items", "banned items", "customs rules", "illegal", "safety policy"],
  },
  {
    id: "sp-2",
    categoryId: "safety-policies",
    audience: "all",
    question: "What are Portal's customs duty and baggage policies?",
    answer:
      "Portal is a technology platform connecting individual travelers and buyers; it does not sell, ship, import goods, or provide legal or tax advice. Duty estimates on quotes are indicative only. International travelers are responsible for declaring dutiable personal baggage at the customs Red Channel in accordance with Indian Customs (CBIC) passenger baggage regulations.",
    keywords: ["customs duty", "baggage allowance", "cbic", "red channel", "customs declaration", "taxes"],
  },
  {
    id: "sp-3",
    categoryId: "safety-policies",
    audience: "all",
    question: "What should I do if an item is damaged or incorrect at handover?",
    answer:
      "Inspect the package and merchant store receipt in person at the meetup BEFORE sharing your 6-digit Handover OTP. If the item is missing, damaged, or incorrect, DO NOT share your OTP. Raise a dispute immediately via your order page. Transitioning to DISPUTED freezes settlement and alerts the dispute management team for mediation.",
    keywords: ["dispute", "damaged item", "wrong item", "do not share otp", "chargeback", "mediation"],
  },
  {
    id: "sp-4",
    categoryId: "safety-policies",
    audience: "all",
    question: "How does the Payment Dispute and Chargeback Engine work?",
    answer:
      "When a dispute is initiated (DISPUTED state), automatic settlement is paused, and conflicting refunds are blocked. Participants upload evidence (store receipts, condition photos, unboxing proof) to private storage. Mediators review the timeline and financial impact. If a dispute is won or lost, balanced ledger reversals are posted without altering historical journal entries.",
    keywords: ["dispute resolution", "evidence", "receipts", "photos", "chargeback engine", "refund conflict"],
  },
];
