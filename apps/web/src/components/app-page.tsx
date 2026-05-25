import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AppPageProps = {
  children: ReactNode;
  className?: string;
  /** Skip entrance animation when nested inside another animated block */
  animate?: boolean;
};

export function AppPage({ children, className, animate = true }: AppPageProps) {
  return (
    <div
      className={cn(
        "min-w-0 space-y-8",
        animate && "animate-page-in",
        className,
      )}
    >
      {children}
    </div>
  );
}
