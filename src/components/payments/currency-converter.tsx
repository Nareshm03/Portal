"use client";

import { useEffect, useState, useMemo } from "react";
import { ArrowLeftRight, TrendingUp } from "lucide-react";
import type { ExchangeRateData } from "@/lib/api/exchange-rate";
import {
  convertInrToUsd,
  convertUsdToInr,
  fetchExchangeRate,
  formatExchangeRate,
  formatRateTimestamp,
} from "@/lib/api/exchange-rate";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

interface CurrencyConverterProps {
  className?: string;
}

export function CurrencyConverter({ className }: CurrencyConverterProps) {
  const [exchangeRate, setExchangeRate] = useState<ExchangeRateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCurrency, setFromCurrency] = useState<'USD' | 'INR'>('USD');
  const [fromAmount, setFromAmount] = useState<string>('100');

  // Fetch exchange rate on mount
  useEffect(() => {
    async function loadRate() {
      setLoading(true);
      const rate = await fetchExchangeRate();
      setExchangeRate(rate);
      setLoading(false);
    }
    loadRate();
  }, []);

  // Calculate converted amount using useMemo to avoid effect
  const toAmount = useMemo(() => {
    if (!exchangeRate) return '';

    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount < 0) {
      return '';
    }

    if (fromCurrency === 'USD') {
      const inr = convertUsdToInr(amount, exchangeRate.rate);
      return inr.toFixed(2);
    } else {
      const usd = convertInrToUsd(amount, exchangeRate.rate);
      return usd.toFixed(2);
    }
  }, [fromAmount, fromCurrency, exchangeRate]);

  // Swap currencies
  const handleSwap = () => {
    setFromCurrency(fromCurrency === 'USD' ? 'INR' : 'USD');
    setFromAmount(toAmount);
  };

  // Handle amount input
  const handleAmountChange = (value: string) => {
    // Allow empty, numbers, and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFromAmount(value);
    }
  };

  const toCurrency = fromCurrency === 'USD' ? 'INR' : 'USD';

  return (
    <div className={cn("rounded-2xl border border-border bg-surface p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <TrendingUp
              className="size-5 text-champagne-strong"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <h3 className="text-base font-medium text-foreground">
              Currency Converter
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted">
            Live USD ↔ INR exchange rate with instant conversion
          </p>
        </div>
        {exchangeRate?.isDemo && (
          <Badge variant="champagne" className="shrink-0">
            Demo Rate
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="mt-6 flex items-center justify-center py-8">
          <div className="text-sm text-muted">Loading exchange rate...</div>
        </div>
      ) : (
        <>
          {/* Exchange rate display */}
          {exchangeRate && (
            <div className="mt-6 rounded-lg border border-champagne/20 bg-champagne/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Current Rate
                  </p>
                  <p className="mt-1 text-2xl font-medium tabular-nums text-foreground">
                    1 USD = ₹{formatExchangeRate(exchangeRate.rate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
                    Updated
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {formatRateTimestamp(exchangeRate.timestamp)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[0.6875rem] text-muted-foreground">
                Source: {exchangeRate.source}
              </p>
            </div>
          )}

          {/* Converter interface */}
          <div className="mt-6 space-y-4">
            {/* From amount */}
            <div>
              <label
                htmlFor="from-amount"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                From
              </label>
              <div className="flex gap-3">
                <input
                  id="from-amount"
                  type="text"
                  inputMode="decimal"
                  value={fromAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted transition-colors focus:border-burgundy-deep focus:outline-none focus:ring-1 focus:ring-burgundy-deep"
                />
                <select
                  value={fromCurrency}
                  onChange={(e) => setFromCurrency(e.target.value as 'USD' | 'INR')}
                  className="w-24 rounded-lg border border-border bg-background px-3 py-3 text-sm font-medium text-foreground transition-colors focus:border-burgundy-deep focus:outline-none focus:ring-1 focus:ring-burgundy-deep"
                >
                  <option value="USD">USD</option>
                  <option value="INR">INR</option>
                </select>
              </div>
            </div>

            {/* Swap button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleSwap}
                className="rounded-full border border-border bg-surface p-2 text-muted transition-colors hover:border-champagne hover:bg-champagne/10 hover:text-champagne"
                aria-label="Swap currencies"
              >
                <ArrowLeftRight className="size-5" strokeWidth={1.75} />
              </button>
            </div>

            {/* To amount */}
            <div>
              <label
                htmlFor="to-amount"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                To
              </label>
              <div className="flex gap-3">
                <input
                  id="to-amount"
                  type="text"
                  value={toAmount}
                  readOnly
                  placeholder="0.00"
                  className="flex-1 rounded-lg border border-border bg-surface-muted px-4 py-3 text-base tabular-nums text-foreground placeholder:text-muted"
                />
                <div className="grid w-24 place-items-center rounded-lg border border-border bg-surface-muted px-3 py-3 text-sm font-medium text-muted">
                  {toCurrency}
                </div>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="mt-4 text-[0.6875rem] leading-relaxed text-muted-foreground">
            Exchange rates are indicative and subject to change. Final conversion
            rates are determined at transaction time by the payment provider.
          </p>
        </>
      )}
    </div>
  );
}
