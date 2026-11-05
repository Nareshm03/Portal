import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Heading level. Defaults to h2. */
  as?: "h1" | "h2" | "h3";
  align?: "left" | "center";
  actions?: ReactNode;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  as: Heading = "h2",
  align = "left",
  actions,
  className,
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        centered && "items-center text-center",
        actions && "md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className={cn("max-w-2xl", centered && "mx-auto")}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <Heading className={cn("mt-2.5", centered && "text-balance")}>
          {title}
        </Heading>
        <div className={cn("gold-rule mt-5", centered && "mx-auto")} />
        {description && (
          <p className="mt-5 text-sm leading-relaxed text-muted sm:text-base">
            {description}
          </p>
        )}
      </div>

      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}
