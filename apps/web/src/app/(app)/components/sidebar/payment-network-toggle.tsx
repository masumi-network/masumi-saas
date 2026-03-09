"use client";

import { useSidebar } from "@/components/ui/sidebar";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import type { PaymentNodeNetwork } from "@/lib/payment-node";

const NETWORKS: PaymentNodeNetwork[] = ["Preprod", "Mainnet"];

export function PaymentNetworkToggle() {
  const { network, setNetwork } = usePaymentNetwork();
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;
  const selectedIndex = NETWORKS.indexOf(network);

  return (
    <div className="px-4 border-b h-16 flex items-center group-data-[collapsible=icon]:px-2 transition-[padding] duration-200 ease-linear">
      <div className="relative flex p-1 w-full rounded-md bg-muted">
        {/* Sliding pill */}
        <div
          className="absolute top-1 bottom-1 rounded-md bg-background shadow-sm transition-[left] duration-200 ease-out"
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
            className="relative z-10 flex-1 rounded px-2 py-1.5 text-xs font-medium text-foreground transition-colors truncate cursor-pointer min-w-0"
          >
            {isCollapsed ? n[0] : n}
          </button>
        ))}
      </div>
    </div>
  );
}
