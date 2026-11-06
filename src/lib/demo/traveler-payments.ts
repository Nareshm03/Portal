/**
 * Traveler Payments Demo Data
 * 
 * Complete financial management including:
 * - 50-50 contribution system
 * - Product reimbursement tracking
 * - Carrying fee earnings
 * - Transaction history
 */

export type OrderStatus = 
  | 'awaiting_traveler_contribution'
  | 'awaiting_buyer_contribution'
  | 'fully_funded'
  | 'purchased'
  | 'in_transit'
  | 'awaiting_handover'
  | 'completed';

export type TransactionType =
  | 'buyer_initial_contribution'
  | 'traveler_product_contribution'
  | 'product_purchase'
  | 'product_reimbursement'
  | 'carrying_fee_earned'
  | 'final_settlement';

export type ContributionStatus = 'pending' | 'confirmed' | 'paid';
export type ReimbursementStatus = 'pending' | 'processing' | 'completed';
export type CarryingFeeStatus = 'pending' | 'eligible' | 'released' | 'paid';

export interface TravelerOrderPayment {
  id: string;
  orderReference: string;
  productName: string;
  productImageUrl: string;
  buyerName: string;
  buyerFirstName: string;
  
  // Product pricing
  productPriceUsd: number;
  productPriceOriginalCurrency: string; // e.g., "EUR", "GBP"
  productPriceInr: number;
  exchangeRate: number;
  
  // 50-50 contribution
  buyerContributionInr: number; // 50%
  travelerContributionInr: number; // 50%
  buyerContributionStatus: ContributionStatus;
  travelerContributionStatus: ContributionStatus;
  totalFundingInr: number; // Should equal productPriceInr
  
  // Carrying fee
  carryingFeeInr: number;
  carryingFeeUsd: number;
  carryingFeeStatus: CarryingFeeStatus;
  
  // Reimbursement
  reimbursementInr: number; // Traveler gets back their 50%
  reimbursementStatus: ReimbursementStatus;
  reimbursementDate: string | null;
  
  // Status and dates
  status: OrderStatus;
  purchaseDate: string | null;
  expectedHandoverDate: string;
  actualHandoverDate: string | null;
  
  // Purchase proof
  purchaseReceipt: string | null;
  productPhoto: string | null;
  
  // Settlement
  otpVerified: boolean;
  settlementComplete: boolean;
  
  note: string;
}

export interface TravelerTransaction {
  id: string;
  date: string;
  orderReference: string;
  productName: string;
  buyerName: string;
  type: TransactionType;
  amountInr: number;
  amountUsd: number;
  currency: 'INR' | 'USD';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  note: string;
}

// Demo orders showing different payment stages
export const travelerOrderPayments: readonly TravelerOrderPayment[] = [
  {
    id: 'ord-pay-001',
    orderReference: 'P-3127',
    productName: 'Acne Studios Musubi shoulder bag',
    productImageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
    buyerName: 'Naina Verma',
    buyerFirstName: 'Naina',
    
    productPriceUsd: 1450,
    productPriceOriginalCurrency: 'EUR',
    productPriceInr: 120925, // 1450 * 83.40
    exchangeRate: 83.40,
    
    buyerContributionInr: 60462.50, // 50%
    travelerContributionInr: 60462.50, // 50%
    buyerContributionStatus: 'confirmed',
    travelerContributionStatus: 'pending',
    totalFundingInr: 120925,
    
    carryingFeeInr: 12093, // ~10%
    carryingFeeUsd: 145,
    carryingFeeStatus: 'pending',
    
    reimbursementInr: 60462.50,
    reimbursementStatus: 'pending',
    reimbursementDate: null,
    
    status: 'awaiting_traveler_contribution',
    purchaseDate: null,
    expectedHandoverDate: '2026-12-18',
    actualHandoverDate: null,
    
    purchaseReceipt: null,
    productPhoto: null,
    
    otpVerified: false,
    settlementComplete: false,
    
    note: 'Awaiting traveler contribution to proceed with purchase',
  },
  {
    id: 'ord-pay-002',
    orderReference: 'P-3094',
    productName: 'On Running Cloudmonster 2 sneakers',
    productImageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
    buyerName: 'Kabir Menon',
    buyerFirstName: 'Kabir',
    
    productPriceUsd: 210,
    productPriceOriginalCurrency: 'USD',
    productPriceInr: 17482.50, // 210 * 83.25
    exchangeRate: 83.25,
    
    buyerContributionInr: 8741.25, // 50%
    travelerContributionInr: 8741.25, // 50%
    buyerContributionStatus: 'paid',
    travelerContributionStatus: 'paid',
    totalFundingInr: 17482.50,
    
    carryingFeeInr: 1748.25, // ~10%
    carryingFeeUsd: 21,
    carryingFeeStatus: 'eligible',
    
    reimbursementInr: 8741.25,
    reimbursementStatus: 'processing',
    reimbursementDate: null,
    
    status: 'awaiting_handover',
    purchaseDate: '2026-11-08T10:30:00Z',
    expectedHandoverDate: '2026-12-15',
    actualHandoverDate: null,
    
    purchaseReceipt: 'demo-receipt-3094.pdf',
    productPhoto: 'demo-product-3094.jpg',
    
    otpVerified: false,
    settlementComplete: false,
    
    note: 'Product purchased, awaiting arrival and handover',
  },
  {
    id: 'ord-pay-003',
    orderReference: 'P-2871',
    productName: 'Bang & Olufsen Beoplay HX headphones',
    productImageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    buyerName: 'Aditi Sen',
    buyerFirstName: 'Aditi',
    
    productPriceUsd: 520,
    productPriceOriginalCurrency: 'USD',
    productPriceInr: 43368, // 520 * 83.40
    exchangeRate: 83.40,
    
    buyerContributionInr: 21684, // 50%
    travelerContributionInr: 21684, // 50%
    buyerContributionStatus: 'paid',
    travelerContributionStatus: 'paid',
    totalFundingInr: 43368,
    
    carryingFeeInr: 4337, // ~10%
    carryingFeeUsd: 52,
    carryingFeeStatus: 'paid',
    
    reimbursementInr: 21684,
    reimbursementStatus: 'completed',
    reimbursementDate: '2026-10-26T14:20:00Z',
    
    status: 'completed',
    purchaseDate: '2026-10-10T09:15:00Z',
    expectedHandoverDate: '2026-10-25',
    actualHandoverDate: '2026-10-25T16:30:00Z',
    
    purchaseReceipt: 'demo-receipt-2871.pdf',
    productPhoto: 'demo-product-2871.jpg',
    
    otpVerified: true,
    settlementComplete: true,
    
    note: 'Completed order with full settlement',
  },
];

