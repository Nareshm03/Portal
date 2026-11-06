"use client";

import { AlertCircle, CreditCard, DollarSign, Receipt } from "lucide-react";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { CurrencyConverter } from "@/components/payments/currency-converter";
import { PaymentMethodSelector } from "@/components/payments/payment-method-selector";
import { BuyerTransactionTable } from "@/components/payments/transaction-table";
import { Badge, SectionHeading } from "@/components/ui";
import { formatCurrency } from "@/lib/demo/buyer";
import {
  buyerTransactions,
  EXCHANGE_RATE_DISCLAIMER,
  PAYMENT_DEMO_NOTICE,
} from "@/lib/demo/payments";

export default function BuyerPaymentsPage() {
  // Calculate summary stats from transactions
  const completedTransactions = buyerTransactions.filter((t) => t.status === 'completed');
  const totalSpentUsd = completedTransactions.reduce((sum, t) => sum + t.amountUsd, 0);
  const totalSpentInr = completedTransactions.reduce((sum, t) => sum + t.totalPaidInr, 0);
  const totalPlatformFeesInr = completedTransactions.reduce((sum, t) => sum + t.platformFeeInr, 0);

  return (
    <BuyerShell active="payments">
      <header>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="eyebrow">Financial management</p>
            <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Payments</h1>
          </div>
          <Badge variant="champagne">Demo Mode</Badge>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Manage payments, view transaction history, and convert currencies for your orders.
        </p>
      </header>

      {/* Demo notice */}
      <div className="mt-8 rounded-xl border border-champagne/20 bg-champagne/5 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 size-5 shrink-0 text-champagne-strong"
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

      {/* Payment summary */}
      <section className="mt-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total spent */}
          <article className="relative overflow-hidden rounded-2xl bg-burgundy-deep p-6 text-ivory">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(214,185,140,0.25),transparent_60%)]"
            />
            <div className="relative">
              <div className="flex items-center justify-between">
                <DollarSign
                  className="size-5 text-champagne"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-ivory/50">
                  Total
                </span>
              </div>
              <p className="mt-4 text-3xl font-medium tabular-nums text-champagne">
                {formatCurrency(totalSpentUsd, 'USD', 0)}
              </p>
              <p className="mt-1.5 text-xs text-ivory/60">Total spent</p>
            </div>
          </article>

          {/* Total in INR */}
          <article className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <Receipt
                className="size-5 text-champagne-strong"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                INR
              </span>
            </div>
            <p className="mt-4 text-3xl font-medium tabular-nums text-foreground">
              ₹{totalSpentInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="mt-1.5 text-xs text-muted">Total paid in INR</p>
          </article>

          {/* Platform fees */}
          <article className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <CreditCard
                className="size-5 text-muted"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Fees
              </span>
            </div>
            <p className="mt-4 text-3xl font-medium tabular-nums text-foreground">
              ₹{totalPlatformFeesInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="mt-1.5 text-xs text-muted">Platform fees (5%)</p>
          </article>

          {/* Transactions */}
          <article className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <Receipt
                className="size-5 text-muted"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Count
              </span>
            </div>
            <p className="mt-4 text-3xl font-medium tabular-nums text-foreground">
              {completedTransactions.length}
            </p>
            <p className="mt-1.5 text-xs text-muted">Completed transactions</p>
          </article>
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

      {/* Payment methods */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Payment options"
          title="Available payment methods"
          description="Select your preferred payment method for order deposits and final payments."
        />
        <div className="mt-6">
          <PaymentMethodSelector
            eligibility="buyer"
            selectedMethod={null}
            onMethodChange={() => {}}
          />
        </div>
        <div className="mt-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 size-4 shrink-0 text-muted"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div>
              <p className="text-xs font-medium text-foreground">
                Demo payment methods
              </p>
              <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted">
                Payment method selection is for demonstration purposes only. No real
                payment processing occurs in this demo environment. Actual payment
                methods are configured during order checkout with the live payment
                gateway.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Payment breakdown example */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Fee structure"
          title="Payment breakdown"
          description="Understanding how payments are calculated for your orders."
        />
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-sm font-medium text-foreground">Order amount</p>
                <p className="mt-0.5 text-xs text-muted">
                  Product price set by traveler
                </p>
              </div>
              <p className="text-base font-medium tabular-nums text-foreground">
                $100.00
              </p>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-sm font-medium text-foreground">Platform fee</p>
                <p className="mt-0.5 text-xs text-muted">5% of order amount</p>
              </div>
              <p className="text-base font-medium tabular-nums text-foreground">
                $5.00
              </p>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-sm font-medium text-foreground">Initial deposit</p>
                <p className="mt-0.5 text-xs text-muted">
                  25% paid upfront (configured demo value)
                </p>
              </div>
              <p className="text-base font-medium tabular-nums text-champagne-strong">
                $25.00
              </p>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-base font-semibold text-foreground">
                  Total initial payment
                </p>
                <p className="mt-0.5 text-xs text-muted">Deposit + platform fee</p>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-burgundy">
                $30.00
              </p>
            </div>
          </div>
          <p className="mt-4 text-[0.6875rem] leading-relaxed text-muted-foreground">
            Initial deposit secures the order. The remaining balance ($75.00) is paid
            after the traveler confirms purchase. Platform fees are configured in the
            environment settings (PLATFORM_FEE_BPS=500, BUYER_DEPOSIT_BPS=2500).
          </p>
        </div>
      </section>

      {/* Transaction history */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Transaction history"
          title={`${buyerTransactions.length} transactions`}
          description="Complete history of your order payments and currency conversions."
        />
        <div className="mt-6">
          <BuyerTransactionTable transactions={buyerTransactions} />
        </div>
        <p className="mt-4 text-[0.6875rem] leading-relaxed text-muted-foreground">
          All transactions shown are demo records. Exchange rates are historical values
          from the transaction date. No real payments have been processed.
        </p>
      </section>
    </BuyerShell>
  );
}
