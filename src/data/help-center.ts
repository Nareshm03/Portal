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
      "Portal is a peer-to-peer cross-border delivery marketplace connecting Indian buyers wanting authentic international items with trusted travelers flying home to India. Buyers publish product requests, verified travelers submit carry quotes with transparent rewards and estimated duty, and payments are held in secure escrow until physical handover is confirmed via a secure OTP code.",
    keywords: ["portal", "how it works", "overview", "basics", "introduction", "peer delivery"],
  },
  {
    id: "gs-2",
    categoryId: "getting-started",
    audience: "all",
    question: "Can I use Portal as both a Buyer and a Traveler?",
    answer:
      "Yes. Your single Portal account lets you switch freely between the Buyer workspace and the Traveler workspace using the top navigation header or profile switcher. You can buy hard-to-find international items when at home, and earn carry rewards by transporting items on your international trips.",
    keywords: ["switch role", "buyer and traveler", "account", "dual role", "profile"],
  },
  {
    id: "gs-3",
    categoryId: "getting-started",
    audience: "all",
    question: "What is Demo Mode vs Live Mode?",
    answer:
      "Portal includes a full Demo Mode with pre-populated international trips, mock product requests, sample quotes, and simulated orders. Demo mode allows you to explore the complete buyer and traveler lifecycle without processing real financial charges or connecting live payment gateways. In Live mode, transactions and authentication connect to our secure cloud database and payment processors.",
    keywords: ["demo mode", "live mode", "preview", "test mode", "offline"],
  },
  {
    id: "gs-4",
    categoryId: "getting-started",
    audience: "all",
    question: "Which Indian cities and airports are currently supported?",
    answer:
      "Portal currently supports primary international arrival hubs across India: Delhi (DEL), Mumbai (BOM), Bengaluru (BLR), Chennai (MAA), Hyderabad (HYD), Kolkata (CCU), Kochi (COK), Ahmedabad (AMD), Goa (GOI), and Pune (PNQ). Handovers are coordinated near these arrival hubs or mutually agreed city meetup locations.",
    keywords: ["airports", "cities", "delhi", "mumbai", "bangalore", "bengaluru", "chennai", "hubs", "locations"],
  },

  // 2. Buyer Guide
  {
    id: "bg-1",
    categoryId: "buyer-guide",
    audience: "buyer",
    question: "How do I create a product request as a Buyer?",
    answer:
      "Navigate to the Buyer Dashboard and select 'New Request'. Provide the product title, merchant web link, category, declared purchase value (in foreign currency or INR), desired destination airport, and urgency. Our system computes an indicative customs classification (HS Code) to verify compliance before making your request visible to matching travelers.",
    keywords: ["create request", "order item", "buy", "product link", "new request"],
  },
  {
    id: "bg-2",
    categoryId: "buyer-guide",
    audience: "buyer",
    question: "When is my payment charged and is my money safe?",
    answer:
      "Your money is held in a protected Escrow vault. When you accept a traveler's quote, you complete an upfront payment covering the product cost, carry reward, and estimated duty. Crucially, the traveler is NOT given your funds upfront. The payment remains locked in escrow until you meet the traveler in person, inspect your item, and provide your secret 6-digit Handover OTP.",
    keywords: ["escrow", "payment safety", "deposit", "money hold", "when charged", "protection"],
  },
  {
    id: "bg-3",
    categoryId: "buyer-guide",
    audience: "buyer",
    question: "What is the Handover OTP and how does physical handover work?",
    answer:
      "Once the traveler lands in India and marks the order as LANDED, a unique 6-digit Handover OTP is generated on your Buyer order detail page. You meet the traveler at the agreed meetup location (such as airport arrivals or a public cafe), inspect the package and original store receipt, and only then disclose your OTP to the traveler. Once the traveler enters your OTP into their Portal app, the order transitions to DELIVERED and escrow payout is released.",
    keywords: ["otp", "handover", "delivery code", "meetup", "inspect", "confirmation"],
  },
  {
    id: "bg-4",
    categoryId: "buyer-guide",
    audience: "buyer",
    question: "What happens if a traveler cannot find or purchase my item?",
    answer:
      "If a traveler is unable to purchase the item (for instance, if it goes out of stock at the destination store), they will update the order status. If an order cannot be fulfilled before departure, the locked escrow hold is automatically cancelled and released back to your original payment method in full.",
    keywords: ["out of stock", "unfulfilled", "refund", "cannot find", "cancelled order"],
  },

  // 3. Traveler Guide
  {
    id: "tg-1",
    categoryId: "traveler-guide",
    audience: "traveler",
    question: "How do I earn money carrying items as a Traveler?",
    answer:
      "When planning an international trip to India, post your itinerary on Portal specifying your origin city/country, Indian arrival airport, flight date, and available baggage capacity (weight in kg and volume). Portal matches you with compatible buyer requests. You submit a quote with your requested carry reward. Once accepted, you purchase the item during your trip, carry it in your luggage, and receive your payout upon verified handover in India.",
    keywords: ["earn money", "traveler earnings", "carry reward", "post trip", "baggage space"],
  },
  {
    id: "tg-2",
    categoryId: "traveler-guide",
    audience: "traveler",
    question: "Do I have to buy the requested item with my own funds upfront?",
    answer:
      "Yes. To protect both parties and comply with international anti-fraud regulations, travelers purchase the item abroad with their own funds and upload proof of purchase (store receipt and item condition photos). The buyer's total payment is already safely pre-funded in Portal's Escrow vault before you make the purchase, guaranteeing that reimbursement plus your reward is waiting for you upon delivery.",
    keywords: ["upfront cost", "purchase item", "receipt", "store receipt", "reimbursement"],
  },
  {
    id: "tg-3",
    categoryId: "traveler-guide",
    audience: "traveler",
    question: "How and when do I receive my traveler payout?",
    answer:
      "As soon as you enter the buyer's 6-digit Handover OTP at delivery, the transaction status moves to DELIVERED and the ledger initiates settlement. Payouts (including item cost reimbursement and your carry reward) are transferred directly to your registered bank account or UPI ID. In demo mode, simulated settlement is reflected instantly on your Traveler dashboard.",
    keywords: ["payout", "settlement", "bank transfer", "upi", "when paid", "receive earnings"],
  },
  {
    id: "tg-4",
    categoryId: "traveler-guide",
    audience: "traveler",
    question: "What if a buyer does not show up for the agreed handover?",
    answer:
      "If a buyer fails to attend the scheduled handover after you have landed, Portal's support team assists in rescheduling. If the buyer is unreachable after multiple documented attempts, you can raise an escalation through your order page. Under Portal's dispute protocol, non-responsive buyer scenarios are reviewed by administrators to protect the traveler's investment.",
    keywords: ["no show", "buyer absent", "handover issue", "escalation", "support"],
  },

  // 4. Trips and Product Requests
  {
    id: "tr-1",
    categoryId: "trips-requests",
    audience: "general",
    question: "What items can be requested through Portal?",
    answer:
      "Eligible items include consumer electronics, designer apparel, footwear, cosmetics, skincare, collectibles, specialty snacks, books, and lifestyle goods that fit within standard airline carry-on or checked baggage limits. All items must comply with Indian Central Board of Indirect Taxes and Customs (CBIC) passenger baggage regulations and Portal's safety policies.",
    keywords: ["eligible items", "what can i buy", "products", "cosmetics", "electronics", "fashion"],
  },
  {
    id: "tr-2",
    categoryId: "trips-requests",
    audience: "general",
    question: "Which origin countries are currently popular on Portal?",
    answer:
      "Portal supports travelers flying from major international shopping destinations, including the United States, United Kingdom, United Arab Emirates, Singapore, Japan, Germany, France, Canada, and Australia. Buyers can filter active traveler itineraries by origin country to match regional exclusives.",
    keywords: ["origin countries", "united states", "usa", "uk", "dubai", "uae", "singapore", "japan"],
  },
  {
    id: "tr-3",
    categoryId: "trips-requests",
    audience: "general",
    question: "What are HS Codes and why are they required on requests?",
    answer:
      "Harmonized System (HS) Codes are standardized international customs codes used to classify traded goods. Portal automatically suggests or assigns the relevant HS code (e.g. HS 8517 for smartphones, HS 3304 for cosmetics) to estimate customs duties accurately and flag prohibited categories before any traveler commits to carrying the item.",
    keywords: ["hs code", "customs classification", "duty code", "tariff", "compliance"],
  },
  {
    id: "tr-4",
    categoryId: "trips-requests",
    audience: "traveler",
    question: "How do luggage weight and dimension limits work?",
    answer:
      "When posting a trip, travelers declare their spare luggage capacity (e.g., up to 5 kg). Product requests specify estimated dimensions (small, medium, large) and weight. The Portal matching engine filters out requests that exceed a traveler's declared weight limit or requires bulky packaging.",
    keywords: ["baggage limit", "weight", "dimensions", "luggage space", "capacity"],
  },

  // 5. Quotes and Matching
  {
    id: "qm-1",
    categoryId: "quotes-matching",
    audience: "all",
    question: "How does Portal match buyers with travelers?",
    answer:
      "Matching connects buyer requests with traveler trips based on three key parameters: origin country alignment, arrival airport proximity, and timeline compatibility (the traveler's arrival date must be on or before the buyer's required delivery date). Once a match is detected, travelers receive an alert to review the request and submit a quote.",
    keywords: ["matching", "smart match", "algorithm", "itinerary match", "compatibility"],
  },
  {
    id: "qm-2",
    categoryId: "quotes-matching",
    audience: "all",
    question: "What makes up a quote breakdown?",
    answer:
      "A complete Portal quote consists of three transparent components: 1) Item Purchase Price (converted to INR at live benchmark rates), 2) Traveler Carry Reward (the agreed service fee for transport), and 3) Estimated Customs & Handling (indicative duty allocation based on item category). Portal charges a minimal platform fee visible before checkout.",
    keywords: ["quote breakdown", "pricing", "carry reward", "customs fee", "transparent fee"],
  },
  {
    id: "qm-3",
    categoryId: "quotes-matching",
    audience: "buyer",
    question: "Can I receive quotes from multiple travelers for the same request?",
    answer:
      "Yes! When your request is active, multiple verified travelers on matching routes can send competitive quotes. You can compare traveler ratings, total carry counts, flight arrival dates, and quoted rewards before selecting the best quote to accept.",
    keywords: ["multiple quotes", "compare travelers", "best price", "select traveler"],
  },
  {
    id: "qm-4",
    categoryId: "quotes-matching",
    audience: "traveler",
    question: "Can a traveler withdraw or edit an open quote?",
    answer:
      "Travelers can retract or adjust an open quote at any time before the buyer accepts it and completes payment. Once a buyer accepts and enters the LOCKED order state, the quote terms are legally binding for both parties.",
    keywords: ["edit quote", "cancel quote", "withdraw", "binding quote"],
  },

  // 6. Payments and Orders
  {
    id: "po-1",
    categoryId: "payments-orders",
    audience: "all",
    question: "What are the stages of an order lifecycle?",
    answer:
      "An order progresses through 7 transparent stages: 1) CREATED: Request posted; 2) ACCEPTED: Traveler quote accepted; 3) LOCKED: Buyer escrow deposit confirmed; 4) PURCHASED: Traveler bought the item and uploaded store receipt proof; 5) LANDED: Traveler arrived in India; 6) DELIVERED: Handover completed with verified OTP; 7) SETTLED: Escrow released to traveler's bank.",
    keywords: ["order lifecycle", "stages", "locked", "purchased", "landed", "delivered", "settled"],
  },
  {
    id: "po-2",
    categoryId: "payments-orders",
    audience: "all",
    question: "How does the Portal financial ledger guarantee integrity?",
    answer:
      "Portal operates an append-only double-entry ledger. Every financial transition—from escrow deposit to platform fee allocation and payout settlement—creates immutable debit and credit entries. Ledger records cannot be altered or deleted, ensuring complete mathematical balance and fraud protection.",
    keywords: ["ledger", "double entry", "accounting", "immutable", "audit trail", "financial integrity"],
  },
  {
    id: "po-3",
    categoryId: "payments-orders",
    audience: "buyer",
    question: "What payment methods are supported for escrow deposits?",
    answer:
      "In live mode, Portal supports payments via UPI, major credit/debit cards (Visa, Mastercard, RuPay), and Netbanking through our PCI-DSS compliant payment infrastructure. In demo mode, instant simulated payment authorization is provided without entering real card credentials.",
    keywords: ["payment methods", "upi", "credit card", "debit card", "netbanking", "razorpay"],
  },
  {
    id: "po-4",
    categoryId: "payments-orders",
    audience: "all",
    question: "How do cancellations work and when are refunds issued?",
    answer:
      "Cancellations depend on order stage. Buyers can cancel freely with a 100% refund while an order is in ACCEPTED status (before payment locking). If an order is LOCKED but the traveler has not yet purchased the item, cancellation requires mutual consent or trip date expiration. Once an item is marked PURCHASED with verified receipts, cancellation is restricted to protect the traveler.",
    keywords: ["cancellation", "refund policy", "refund timeline", "cancel order"],
  },

  // 7. Account and Verification
  {
    id: "av-1",
    categoryId: "account-verification",
    audience: "traveler",
    question: "What verification is required for Travelers before carrying items?",
    answer:
      "To ensure community safety, travelers must complete identity verification. This includes valid government passport KYC verification, mobile phone OTP confirmation, and flight ticket itinerary verification. In demo mode, travelers are marked with 'Mock passport KYC · demo' for sandbox testing.",
    keywords: ["traveler verification", "kyc", "passport", "identity check", "trust badge"],
  },
  {
    id: "av-2",
    categoryId: "account-verification",
    audience: "all",
    question: "How does Portal protect my personal and contact details?",
    answer:
      "Personal contact details (such as your private phone number and home address) are never publicly exposed. Buyers and travelers coordinate order specifics via Portal's in-app messaging. Meetup locations for handovers are arranged at designated public transit hubs or airport arrival gates.",
    keywords: ["privacy", "phone number", "personal data", "security", "anonymity"],
  },
  {
    id: "av-3",
    categoryId: "account-verification",
    audience: "all",
    question: "How do traveler tiers and ratings work?",
    answer:
      "Travelers build a public reputation score (1 to 5 stars) and carry count badge based on verified handovers completed. Profiles display member join dates, verified languages, badges (such as 'Founding Traveler' or 'Super Traveler'), and buyer review ratings.",
    keywords: ["rating", "reputation", "tiers", "reviews", "founding traveler", "stars"],
  },
  {
    id: "av-4",
    categoryId: "account-verification",
    audience: "all",
    question: "What should I do if I cannot log into my account?",
    answer:
      "Portal uses passwordless magic-link and OTP phone verification. Ensure you check your spam folder for login links or request a fresh SMS OTP. If your phone number has changed, contact our support team through the Help Center for manual identity recovery.",
    keywords: ["login issue", "magic link", "otp login", "account recovery", "cannot log in"],
  },

  // 8. Safety and Policies
  {
    id: "sp-1",
    categoryId: "safety-policies",
    audience: "all",
    question: "What items are strictly prohibited on Portal?",
    answer:
      "Portal strictly prohibits illegal substances, narcotics, prescription pharmaceuticals, firearms, ammunition, hazardous chemicals, flammable materials, currency, precious bullion, counterfeit goods, commercial-scale merchandise, and any goods barred by Indian Customs (CBIC) or international aviation safety authorities. All requests undergo automated keyword filtering and manual compliance checks.",
    keywords: ["prohibited items", "banned items", "customs rules", "illegal", "safety policy"],
  },
  {
    id: "sp-2",
    categoryId: "safety-policies",
    audience: "all",
    question: "How does Portal handle Indian Customs duties and allowances?",
    answer:
      "Indian Customs allows bona fide international travelers a duty-free baggage allowance for personal used effects and gifts up to statutory limits. For dutiable commercial items, estimated duties are calculated in advance and included in the buyer's escrow deposit. Travelers declare items at the Red Channel if duties apply and retain official customs payment receipts for reimbursement.",
    keywords: ["customs duty", "baggage allowance", "cbic", "red channel", "customs declaration", "taxes"],
  },
  {
    id: "sp-3",
    categoryId: "safety-policies",
    audience: "all",
    question: "What happens if an item is damaged or the wrong product is delivered?",
    answer:
      "Buyers must inspect the item in person at the meetup before sharing their Handover OTP. If the item is damaged, opened, or incorrect, DO NOT share your OTP. Raise a dispute immediately via your Portal order page. Submitting a dispute freezes automatic escrow settlement and alerts our dispute management team for mediation.",
    keywords: ["dispute", "damaged item", "wrong item", "do not share otp", "chargeback", "mediation"],
  },
  {
    id: "sp-4",
    categoryId: "safety-policies",
    audience: "all",
    question: "How are disputes resolved and what evidence is required?",
    answer:
      "When a dispute is logged (entering CREATED or UNDER_REVIEW status), both parties upload evidence—including merchant purchase receipts, packaging unboxing photos, and message logs—to our secure private storage. Admin mediators evaluate the evidence against our fair marketplace policy. Payouts and refunds are only released after a confirmed resolution.",
    keywords: ["dispute resolution", "evidence", "receipts", "photos", "chargeback engine", "refund conflict"],
  },
];

