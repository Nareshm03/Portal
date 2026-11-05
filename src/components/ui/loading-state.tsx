import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  /** Fill the available space and center the indicator. */
  fullHeight?: boolean;
  className?: string;
}

const SPINNER_SIZES = {
  sm: "size-4 border-2",
  md: "size-6 border-2",
  lg: "size-9 border-[3px]",
} as const;

export function LoadingState({
  label = "Loading",
  size = "md",
  fullHeight = false,
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-10 text-center",
        fullHeight && "min-h-64 flex-1",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "animate-spin rounded-full border-champagne-strong/25 border-r-burgundy",
          SPINNER_SIZES[size],
        )}
      />
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}
