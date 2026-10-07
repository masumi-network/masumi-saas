"use client";

import type { ReactNode } from "react";

import { usePinnedOnScroll } from "@/hooks/use-pinned-on-scroll";
import { cn } from "@/lib/utils";

type AgentDetailsPinnedAsideProps = {
  children: ReactNode;
  className?: string;
};

export function AgentDetailsPinnedAside({
  children,
  className,
}: AgentDetailsPinnedAsideProps) {
  const { anchorRef, pinnedRef, layout, spacerHeight } = usePinnedOnScroll();

  return (
    <aside className={cn("min-w-0 lg:self-start", className)}>
      <div ref={anchorRef} className="relative w-full">
        {spacerHeight > 0 ? (
          <div
            aria-hidden
            className="pointer-events-none w-full"
            style={{ height: spacerHeight }}
          />
        ) : null}
        <div
          ref={pinnedRef}
          className={cn(layout.mode === "fixed" && "z-10")}
          style={
            layout.mode === "fixed"
              ? {
                  position: "fixed",
                  top: layout.top,
                  left: layout.left,
                  width: layout.width,
                  maxHeight: `calc(100dvh - ${layout.top}px - 1rem)`,
                  overflowY: "auto",
                }
              : undefined
          }
        >
          {children}
        </div>
      </div>
    </aside>
  );
}
