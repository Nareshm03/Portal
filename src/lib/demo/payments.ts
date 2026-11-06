/**
 * Demo Payment and Transaction Data
 * 
 * Transaction history for both Buyer payments and Traveler payouts
 * All amounts are demo fixtures - no real money is processed
 */

export type PaymentStatus = 'pending' | 'completed' | 'failed';
export type PayoutStatus = 'pending' | 'released' | 'paid';

export type PaymentMethod = 
  | 'upi'
  | 'debit_card'
  | 'credit_card'
  | 'international_card'
  | 'net_banking'
  | 'bank_transfer';

export interface BuyerTransaction {
  id: string;
  date: string; // ISO date
  orderReference: string;
  description: string;
  productName: string;
  travelerName: string;
  amountUsd: number;
  exchangeRate: number;
  amountInr: number;
  platformFeeUsd: number;
  platformFeeInr: number;
  depositAmountUsd: number; // Initial deposit (25%)
  depositAmountInr: number;
  totalPaidInr: number;
  paymentMethod: PaymentMethod | null;
  status: PaymentStatus;
}

export interface TravelerPayout {
  id: string;
  date: string;
  orderReference: string;
  description: string;
  productName: string;
  buyerName: string;
  orderValueUsd: number;
  earningUsd: number; // Carrying fee
  exchangeRate: number;
  earningInr: number;
  payoutMethod: PaymentMethod | null;
  status: PayoutStatus;
}

// Buyer transaction history (5% platform fee, 25% initial deposit)
export const buyerTransactions: readonly BuyerTransaction[] = [
  {
    id: 'txn-buyer-001',
    date: '2026-11-01T10:30:00Z',
    orderReference: 'P-2481',
    description: 'Initial deposit payment',
    productName: 'Bose QuietComfort Ultra headphones',
    travelerName: 'Meera Kapoor',
    amountUsd: 429,
    exchangeRate: 83.25,
    amountInr: 35714.25,
    platformFeeUsd: 21.45, // 5% of 429
    platformFeeInr: 1785.71,
    depositAmountUsd: 107.25, // 25% of 429
    depositAmountInr: 8928.56,
    totalPaidInr: 10714.27, // Deposit + platform fee
    paymentMethod: 'upi',
    status: 'completed',
  },
  {
    id: 'txn-buyer-002',
    date: '2026-10-28T14:15:00Z',
    orderReference: 'P-2418',
    description: 'Initial deposit payment',
    productName: 'Aesop Resurrection hand balm set',
    travelerName: 'Arjun Shah',
    amountUsd: 96,
    exchangeRate: 83.40,
    amountInr: 8006.40,
    platformFeeUsd: 4.80,
    platformFeeInr: 400.32,
    depositAmountUsd: 24.00,
    depositAmountInr: 2001.60,
    totalPaidInr: 2401.92,
    paymentMethod: 'debit_card',
    status: 'completed',
  },
  {
    id: 'txn-buyer-003',
    date: '2026-10-15T09:45:00Z',
    orderReference: 'P-2351',
    description: 'Full order payment',
    productName: 'Le Labo Santal 33 perfume',
    travelerName: 'Rhea Nair',
    amountUsd: 240,
    exchangeRate: 83.60,
    amountInr: 20064.00,
    platformFeeUsd: 12.00,
    platformFeeInr: 1003.20,
    depositAmountUsd: 60.00,
    depositAmountInr: 5016.00,
    totalPaidInr: 21067.20, // Full payment
    paymentMethod: 'credit_card',
    status: 'completed',
  },
  {
    id: 'txn-buyer-004',
    date: '2026-09-22T16:20:00Z',
    orderReference: 'P-2198',
    description: 'Full order payment',
    productName: 'Sony WH-1000XM5 headphones',
    travelerName: 'Kabir Menon',
    amountUsd: 399,
    exchangeRate: 83.45,
    amountInr: 33296.55,
    platformFeeUsd: 19.95,
    platformFeeInr: 1664.83,
    depositAmountUsd: 99.75,
    depositAmountInr: 8324.14,
    totalPaidInr: 34961.38,
    paymentMethod: 'net_banking',
    status: 'completed',
  },
  {
    id: 'txn-buyer-005',
    date: '2026-09-10T11:05:00Z',
    orderReference: 'P-2087',
    description: 'Full order payment',
    productName: 'Rimowa Essential Cabin luggage',
    travelerName: 'Meera Kapoor',
    amountUsd: 650,
    exchangeRate: 83.30,
    amountInr: 54145.00,
    platformFeeUsd: 32.50,
    platformFeeInr: 2707.25,
    depositAmountUsd: 162.50,
    depositAmountInr: 13536.25,
    totalPaidInr: 56852.25,
    paymentMethod: 'upi',
    status: 'completed',
  },
  {
    id: 'txn-buyer-006',
    date: '2026-08-28T13:40:00Z',
    orderReference: 'P-1954',
    description: 'Full order payment',
    productName: 'Apple AirPods Max',
    travelerName: 'Arjun Shah',
    amountUsd: 549,
    exchangeRate: 83.55,
    amountInr: 45869.95,
    platformFeeUsd: 27.45,
    platformFeeInr: 2293.45,
    depositAmountUsd: 137.25,
    depositAmountInr: 11467.49,
    totalPaidInr: 48163.40,
    paymentMethod: 'international_card',
    status: 'completed',
  },
];

