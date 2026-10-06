"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0 text-sm text-foreground sm:text-right">
        {children}
      </div>
    </div>
  );
}

export function ExternalUrl({ href, label }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1 break-all font-mono text-xs hover:underline sm:justify-end"
    >
      <span className="min-w-0 truncate">{label ?? href}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
    </Link>
  );
}

export function isRegistryAuthorSignedInUser(params: {
  authorEmail?: string;
  authorName?: string;
  sessionEmail?: string | null;
  sessionName?: string | null;
}): boolean {
  const sessionEmail = params.sessionEmail?.trim().toLowerCase();
  const authorEmail = params.authorEmail?.trim().toLowerCase();
  if (sessionEmail && authorEmail && sessionEmail === authorEmail) {
    return true;
  }
  const sessionName = params.sessionName?.trim().toLowerCase();
  const authorName = params.authorName?.trim().toLowerCase();
  if (sessionName && authorName && sessionName === authorName) {
    return true;
  }
  return false;
}
