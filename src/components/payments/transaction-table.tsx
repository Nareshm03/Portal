import type { BuyerTransaction, TravelerPayout } from "@/lib/demo/payments";
import { formatCurrency, formatDate } from "@/lib/demo/buyer";
import { cn } from "@/lib/utils";

interface BuyerTransactionTableProps {
  transactions: readonly BuyerTransaction[];
}

interface TravelerPayoutTableProps {
  payouts: readonly TravelerPayout[];
}

export function BuyerTransactionTable({ transactions }: BuyerTransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">No transactions yet</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Your payment history will appear here once you accept quotes
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
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
                Product
              </th>
              <th className="px-5 py-3 text-left text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Amount USD
              </th>
              <th className="px-5 py-3 text-left text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Rate
              </th>
              <th className="px-5 py-3 text-right text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Paid INR
              </th>
              <th className="px-5 py-3 text-right text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction, index) => (
              <tr
                key={transaction.id}
                className={cn(
                  "border-b border-border transition-colors hover:bg-surface-hover",
                  index === transactions.length - 1 && "border-b-0"
                )}
              >
                <td className="px-5 py-4 text-sm tabular-nums text-muted">
                  {formatDate(transaction.date.split('T')[0])}
                </td>
                <td className="px-5 py-4 text-sm font-medium tabular-nums text-foreground">
                  #{transaction.orderReference}
                </td>
                <td className="px-5 py-4 text-sm text-foreground">
                  <div className="max-w-xs">
                    <p className="truncate">{transaction.productName}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {transaction.travelerName}
                    </p>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm tabular-nums text-muted">
                  {formatCurrency(transaction.amountUsd, 'USD', 0)}
                </td>
                <td className="px-5 py-4 text-sm tabular-nums text-muted">
                  {transaction.exchangeRate.toFixed(2)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-medium tabular-nums text-burgundy">
                  ₹{transaction.totalPaidInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </td>
                <td className="px-5 py-4 text-right">
                  <StatusBadge status={transaction.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TravelerPayoutTable({ payouts }: TravelerPayoutTableProps) {
  if (payouts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">No payouts yet</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Your payout history will appear here once orders are completed
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
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
                Product
              </th>
              <th className="px-5 py-3 text-left text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Earning USD
              </th>
              <th className="px-5 py-3 text-left text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Rate
              </th>
              <th className="px-5 py-3 text-right text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Earning INR
              </th>
              <th className="px-5 py-3 text-right text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((payout, index) => (
              <tr
                key={payout.id}
                className={cn(
                  "border-b border-border transition-colors hover:bg-surface-hover",
                  index === payouts.length - 1 && "border-b-0"
                )}
              >
                <td className="px-5 py-4 text-sm tabular-nums text-muted">
                  {formatDate(payout.date.split('T')[0])}
                </td>
                <td className="px-5 py-4 text-sm font-medium tabular-nums text-foreground">
                  #{payout.orderReference}
                </td>
                <td className="px-5 py-4 text-sm text-foreground">
                  <div className="max-w-xs">
                    <p className="truncate">{payout.productName}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {payout.buyerName}
                    </p>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm tabular-nums text-muted">
                  {formatCurrency(payout.earningUsd, 'USD', 0)}
                </td>
                <td className="px-5 py-4 text-sm tabular-nums text-muted">
                  {payout.exchangeRate.toFixed(2)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-medium tabular-nums text-burgundy">
                  ₹{payout.earningInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </td>
                <td className="px-5 py-4 text-right">
                  <PayoutStatusBadge status={payout.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'pending' | 'completed' | 'failed' }) {
  const variants = {
    pending: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    completed: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    failed: 'bg-red-500/10 text-red-700 border-red-500/20',
  };

  const labels = {
    pending: 'Pending',
    completed: 'Completed',
    failed: 'Failed',
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em]",
        variants[status]
      )}
    >
      {labels[status]}
    </span>
  );
}

function PayoutStatusBadge({ status }: { status: 'pending' | 'released' | 'paid' }) {
  const variants = {
    pending: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    released: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
    paid: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  };

  const labels = {
    pending: 'Pending',
    released: 'Released',
    paid: 'Paid',
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em]",
        variants[status]
      )}
    >
      {labels[status]}
    </span>
  );
}
