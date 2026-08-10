"use client";

import { cn } from "@/lib/utils";

type NetworkRegisterShellProps = {
  children: React.ReactNode;
  /** Wider shell when embedding Sumsub; default fits consent / status screens. */
  wide?: boolean;
  className?: string;
};

export function NetworkRegisterShell({
  children,
  wide = false,
  className,
}: NetworkRegisterShellProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full transition-[max-width] duration-200",
        wide ? "max-w-2xl" : "max-w-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
