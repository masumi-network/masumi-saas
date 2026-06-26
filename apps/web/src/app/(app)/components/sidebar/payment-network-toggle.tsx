"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { useSidebar } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { useX402Rail } from "@/lib/context/x402-rail-context";
import { useX402Networks } from "@/lib/hooks/use-x402";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { isX402OnlyPage } from "@/lib/x402-rail-pages";

const CARDANO_NETWORKS: PaymentNodeNetwork[] = ["Preprod", "Mainnet"];

export function PaymentNetworkToggle() {
  const tChains = useTranslations("App.X402.Chains");
  const { network, setNetwork } = usePaymentNetwork();
  const { x402IsTestnet, setX402IsTestnet } = useX402Rail();
  const { state, isMobile } = useSidebar();
  const pathname = usePathname();
  const { isLoading: x402NetworksLoading } = useX402Networks({
    silentErrors: true,
    allEnvironments: true,
  });
  const isCollapsed = state === "collapsed" && !isMobile;
  const onX402Page = isX402OnlyPage(pathname);
  const showX402Loading = onX402Page && x402NetworksLoading;

  const options = onX402Page
    ? ([
        { key: "testnet", label: tChains("testnet"), selected: x402IsTestnet },
        { key: "mainnet", label: tChains("mainnet"), selected: !x402IsTestnet },
      ] as const)
    : CARDANO_NETWORKS.map((n) => ({
        key: n,
        label: n,
        selected: network === n,
      }));

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.selected),
  );

  const handleSelect = (index: number) => {
    if (onX402Page) {
      setX402IsTestnet(index === 0);
      return;
    }
    const next = CARDANO_NETWORKS[index];
    if (next) setNetwork(next);
  };

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
          {options.map((option, index) => (
            <button
              key={option.key}
              type="button"
              onClick={() => handleSelect(index)}
              title={isCollapsed ? option.label : undefined}
              className="relative z-10 min-w-0 flex-1 cursor-pointer truncate rounded px-2 py-1.5 text-xs font-medium text-foreground transition-colors"
            >
              {isCollapsed ? option.label[0] : option.label}
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
