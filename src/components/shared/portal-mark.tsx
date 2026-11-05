import Link from "next/link";
import { Gem } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortalMarkProps {
  href?: string;
  className?: string;
}

/** Brand mark. Inherits its text color from the surrounding surface. */
export function PortalMark({ href = "/", className }: PortalMarkProps) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <span className="grid size-8 place-items-center rounded-full border border-gold/50 bg-gold/10 transition-colors group-hover:border-gold">
        <Gem className="size-4 text-gold" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <span className="font-serif text-lg uppercase tracking-[0.22em]">
        Portal
      </span>
    </Link>
  );
}
