import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionPanelProps = {
  children: ReactNode;
  className?: string;
};

/** Bordered panel shell for Manage / Discovery sections (no inner title block). */
export function SectionPanel({ children, className }: SectionPanelProps) {
  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border border-border/80 bg-background/95 p-4 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
