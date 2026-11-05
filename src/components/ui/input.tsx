"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      className,
      containerClassName,
      label,
      hint,
      error,
      leadingIcon,
      id,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy =
      [ariaDescribedBy, hintId, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div className={cn("grid gap-2", containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leadingIcon && (
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "h-11 w-full rounded-md border border-border bg-surface px-3.5 text-sm text-foreground shadow-sm transition-colors duration-200",
              "placeholder:text-muted-foreground",
              "focus:border-champagne-strong focus:outline-none focus:ring-2 focus:ring-champagne/30",
              "disabled:cursor-not-allowed disabled:opacity-50",
              leadingIcon && "pl-10",
              error &&
                "border-destructive/60 focus:border-destructive focus:ring-destructive/20",
              className,
            )}
            {...props}
          />
        </div>

        {error ? (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : (
          hint && (
            <p id={hintId} className="text-xs text-muted-foreground">
              {hint}
            </p>
          )
        )}
      </div>
    );
  },
);
