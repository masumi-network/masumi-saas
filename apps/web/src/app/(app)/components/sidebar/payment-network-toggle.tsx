"use client";

import { usePathname } from "next/navigation";

import { useSidebar } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { useX402Networks } from "@/lib/hooks/use-x402";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { isX402OnlyPage } from "@/lib/x402-rail-pages";

const NETWORKS: PaymentNodeNetwork[] = ["Preprod", "Mainnet"];

export function PaymentNetworkToggle() {
  const { network, setNetwork } = usePaymentNetwork();
  const { state, isMobile } = useSidebar();
  const pathname = usePathname();
  const { isLoading: x402NetworksLoading } = useX402Networks({
    silentErrors: true,
    allEnvironments: true,
  });
  const isCollapsed = state === "collapsed" && !isMobile;
  const selectedIndex = NETWORKS.indexOf(network);
  const showX402Loading = isX402OnlyPage(pathname) && x402NetworksLoading;

  return (
    <div className="flex h-16 items-center border-b px-4 transition-[padding] duration-200 ease-linear group-data-[collapsible=icon]:px-2">
      <div className="relative w-full">
        <div className="relative flex w-full rounded-lg bg-muted/80 p-1 ring-1 ring-sidebar-border/60">
          <div
            className="absolute bottom-1 top-1 rounded-md bg-background shadow-sm transition-[left] duration-200 ease-out"
            style={{
              left: isCollapsed
                ? selectedIndex === 0
                  ? `calc(${selectedIndex * 50}% + 4px)`
                  : `calc(${selectedIndex * 50}% + 0px)`
                : `calc(${selectedIndex * 50}% + 4px)`,
              width: isCollapsed ? "calc(50% - 4px)" : "calc(50% - 8px)",
            }}
          />
          {NETWORKS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNetwork(n)}
              title={isCollapsed ? n : undefined}
              className="relative z-10 min-w-0 flex-1 cursor-pointer truncate rounded px-2 py-1.5 text-xs font-medium text-foreground transition-colors"
            >
              {isCollapsed ? n[0] : n}
            </button>
          ))}
        </div>
        {showX402Loading && (
          <div className="absolute -bottom-1 right-0 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Spinner size={12} />
          </div>
        )}
      </div>
    </div>
  );
}
