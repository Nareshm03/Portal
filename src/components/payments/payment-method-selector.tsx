"use client";

import {
  Building,
  CreditCard,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import type { PaymentMethod } from "@/lib/demo/payments";
import { paymentMethods } from "@/lib/demo/payments";
import { cn } from "@/lib/utils";

interface PaymentMethodSelectorProps {
  eligibility: 'buyer' | 'traveler';
  selectedMethod: PaymentMethod | null;
  onMethodChange: (method: PaymentMethod) => void;
  className?: string;
}

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  upi: Smartphone,
  debit_card: CreditCard,
  credit_card: CreditCard,
  international_card: CreditCard,
  net_banking: Building,
  bank_transfer: Building,
};

export function PaymentMethodSelector({
  eligibility,
  selectedMethod,
  onMethodChange,
  className,
}: PaymentMethodSelectorProps) {
  const availableMethods = paymentMethods.filter(
    (method) => method.eligibility === eligibility || method.eligibility === 'both'
  );

  return (
    <div className={cn("space-y-3", className)}>
      {availableMethods.map((method) => {
        const Icon = METHOD_ICONS[method.id];
        const isSelected = selectedMethod === method.id;

        return (
          <button
            key={method.id}
            type="button"
            onClick={() => onMethodChange(method.id)}
            className={cn(
              "flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all",
              isSelected
                ? "border-champagne bg-champagne/10 ring-2 ring-champagne/30"
                : "border-border bg-surface hover:border-champagne/50 hover:bg-surface-hover"
            )}
          >
            {/* Icon */}
            <div
              className={cn(
                "grid size-12 shrink-0 place-items-center rounded-lg border transition-colors",
                isSelected
                  ? "border-champagne/40 bg-champagne/20 text-champagne-strong"
                  : "border-border bg-surface-muted text-muted"
              )}
            >
              <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isSelected ? "text-foreground" : "text-foreground"
                  )}
                >
                  {method.label}
                </p>
                {isSelected && (
                  <span className="rounded-full bg-champagne px-2 py-0.5 text-[0.625rem] font-semibold text-burgundy-deep">
                    Selected
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {method.description}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem]">
                <span className="text-muted-foreground">
                  {method.processingTime}
                </span>
                <span className="text-muted-foreground">•</span>
                <span
                  className={cn(
                    method.fees === 'No additional fees'
                      ? 'text-champagne-strong'
                      : 'text-muted-foreground'
                  )}
                >
                  {method.fees}
                </span>
              </div>
            </div>

            {/* Radio indicator */}
            <div
              className={cn(
                "mt-1 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                isSelected
                  ? "border-champagne bg-champagne"
                  : "border-muted-foreground/30"
              )}
            >
              {isSelected && (
                <div className="size-2 rounded-full bg-burgundy-deep" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
