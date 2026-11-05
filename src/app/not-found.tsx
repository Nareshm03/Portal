import Link from "next/link";
import { PortalMark } from "@/components/shared/portal-mark";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-24">
      <PortalMark />
      <p className="eyebrow mt-12">404</p>
      <h1 className="mt-4">This page is not part of the portal.</h1>
      <div className="gold-rule mt-6" />
      <p className="mt-6 text-muted">
        The address you followed does not belong to any workspace.
      </p>
      <Link
        href="/"
        className="mt-10 inline-flex w-fit items-center gap-2 rounded-md bg-obsidian px-4 py-2.5 text-sm font-medium text-on-obsidian hover:bg-obsidian-soft"
      >
        Return to the entrance
      </Link>
    </main>
  );
}
