import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type WorkspaceThemeName = "buyer" | "traveler" | "admin";

export interface WorkspaceThemeProps extends HTMLAttributes<HTMLDivElement> {
  workspace: WorkspaceThemeName;
}

/**
 * Scopes the shared design system to a workspace theme.
 * Tokens are defined in globals.css under [data-workspace="…"].
 *
 *   <WorkspaceTheme workspace="traveler">…</WorkspaceTheme>
 */
export function WorkspaceTheme({
  workspace,
  className,
  children,
  ...props
}: WorkspaceThemeProps) {
  return (
    <div data-workspace={workspace} className={cn(className)} {...props}>
      {children}
    </div>
  );
}
