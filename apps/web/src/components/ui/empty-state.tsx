"use client";

import { Inbox, SearchX } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: "search" | "inbox";
  className?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  title = "No results found",
  description,
  icon = "inbox",
  className,
  action,
}: EmptyStateProps) {
  const Icon = icon === "search" ? SearchX : Inbox;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className,
      )}
    >
      <div className="mb-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/20 bg-muted">
          <Icon className="h-7 w-7 text-muted-foreground/60" />
        </div>
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-[280px] text-xs text-muted-foreground/70">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
