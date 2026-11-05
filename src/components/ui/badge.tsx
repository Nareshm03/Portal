import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "burgundy"
  | "champagne"
  | "sapphire"
  | "emerald"
  | "ivory"
  | "outline"
  | "muted"
  | "destructive";

const VARIANTS: Record<BadgeVariant, string> = {
  burgundy: "border-burgundy/25 bg-burgundy/10 text-burgundy",
  champagne:
    "border-champagne-strong/35 bg-champagne/20 text-champagne-strong",
  sapphire: "border-sapphire/25 bg-sapphire/10 text-sapphire",
  emerald: "border-emerald/25 bg-emerald/10 text-emerald",
  ivory: "border-border bg-ivory text-burgundy-deep",
  outline: "border-border-strong bg-transparent text-muted",
  muted: "border-border bg-surface-muted text-muted",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({
  className,
  variant = "burgundy",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]",
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-current"
        />
      )}
      {children}
    </span>
  );
}
