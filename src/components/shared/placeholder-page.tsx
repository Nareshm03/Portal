import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { WORKSPACES, type Workspace } from "@/lib/workspaces";
import { cn } from "@/lib/utils";
import { WorkspaceBadge } from "./workspace-badge";

interface PlaceholderAction {
  href: string;
  label: string;
}

interface PlaceholderPageProps {
  workspace: Workspace;
  eyebrow: string;
  title: string;
  description: string;
  /** What will eventually live here. Rendered as a quiet checklist. */
  upcoming: string[];
  actions?: PlaceholderAction[];
}

/**
 * Shared shell for every not-yet-built screen.
 * Intentionally static: no data fetching, no auth calls, no forms.
 */
export function PlaceholderPage({
  workspace,
  eyebrow,
  title,
  description,
  upcoming,
  actions = [],
}: PlaceholderPageProps) {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-20 sm:py-24">
      <div className="flex flex-wrap items-center gap-3">
        <WorkspaceBadge workspace={workspace} />
        <span className="eyebrow">{eyebrow}</span>
      </div>

      <h1 className="mt-6 max-w-2xl text-balance">{title}</h1>
      <div className="gold-rule mt-6" />
      <p className="mt-6 text-lg text-muted">{description}</p>

      <div className="mt-12 rounded-xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-2.5 text-muted">
          <Clock className="size-4 text-gold-strong" strokeWidth={1.75} aria-hidden="true" />
          <h6 className="text-foreground">In preparation</h6>
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {upcoming.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-sm text-muted"
            >
              <span
                aria-hidden="true"
                className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-gold"
              />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {actions.length > 0 && (
        <div className="mt-10 flex flex-wrap items-center gap-3">
          {actions.map((action, index) => (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
                index === 0
                  ? "bg-obsidian text-on-obsidian hover:bg-obsidian-soft"
                  : "border border-border-strong text-foreground hover:border-gold hover:text-gold-strong",
              )}
            >
              {action.label}
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}

      <nav className="mt-14 border-t border-border pt-6 text-sm text-muted">
        <span>Other workspaces: </span>
        {(["buyer", "traveler", "admin"] as const)
          .filter((id) => id !== workspace.id)
          .map((id, index) => (
            <span key={id}>
              {index > 0 && <span aria-hidden="true"> · </span>}
              <Link
                href={WORKSPACES[id].loginPath}
                className="text-gold-strong underline-offset-4 hover:underline"
              >
                {WORKSPACES[id].label}
              </Link>
            </span>
          ))}
      </nav>
    </section>
  );
}