// Traveler payout history (carrying fees earned)
export const travelerPayouts: readonly TravelerPayout[] = [
  {
    id: 'payout-traveler-001',
    date: '2026-10-25T15:30:00Z',
    orderReference: 'P-2871',
    description: 'Carrying fee for completed order',
    productName: 'Bang & Olufsen Beoplay HX',
    buyerName: 'Aditi Sen',
    orderValueUsd: 520,
    earningUsd: 52, // ~10% carrying fee
    exchangeRate: 83.40,
    earningInr: 4336.80,
    payoutMethod: 'bank_transfer',
    status: 'paid',
  },
  {
    id: 'payout-traveler-002',
    date: '2026-10-18T10:15:00Z',
    orderReference: 'P-2743',
    description: 'Carrying fee for completed order',
    productName: 'Dyson Supersonic hair dryer',
    buyerName: 'Naina Verma',
    orderValueUsd: 430,
    earningUsd: 43,
    exchangeRate: 83.50,
    earningInr: 3590.50,
    payoutMethod: 'upi',
    status: 'paid',
  },
  {
    id: 'payout-traveler-003',
    date: '2026-10-05T14:20:00Z',
    orderReference: 'P-2612',
    description: 'Carrying fee for completed order',
    productName: 'Leica Q3 compact camera',
    buyerName: 'Rohit Sharma',
    orderValueUsd: 1450,
    earningUsd: 145, // ~10% carrying fee
    exchangeRate: 83.30,
    earningInr: 12078.50,
    payoutMethod: 'bank_transfer',
    status: 'released',
  },
  {
    id: 'payout-traveler-004',
    date: '2026-09-28T09:45:00Z',
    orderReference: 'P-2489',
    description: 'Carrying fee for completed order',
    productName: 'Goyard Saint Louis tote',
    buyerName: 'Priya Malhotra',
    orderValueUsd: 2100,
    earningUsd: 210,
    exchangeRate: 83.45,
    earningInr: 17524.50,
    payoutMethod: 'bank_transfer',
    status: 'paid',
  },
  {
    id: 'payout-traveler-005',
    date: '2026-11-02T11:00:00Z',
    orderReference: 'P-3094',
    description: 'Carrying fee - awaiting handover',
    productName: 'On Running Cloudmonster 2',
    buyerName: 'Kabir Menon',
    orderValueUsd: 210,
    earningUsd: 21,
    exchangeRate: 83.25,
    earningInr: 1748.25,
    payoutMethod: null,
    status: 'pending',
  },
  {
    id: 'payout-traveler-006',
    date: '2026-11-01T16:30:00Z',
    orderReference: 'P-3127',
    description: 'Carrying fee - awaiting handover',
    productName: 'Acne Studios Musubi shoulder bag',
    buyerName: 'Naina Verma',
    orderValueUsd: 1450,
    earningUsd: 145,
    exchangeRate: 83.40,
    earningInr: 12093.00,
    payoutMethod: null,
    status: 'pending',
  },
];

// Payment method metadata
export interface PaymentMethodInfo {
  id: PaymentMethod;
  label: string;
  description: string;
  eligibility: 'buyer' | 'traveler' | 'both';
  processingTime: string;
  fees: string;
}

export const paymentMethods: readonly PaymentMethodInfo[] = [
  {
    id: 'upi',
    label: 'UPI',
    description: 'Instant payment via UPI apps (Google Pay, PhonePe, Paytm)',
    eligibility: 'both',
    processingTime: 'Instant',
    fees: 'No additional fees',
  },
  {
    id: 'debit_card',
    label: 'Debit Card',
    description: 'Indian debit cards (Visa, Mastercard, RuPay)',
    eligibility: 'buyer',
    processingTime: 'Instant',
    fees: 'No additional fees',
  },
  {
    id: 'credit_card',
    label: 'Credit Card',
    description: 'Indian credit cards (Visa, Mastercard)',
    eligibility: 'buyer',
    processingTime: 'Instant',
    fees: 'No additional fees',
  },
  {
    id: 'international_card',
    label: 'International Card',
    description: 'International credit/debit cards',
    eligibility: 'buyer',
    processingTime: '1-2 business days',
    fees: '2.5% international processing fee',
  },
  {
    id: 'net_banking',
    label: 'Net Banking',
    description: 'Direct bank transfer via internet banking',
    eligibility: 'both',
    processingTime: 'Instant to 2 hours',
    fees: 'No additional fees',
  },
  {
    id: 'bank_transfer',
    label: 'Bank Transfer',
    description: 'NEFT/RTGS/IMPS bank transfer',
    eligibility: 'traveler',
    processingTime: '1-3 business days',
    fees: 'No additional fees',
  },
];

// Calculate totals for buyer
export function calculateBuyerTotal(amountUsd: number, exchangeRate: number) {
  const amountInr = amountUsd * exchangeRate;
  const platformFeeUsd = amountUsd * 0.05; // 5%
  const platformFeeInr = platformFeeUsd * exchangeRate;
  const depositAmountUsd = amountUsd * 0.25; // 25%
  const depositAmountInr = depositAmountUsd * exchangeRate;
  const totalPaidInr = depositAmountInr + platformFeeInr;
  
  return {
    amountInr: Math.round(amountInr * 100) / 100,
    platformFeeUsd: Math.round(platformFeeUsd * 100) / 100,
    platformFeeInr: Math.round(platformFeeInr * 100) / 100,
    depositAmountUsd: Math.round(depositAmountUsd * 100) / 100,
    depositAmountInr: Math.round(depositAmountInr * 100) / 100,
    totalPaidInr: Math.round(totalPaidInr * 100) / 100,
  };
}

// Demo notices
export const PAYMENT_DEMO_NOTICE =
  'Demo mode — No real money is processed. Payment intents, currency conversions, and transaction records are simulated for demonstration purposes only.';

export const EXCHANGE_RATE_DISCLAIMER =
  'Exchange rates are indicative and subject to change. Final conversion rates are determined at transaction time by the payment provider.';
