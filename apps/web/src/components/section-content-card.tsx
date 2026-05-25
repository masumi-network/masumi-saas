import type { ReactNode } from "react";

import { SectionPanel } from "@/components/section-panel";
import type { PaymentNodeNetwork } from "@/lib/payment-node";

type SectionContentCardProps = {
  title: string;
  description: string;
  network: PaymentNodeNetwork;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Bordered panel for Manage / Discovery sections (matches inbox & agents list chrome). */
export function SectionContentCard({
  title,
  description,
  network,
  actions,
  children,
  className,
}: SectionContentCardProps) {
  return (
    <SectionPanel className={className}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-page-title font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            {network}
          </span>
          {actions}
        </div>
      </div>
      {children}
    </SectionPanel>
  );
}
