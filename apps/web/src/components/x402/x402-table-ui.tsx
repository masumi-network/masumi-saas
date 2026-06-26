"use client";

import type { LucideIcon } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";

export const x402ActionsHeadClass =
  "text-right sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background";

export const x402ActionsCellClass =
  "text-right sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background pointer-events-none [&>*]:pointer-events-auto";

export const x402ActionsHeadWideClass =
  "text-right sticky right-0 z-10 w-64 min-w-64 bg-gradient-to-r from-transparent via-background/80 to-background";

export const x402ActionsCellWideClass =
  "text-right sticky right-0 z-10 w-64 min-w-64 bg-gradient-to-r from-transparent via-background/80 to-background pointer-events-none [&>*]:pointer-events-auto";

export function X402TableEmptyState({
  icon: Icon,
  message,
}: {
  icon: LucideIcon;
  message: string;
}) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="mx-auto max-w-md space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-base font-medium">{message}</p>
      </div>
    </div>
  );
}

export function X402TableLoading() {
  return (
    <div className="rounded-xl border border-border/80 px-6 py-14">
      <div className="flex justify-center">
        <Spinner />
      </div>
    </div>
  );
}