// Complete transaction history
export const travelerTransactions: readonly TravelerTransaction[] = [
  // Order P-3127 - Awaiting traveler contribution
  {
    id: 'txn-trav-001',
    date: '2026-11-01T14:30:00Z',
    orderReference: 'P-3127',
    productName: 'Acne Studios Musubi shoulder bag',
    buyerName: 'Naina Verma',
    type: 'buyer_initial_contribution',
    amountInr: 60462.50,
    amountUsd: 725,
    currency: 'INR',
    status: 'completed',
    note: 'Buyer\'s 50% contribution received',
  },
  
  // Order P-3094 - Awaiting handover
  {
    id: 'txn-trav-002',
    date: '2026-10-28T09:15:00Z',
    orderReference: 'P-3094',
    productName: 'On Running Cloudmonster 2',
    buyerName: 'Kabir Menon',
    type: 'buyer_initial_contribution',
    amountInr: 8741.25,
    amountUsd: 105,
    currency: 'INR',
    status: 'completed',
    note: 'Buyer\'s 50% contribution received',
  },
  {
    id: 'txn-trav-003',
    date: '2026-11-05T11:20:00Z',
    orderReference: 'P-3094',
    productName: 'On Running Cloudmonster 2',
    buyerName: 'Kabir Menon',
    type: 'traveler_product_contribution',
    amountInr: 8741.25,
    amountUsd: 105,
    currency: 'INR',
    status: 'completed',
    note: 'Traveler\'s 50% contribution confirmed',
  },
  {
    id: 'txn-trav-004',
    date: '2026-11-08T10:30:00Z',
    orderReference: 'P-3094',
    productName: 'On Running Cloudmonster 2',
    buyerName: 'Kabir Menon',
    type: 'product_purchase',
    amountInr: 17482.50,
    amountUsd: 210,
    currency: 'INR',
    status: 'completed',
    note: 'Product purchased from store',
  },
  
  // Order P-2871 - Completed
  {
    id: 'txn-trav-005',
    date: '2026-10-01T10:00:00Z',
    orderReference: 'P-2871',
    productName: 'Bang & Olufsen Beoplay HX',
    buyerName: 'Aditi Sen',
    type: 'buyer_initial_contribution',
    amountInr: 21684,
    amountUsd: 260,
    currency: 'INR',
    status: 'completed',
    note: 'Buyer\'s 50% contribution received',
  },
  {
    id: 'txn-trav-006',
    date: '2026-10-05T12:30:00Z',
    orderReference: 'P-2871',
    productName: 'Bang & Olufsen Beoplay HX',
    buyerName: 'Aditi Sen',
    type: 'traveler_product_contribution',
    amountInr: 21684,
    amountUsd: 260,
    currency: 'INR',
    status: 'completed',
    note: 'Traveler\'s 50% contribution confirmed',
  },
  {
    id: 'txn-trav-007',
    date: '2026-10-10T09:15:00Z',
    orderReference: 'P-2871',
    productName: 'Bang & Olufsen Beoplay HX',
    buyerName: 'Aditi Sen',
    type: 'product_purchase',
    amountInr: 43368,
    amountUsd: 520,
    currency: 'INR',
    status: 'completed',
    note: 'Product purchased from store',
  },
  {
    id: 'txn-trav-008',
    date: '2026-10-26T14:20:00Z',
    orderReference: 'P-2871',
    productName: 'Bang & Olufsen Beoplay HX',
    buyerName: 'Aditi Sen',
    type: 'product_reimbursement',
    amountInr: 21684,
    amountUsd: 260,
    currency: 'INR',
    status: 'completed',
    note: 'Traveler contribution reimbursed',
  },
  {
    id: 'txn-trav-009',
    date: '2026-10-26T14:25:00Z',
    orderReference: 'P-2871',
    productName: 'Bang & Olufsen Beoplay HX',
    buyerName: 'Aditi Sen',
    type: 'carrying_fee_earned',
    amountInr: 4337,
    amountUsd: 52,
    currency: 'INR',
    status: 'completed',
    note: 'Carrying fee paid after successful handover',
  },
  {
    id: 'txn-trav-010',
    date: '2026-10-26T14:30:00Z',
    orderReference: 'P-2871',
    productName: 'Bang & Olufsen Beoplay HX',
    buyerName: 'Aditi Sen',
    type: 'final_settlement',
    amountInr: 26021, // Reimbursement + Carrying fee
    amountUsd: 312,
    currency: 'INR',
    status: 'completed',
    note: 'Complete settlement: reimbursement + carrying fee',
  },
];

