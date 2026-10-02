"use client";

import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  type PaymentNodeSupportedX402Network,
  usePaymentNodeSupportedX402NetworksQuery,
} from "@/lib/hooks/use-x402-supported-networks";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { cn } from "@/lib/utils";
import type { ChainSearchResult } from "@/lib/x402/chain-registry-types";
import {
  evmNetworkForCardanoPaymentNetwork,
  getEvmChainByCaip2Id,
} from "@/lib/x402/evm-config";

import { ChainLabel } from "./chain-icon";
import { ChainOption } from "./chain-picker-dropdown";

/** Registry mint pairs for x402 HTTP registration (Cardano env ↔ EVM CAIP-2). */
const REGISTRY_CAIP2_BY_CARDANO: Record<PaymentNodeNetwork, string> = {
  Preprod: "eip155:84532",
  Mainnet: "eip155:8453",
};

const REGISTRY_CAIP2_IDS = new Set(Object.values(REGISTRY_CAIP2_BY_CARDANO));

type RegistryChain = ChainSearchResult & {
  cardanoNetwork: PaymentNodeNetwork;
};

function supportedToRegistryChain(
  network: PaymentNodeSupportedX402Network,
  cardanoNetwork: PaymentNodeNetwork,
): RegistryChain {
  const chainId = Number(network.caip2Id.split(":")[1]);
  const preset = getEvmChainByCaip2Id(network.caip2Id);
  return {
    chainId: Number.isFinite(chainId) ? chainId : 0,
    caip2Id: network.caip2Id,
    name: network.displayName,
    shortName: network.displayName,
    isTestnet: network.isTestnet,
    rpcUrl: network.rpcUrl,
    icon: preset?.icon ?? null,
    isCurated: true,
    cardanoNetwork,
  };
}

export function X402RegistryChainPicker({
  cardanoNetwork,
  onCardanoNetworkChange,
  chainIconSlugs,
}: {
  cardanoNetwork: PaymentNodeNetwork;
  onCardanoNetworkChange: (network: PaymentNodeNetwork) => void;
  chainIconSlugs: ReadonlyMap<string, string | null | undefined>;
}) {
  const tChains = useTranslations("App.X402.Chains");
  const tRegister = useTranslations("App.Agents.Register");
  const testnetEnvLabel = tChains("testnet");
  const mainnetEnvLabel = tChains("mainnet");
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 150);

  const { networks, isLoading } = usePaymentNodeSupportedX402NetworksQuery({
    allEnvironments: true,
    silentErrors: true,
  });

  const registryChains = useMemo((): RegistryChain[] => {
    const byCaip2 = new Map<string, PaymentNodeSupportedX402Network>();
    for (const item of networks) {
      if (REGISTRY_CAIP2_IDS.has(item.caip2Id)) {
        byCaip2.set(item.caip2Id, item);
      }
    }

    const out: RegistryChain[] = [];
    for (const [cardano, caip2] of Object.entries(
      REGISTRY_CAIP2_BY_CARDANO,
    ) as [PaymentNodeNetwork, string][]) {
      const fromNode = byCaip2.get(caip2);
      const preset = getEvmChainByCaip2Id(caip2);
      if (fromNode) {
        out.push(supportedToRegistryChain(fromNode, cardano));
      } else if (preset) {
        out.push({
          chainId: Number(caip2.split(":")[1]),
          caip2Id: caip2,
          name: preset.displayName,
          shortName: preset.shortName,
          isTestnet: preset.isTestnet,
          rpcUrl: preset.rpcUrl,
          icon: preset.icon,
          isCurated: true,
          cardanoNetwork: cardano,
        });
      }
    }
    return out;
  }, [networks]);

  const selectedCaip2 = evmNetworkForCardanoPaymentNetwork(cardanoNetwork);
  const selectedChain = useMemo(
    () =>
      registryChains.find((chain) => chain.caip2Id === selectedCaip2) ?? null,
    [registryChains, selectedCaip2],
  );

  const searchLower = debouncedSearch.trim().toLowerCase();
  const displayedChains = useMemo(() => {
    if (!searchLower) return registryChains;
    return registryChains.filter((chain) => {
      const envLabel = chain.isTestnet ? testnetEnvLabel : mainnetEnvLabel;
      return (
        chain.name.toLowerCase().includes(searchLower) ||
        chain.caip2Id.toLowerCase().includes(searchLower) ||
        envLabel.toLowerCase().includes(searchLower)
      );
    });
  }, [registryChains, searchLower, mainnetEnvLabel, testnetEnvLabel]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-auto min-h-11 w-full justify-between py-2 font-normal",
            !selectedChain && "text-muted-foreground",
          )}
          aria-label={tRegister("x402Chain")}
        >
          {selectedChain ? (
            <ChainLabel
              caip2Id={selectedChain.caip2Id}
              name={selectedChain.name}
              iconSlug={
                chainIconSlugs.get(selectedChain.caip2Id) ?? selectedChain.icon
              }
              className="min-w-0 [&_span]:line-clamp-none"
            />
          ) : (
            <span>{tRegister("x402ChainPlaceholder")}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,24rem)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={tChains("chainSearchPlaceholder")}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Spinner size={14} />
                {tChains("chainSearchLoading")}
              </div>
            ) : displayedChains.length === 0 ? (
              <CommandEmpty>{tChains("chainSearchEmpty")}</CommandEmpty>
            ) : (
              <CommandGroup heading={tChains("chainDefaults")}>
                {displayedChains.map((chain) => (
                  <CommandItem
                    key={chain.caip2Id}
                    value={chain.caip2Id}
                    onSelect={() => {
                      onCardanoNetworkChange(chain.cardanoNetwork);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                    className="gap-2 p-2"
                  >
                    <ChainOption
                      chain={chain}
                      testnetLabel={testnetEnvLabel}
                      mainnetLabel={mainnetEnvLabel}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
