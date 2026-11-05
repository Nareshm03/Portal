import { cn } from "@/lib/utils";
import type { Workspace } from "@/lib/workspaces";

interface WorkspaceBadgeProps {
  workspace: Workspace;
  className?: string;
}

export function WorkspaceBadge({ workspace, className }: WorkspaceBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-gold/40 px-2.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-gold",
        className,
      )}
    >
      {workspace.label}
    </span>
  );
}