// Calculate financial summary from transactions
export function calculateTravelerFinancialSummary(orders: readonly TravelerOrderPayment[] = travelerOrderPayments) {
  
  // Carrying fee calculations
  const totalCarryingFeeEarned = orders
    .filter(o => o.carryingFeeStatus === 'paid' || o.carryingFeeStatus === 'released')
    .reduce((sum, o) => sum + o.carryingFeeUsd, 0);
  
  const pendingCarryingFee = orders
    .filter(o => o.carryingFeeStatus === 'eligible' || o.carryingFeeStatus === 'pending')
    .reduce((sum, o) => sum + o.carryingFeeUsd, 0);
  
  const paidCarryingFee = orders
    .filter(o => o.carryingFeeStatus === 'paid')
    .reduce((sum, o) => sum + o.carryingFeeUsd, 0);
  
  // Product contribution calculations
  const totalContributions = orders
    .filter(o => o.travelerContributionStatus === 'paid' || o.travelerContributionStatus === 'confirmed')
    .reduce((sum, o) => sum + o.travelerContributionInr, 0);
  
  const totalReimbursements = orders
    .filter(o => o.reimbursementStatus === 'completed')
    .reduce((sum, o) => sum + o.reimbursementInr, 0);
  
  const pendingReimbursements = orders
    .filter(o => o.reimbursementStatus === 'processing' || o.reimbursementStatus === 'pending')
    .reduce((sum, o) => sum + o.reimbursementInr, 0);
  
  // Order statistics
  const completedDeliveries = orders.filter(o => o.status === 'completed').length;
  const activeOrders = orders.filter(o => o.status !== 'completed').length;
  
  return {
    // Carrying fees (earnings)
    totalCarryingFeeEarned,
    pendingCarryingFee,
    paidCarryingFee,
    totalCarryingFeeInr: totalCarryingFeeEarned * 83.40, // Approximate
    
    // Product contributions (NOT earnings)
    totalContributions,
    totalReimbursements,
    pendingReimbursements,
    
    // Statistics
    completedDeliveries,
    activeOrders,
    totalOrders: orders.length,
  };
}

// Transaction type labels and colors
export const transactionTypeMetadata = {
  buyer_initial_contribution: {
    label: 'Buyer Contribution',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  traveler_product_contribution: {
    label: 'My Contribution',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  product_purchase: {
    label: 'Product Purchase',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  product_reimbursement: {
    label: 'Reimbursement',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  carrying_fee_earned: {
    label: 'Carrying Fee',
    color: 'text-sapphire-strong',
    bgColor: 'bg-sapphire/10',
    borderColor: 'border-sapphire/20',
  },
  final_settlement: {
    label: 'Final Settlement',
    color: 'text-burgundy',
    bgColor: 'bg-burgundy/10',
    borderColor: 'border-burgundy/20',
  },
};
