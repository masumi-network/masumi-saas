import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type DiscoveryEmptyStateProps = {
  icon: LucideIcon;
  message: string;
  className?: string;
};

export function DiscoveryEmptyState({
  icon: Icon,
  message,
  className,
}: DiscoveryEmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border/80 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mx-auto max-w-md space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-base font-medium text-foreground">{message}</p>
      </div>
    </div>
  );
}
