"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Package,
  Upload,
  Wallet,
} from "lucide-react";
import { TravelerShell } from "@/components/traveler/traveler-shell";
import { CurrencyConverter } from "@/components/payments/currency-converter";
import { Badge, SectionHeading } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/demo/traveler";
import {
  travelerOrderPayments as initialOrders,
  travelerTransactions as initialTransactions,
  calculateTravelerFinancialSummary,
  transactionTypeMetadata,
  type TransactionType,
  type TravelerOrderPayment,
  type TravelerTransaction,
} from "@/lib/demo/traveler-payments";
import { EXCHANGE_RATE_DISCLAIMER, PAYMENT_DEMO_NOTICE } from "@/lib/demo/payments";
import { cn } from "@/lib/utils";

const STORAGE_KEY_ORDERS = 'portal_traveler_orders';
const STORAGE_KEY_TRANSACTIONS = 'portal_traveler_transactions';

export default function TravelerPaymentsPage() {
  const [selectedTransactionType, setSelectedTransactionType] = useState<TransactionType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [orders, setOrders] = useState<TravelerOrderPayment[]>([]);
  const [transactions, setTransactions] = useState<TravelerTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedOrders = localStorage.getItem(STORAGE_KEY_ORDERS);
      const storedTransactions = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);

      if (storedOrders) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOrders(JSON.parse(storedOrders));
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOrders([...initialOrders]);
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(initialOrders));
      }

      if (storedTransactions) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTransactions(JSON.parse(storedTransactions));
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTransactions([...initialTransactions]);
        localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(initialTransactions));
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrders([...initialOrders]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTransactions([...initialTransactions]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save to localStorage whenever orders or transactions change
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
        localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
    }
  }, [orders, transactions, loading]);

  // Calculate financial summary from current state
  const summary = calculateTravelerFinancialSummary(orders);

  // Update order state
  const updateOrder = (orderId: string, updates: Partial<TravelerOrderPayment>) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId ? { ...order, ...updates } : order
    ));
  };

  // Add transaction
  const addTransaction = (transaction: TravelerTransaction) => {
    setTransactions(prev => [transaction, ...prev]);
  };

  if (loading) {
    return (
      <TravelerShell active="payments">
        <div className="flex min-h-[400px] items-center justify-center">
          <p className="text-muted">Loading payments...</p>
        </div>
      </TravelerShell>
    );
  }

  // Filter transactions
  const filteredTransactions = transactions.filter((txn) => {
    if (selectedTransactionType !== 'all' && txn.type !== selectedTransactionType) {
      return false;
    }
    if (selectedStatus !== 'all' && txn.status !== selectedStatus) {
      return false;
    }
    return true;
  });

  return (
    <TravelerShell active="payments">
      <header>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="eyebrow">Financial management</p>
            <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Payments</h1>
          </div>
          <Badge variant="sapphire">Demo Mode</Badge>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Manage order contributions, track reimbursements, monitor carrying fee earnings, and view complete financial history.
        </p>
      </header>

      {/* Demo notice */}
      <div className="mt-8 rounded-xl border border-sapphire/20 bg-sapphire/5 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 size-5 shrink-0 text-sapphire-strong"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium text-foreground">Demo payment system</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {PAYMENT_DEMO_NOTICE}
            </p>
          </div>
        </div>
      </div>

      {/* A. Financial Overview */}
      <section className="mt-8">
        <SectionHeading
          eyebrow="Financial overview"
          title="Your finances at a glance"
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Total carrying fee earned */}
          <article className="relative overflow-hidden rounded-2xl bg-sapphire-deep p-6 text-ivory">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(100,149,237,0.25),transparent_60%)]"
            />
            <div className="relative">
              <div className="flex items-center justify-between">
                <Wallet
                  className="size-5 text-sapphire-sky"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-ivory/50">
                  Earnings
                </span>
              </div>
              <p className="mt-4 text-3xl font-medium tabular-nums text-sapphire-sky">
                {formatCurrency(summary.totalCarryingFeeEarned, 'USD', 0)}
              </p>
              <p className="mt-1.5 text-xs text-ivory/60">Total carrying fees earned</p>
            </div>
          </article>

          {/* Pending carrying fee */}
          <article className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <Package
                className="size-5 text-amber-600"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Pending
              </span>
            </div>
            <p className="mt-4 text-3xl font-medium tabular-nums text-foreground">
              {formatCurrency(summary.pendingCarryingFee, 'USD', 0)}
            </p>
            <p className="mt-1.5 text-xs text-muted">Pending carrying fees</p>
          </article>

          {/* Total contributions made */}
          <article className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <CreditCard
                className="size-5 text-purple-600"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Contributions
              </span>
            </div>
            <p className="mt-4 text-3xl font-medium tabular-nums text-foreground">
              ₹{summary.totalContributions.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="mt-1.5 text-xs text-muted">Total product contributions</p>
          </article>

          {/* Reimbursements received */}
          <article className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <ArrowUpRight
                className="size-5 text-emerald-600"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Reimbursed
              </span>
            </div>
            <p className="mt-4 text-3xl font-medium tabular-nums text-foreground">
              ₹{summary.totalReimbursements.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="mt-1.5 text-xs text-muted">Product reimbursements received</p>
          </article>

          {/* Pending reimbursements */}
          <article className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <DollarSign
                className="size-5 text-blue-600"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Upcoming
              </span>
            </div>
            <p className="mt-4 text-3xl font-medium tabular-nums text-foreground">
              ₹{summary.pendingReimbursements.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="mt-1.5 text-xs text-muted">Pending reimbursements</p>
          </article>

          {/* Completed deliveries */}
          <article className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <CheckCircle2
                className="size-5 text-emerald-600"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Deliveries
              </span>
            </div>
            <p className="mt-4 text-3xl font-medium tabular-nums text-foreground">
              {summary.completedDeliveries}
            </p>
            <p className="mt-1.5 text-xs text-muted">Completed deliveries</p>
          </article>
        </div>
      </section>

      {/* B. Active Order Payments */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Active orders"
          title="Order contributions and payments"
          description="Track your 50-50 contributions, reimbursements, and carrying fees for each order."
        />
        <div className="mt-6 space-y-6">
          {orders.map((order) => (
            <OrderPaymentCard 
              key={order.id} 
              order={order} 
              onUpdateOrder={updateOrder}
              onAddTransaction={addTransaction}
            />
          ))}
        </div>
      </section>

      {/* Currency converter */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Currency tools"
          title="USD ↔ INR Converter"
          description="Convert between US Dollars and Indian Rupees using live exchange rates."
        />
        <CurrencyConverter className="mt-6" />
        <p className="mt-3 text-[0.6875rem] leading-relaxed text-muted-foreground">
          {EXCHANGE_RATE_DISCLAIMER}
        </p>
      </section>

      {/* F. Transaction History */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Transaction history"
          title="Complete financial activity"
          description="All contributions, purchases, reimbursements, and carrying fee payments."
        />

        {/* Filters */}
        <div className="mt-6 flex flex-wrap gap-3">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Transaction Type
            </label>
            <select
              value={selectedTransactionType}
              onChange={(e) => setSelectedTransactionType(e.target.value as TransactionType | 'all')}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors focus:border-sapphire focus:outline-none focus:ring-1 focus:ring-sapphire"
            >
              <option value="all">All Types</option>
              <option value="buyer_initial_contribution">Buyer Contribution</option>
              <option value="traveler_product_contribution">My Contribution</option>
              <option value="product_purchase">Product Purchase</option>
              <option value="product_reimbursement">Reimbursement</option>
              <option value="carrying_fee_earned">Carrying Fee</option>
              <option value="final_settlement">Final Settlement</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors focus:border-sapphire focus:outline-none focus:ring-1 focus:ring-sapphire"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Transaction table */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface-muted/40">
                  <th className="px-5 py-3 text-left text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Date
                  </th>
                  <th className="px-5 py-3 text-left text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Order
                  </th>
                  <th className="px-5 py-3 text-left text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Type
                  </th>
                  <th className="px-5 py-3 text-left text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Product
                  </th>
                  <th className="px-5 py-3 text-right text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-right text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted">
                      No transactions match your filters
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((txn, index) => {
                    const meta = transactionTypeMetadata[txn.type];
                    return (
                      <tr
                        key={txn.id}
                        className={cn(
                          "border-b border-border transition-colors hover:bg-surface-hover",
                          index === filteredTransactions.length - 1 && "border-b-0"
                        )}
                      >
                        <td className="px-5 py-4 text-sm tabular-nums text-muted">
                          {formatDate(txn.date.split('T')[0])}
                        </td>
                        <td className="px-5 py-4 text-sm font-medium tabular-nums text-foreground">
                          #{txn.orderReference}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em]",
                              meta.color,
                              meta.bgColor,
                              meta.borderColor
                            )}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-foreground">
                          <div className="max-w-xs">
                            <p className="truncate">{txn.productName}</p>
                            <p className="mt-0.5 truncate text-xs text-muted">{txn.buyerName}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right text-sm font-medium tabular-nums">
                          {txn.currency === 'INR' ? (
                            <span className="text-foreground">
                              ₹{txn.amountInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-foreground">
                              {formatCurrency(txn.amountUsd, 'USD', 2)}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <TransactionStatusBadge status={txn.status} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-[0.6875rem] leading-relaxed text-muted-foreground">
          All transactions shown are demo records. Contributions, reimbursements, and carrying
          fees are simulated for demonstration purposes only. No real money is processed.
        </p>
      </section>
    </TravelerShell>
  );
}

// Order Payment Card Component
function OrderPaymentCard({ 
  order, 
  onUpdateOrder,
  onAddTransaction,
}: { 
  order: TravelerOrderPayment;
  onUpdateOrder: (orderId: string, updates: Partial<TravelerOrderPayment>) => void;
  onAddTransaction: (transaction: TravelerTransaction) => void;
}) {
  const handleConfirmContribution = () => {
    // Update order status
    onUpdateOrder(order.id, {
      travelerContributionStatus: 'confirmed',
      status: order.buyerContributionStatus === 'paid' ? 'fully_funded' : 'awaiting_buyer_contribution',
    });

    // Add transaction
    const transaction: TravelerTransaction = {
      id: `txn-${Date.now()}`,
      date: new Date().toISOString(),
      orderReference: order.orderReference,
      productName: order.productName,
      buyerName: order.buyerName,
      type: 'traveler_product_contribution',
      amountInr: order.travelerContributionInr,
      amountUsd: order.travelerContributionInr / order.exchangeRate,
      currency: 'INR',
      status: 'completed',
      note: 'Traveler contribution confirmed',
    };
    onAddTransaction(transaction);

    alert(`✓ Contribution of ₹${order.travelerContributionInr.toLocaleString('en-IN')} confirmed for order ${order.orderReference}`);
  };

  const handleMarkPurchased = () => {
    const now = new Date().toISOString();
    
    // Update order status
    onUpdateOrder(order.id, {
      status: 'awaiting_handover',
      purchaseDate: now,
      travelerContributionStatus: 'paid',
      purchaseReceipt: 'demo-receipt.pdf',
      productPhoto: 'demo-product.jpg',
      carryingFeeStatus: 'eligible',
      reimbursementStatus: 'processing',
    });

    // Add purchase transaction
    const transaction: TravelerTransaction = {
      id: `txn-${Date.now()}`,
      date: now,
      orderReference: order.orderReference,
      productName: order.productName,
      buyerName: order.buyerName,
      type: 'product_purchase',
      amountInr: order.productPriceInr,
      amountUsd: order.productPriceUsd,
      currency: 'INR',
      status: 'completed',
      note: 'Product purchased from store',
    };
    onAddTransaction(transaction);

    alert(`✓ Order ${order.orderReference} marked as purchased. Product proof uploaded.`);
  };

  const handleCompleteHandover = () => {
    const now = new Date().toISOString();
    
    // Prompt for OTP (demo)
    const otp = prompt('Enter buyer OTP to complete handover (demo: enter any 6 digits):');
    if (!otp || otp.length !== 6) {
      alert('❌ Invalid OTP. Handover cancelled.');
      return;
    }

    // Update order to completed
    onUpdateOrder(order.id, {
      status: 'completed',
      actualHandoverDate: now,
      otpVerified: true,
      settlementComplete: true,
      reimbursementStatus: 'completed',
      reimbursementDate: now,
      carryingFeeStatus: 'paid',
    });

    // Add reimbursement transaction
    const reimbursementTxn: TravelerTransaction = {
      id: `txn-${Date.now()}-1`,
      date: now,
      orderReference: order.orderReference,
      productName: order.productName,
      buyerName: order.buyerName,
      type: 'product_reimbursement',
      amountInr: order.reimbursementInr,
      amountUsd: order.reimbursementInr / order.exchangeRate,
      currency: 'INR',
      status: 'completed',
      note: 'Product contribution reimbursed',
    };
    onAddTransaction(reimbursementTxn);

    // Add carrying fee transaction
    setTimeout(() => {
      const carryingFeeTxn: TravelerTransaction = {
        id: `txn-${Date.now()}-2`,
        date: now,
        orderReference: order.orderReference,
        productName: order.productName,
        buyerName: order.buyerName,
        type: 'carrying_fee_earned',
        amountInr: order.carryingFeeInr,
        amountUsd: order.carryingFeeUsd,
        currency: 'INR',
        status: 'completed',
        note: 'Carrying fee paid after successful handover',
      };
      onAddTransaction(carryingFeeTxn);

      // Add final settlement transaction
      setTimeout(() => {
        const settlementTxn: TravelerTransaction = {
          id: `txn-${Date.now()}-3`,
          date: now,
          orderReference: order.orderReference,
          productName: order.productName,
          buyerName: order.buyerName,
          type: 'final_settlement',
          amountInr: order.reimbursementInr + order.carryingFeeInr,
          amountUsd: (order.reimbursementInr + order.carryingFeeInr) / order.exchangeRate,
          currency: 'INR',
          status: 'completed',
          note: 'Complete settlement: reimbursement + carrying fee',
        };
        onAddTransaction(settlementTxn);
      }, 100);
    }, 50);

    alert(`✓ Handover complete! Settlement processed:\n• Reimbursement: ₹${order.reimbursementInr.toLocaleString('en-IN')}\n• Carrying Fee: ₹${order.carryingFeeInr.toLocaleString('en-IN')}\n• Total: ₹${(order.reimbursementInr + order.carryingFeeInr).toLocaleString('en-IN')}`);
  };

  const canConfirmContribution = order.status === 'awaiting_traveler_contribution' && 
    order.travelerContributionStatus === 'pending';
  
  const canMarkPurchased = order.travelerContributionStatus === 'confirmed' && 
    order.buyerContributionStatus === 'paid' && 
    !order.purchaseDate;
  
  const canCompleteHandover = order.status === 'awaiting_handover' && 
    !order.otpVerified;

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-wrap items-start gap-4">
        {/* Product image */}
        <img
          src={order.productImageUrl}
          alt={order.productName}
          className="size-24 rounded-lg border border-border object-cover"
        />

        {/* Order details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-medium text-foreground">{order.productName}</h3>
              <p className="mt-1 text-sm text-muted">
                Order #{order.orderReference} • {order.buyerFirstName}
              </p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          {/* C. 50-50 Contribution Breakdown */}
          <div className="mt-4 rounded-lg border border-border bg-surface-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              50-50 Contribution Breakdown
            </p>
            <div className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Product price ({order.productPriceOriginalCurrency}):</span>
                <span className="font-medium tabular-nums text-foreground">
                  ₹{order.productPriceInr.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted">
                  <span>Buyer contributes (50%):</span>
                  {order.buyerContributionStatus === 'paid' && (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  )}
                </span>
                <span className="font-medium tabular-nums text-blue-600">
                  ₹{order.buyerContributionInr.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted">
                  <span>You contribute (50%):</span>
                  {(order.travelerContributionStatus === 'confirmed' || order.travelerContributionStatus === 'paid') && (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  )}
                </span>
                <span className="font-medium tabular-nums text-purple-600">
                  ₹{order.travelerContributionInr.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="border-t border-border pt-2.5 flex items-center justify-between">
                <span className="font-medium text-foreground">Total funding:</span>
                <span className="text-base font-semibold tabular-nums text-foreground">
                  ₹{order.totalFundingInr.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sapphire-strong">Carrying fee:</span>
                <span className="text-base font-semibold tabular-nums text-sapphire">
                  ₹{order.carryingFeeInr.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            {canConfirmContribution && (
              <button
                type="button"
                onClick={handleConfirmContribution}
                className="mt-4 w-full rounded-lg bg-sapphire px-4 py-2.5 text-sm font-medium text-ivory transition-colors hover:bg-sapphire-deep"
              >
                <Check className="mr-2 inline-block size-4" strokeWidth={2} />
                Confirm My Contribution
              </button>
            )}

            {canMarkPurchased && (
              <button
                type="button"
                onClick={handleMarkPurchased}
                className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                <Upload className="mr-2 inline-block size-4" strokeWidth={2} />
                Mark as Purchased & Upload Proof
              </button>
            )}

            {canCompleteHandover && (
              <button
                type="button"
                onClick={handleCompleteHandover}
                className="mt-4 w-full rounded-lg bg-burgundy px-4 py-2.5 text-sm font-medium text-ivory transition-colors hover:bg-burgundy-deep"
              >
                <CheckCircle2 className="mr-2 inline-block size-4" strokeWidth={2} />
                Complete Handover (Enter OTP)
              </button>
            )}
          </div>

          {/* D. Reimbursement and Carrying Fee */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Reimbursement */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-900">
                Product Reimbursement
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
                ₹{order.reimbursementInr.toLocaleString('en-IN')}
              </p>
              <p className="mt-1 text-xs text-emerald-600">
                Status: {order.reimbursementStatus === 'completed' ? 'Reimbursed' : order.reimbursementStatus === 'processing' ? 'Processing' : 'Pending delivery'}
              </p>
              {order.reimbursementDate && (
                <p className="mt-1 text-xs text-emerald-600">
                  Paid: {formatDate(order.reimbursementDate.split('T')[0])}
                </p>
              )}
            </div>

            {/* Carrying Fee */}
            <div className="rounded-lg border border-sapphire/20 bg-sapphire/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sapphire-strong">
                Carrying Fee Earnings
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-sapphire">
                ₹{order.carryingFeeInr.toLocaleString('en-IN')}
              </p>
              <p className="mt-1 text-xs text-sapphire-strong">
                Status: {order.carryingFeeStatus === 'paid' ? 'Paid' : order.carryingFeeStatus === 'eligible' ? 'Eligible after handover' : 'Pending delivery'}
              </p>
            </div>
          </div>

          {/* E. Handover settlement info */}
          {order.status === 'awaiting_handover' && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-900">
                Handover Settlement
              </p>
              <p className="mt-2 text-sm text-amber-800">
                Expected handover: {formatDate(order.expectedHandoverDate)}
              </p>
              <p className="mt-1 text-xs text-amber-700">
                After successful OTP verification, you will receive your ₹{order.reimbursementInr.toLocaleString('en-IN')} reimbursement + ₹{order.carryingFeeInr.toLocaleString('en-IN')} carrying fee.
              </p>
            </div>
          )}

          {order.status === 'completed' && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                <CheckCircle2 className="size-5" />
                Settlement Complete
              </p>
              <p className="mt-2 text-xs text-emerald-700">
                Delivered on {formatDate(order.actualHandoverDate!.split('T')[0])}. Reimbursement and carrying fee have been processed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: TravelerOrderPayment['status'] }) {
  const variants: Record<TravelerOrderPayment['status'], { label: string; color: string }> = {
    awaiting_traveler_contribution: { label: 'Awaiting Your Contribution', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    awaiting_buyer_contribution: { label: 'Awaiting Buyer', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    fully_funded: { label: 'Fully Funded', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    purchased: { label: 'Purchased', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    in_transit: { label: 'In Transit', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    awaiting_handover: { label: 'Awaiting Handover', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  };

  const variant = variants[status];

  return (
    <span className={cn("inline-flex rounded-full border px-3 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.14em]", variant.color)}>
      {variant.label}
    </span>
  );
}

function TransactionStatusBadge({ status }: { status: string }) {
  const variants = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    processing: 'bg-blue-100 text-blue-700 border-blue-200',
    completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
  };

  const labels = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
  };

  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em]", variants[status as keyof typeof variants])}>
      {labels[status as keyof typeof labels]}
    </span>
  );
}
