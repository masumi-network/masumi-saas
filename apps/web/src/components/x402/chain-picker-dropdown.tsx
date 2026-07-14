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
import { cn } from "@/lib/utils";
import type { ChainSearchResult } from "@/lib/x402/chain-registry-types";
import { getEvmChainByCaip2Id } from "@/lib/x402/evm-config";

import { ChainIcon, ChainLabel } from "./chain-icon";

function supportedToSearchResult(
  network: PaymentNodeSupportedX402Network,
): ChainSearchResult {
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
  };
}

function ChainOption({
  chain,
  testnetLabel,
  mainnetLabel,
}: {
  chain: ChainSearchResult;
  testnetLabel: string;
  mainnetLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <ChainIcon
        caip2Id={chain.caip2Id}
        name={chain.name}
        iconSlug={chain.icon}
        size={18}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{chain.name}</span>
        <span className="block truncate font-mono text-xs text-muted-foreground">
          {chain.caip2Id}
        </span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {chain.isTestnet ? testnetLabel : mainnetLabel}
      </span>
    </div>
  );
}

export function ChainPickerDropdown({
  selectedCaip2Id,
  selectedDisplayName,
  onSelectChain,
  testnet,
}: {
  selectedCaip2Id?: string;
  selectedDisplayName?: string;
  onSelectChain: (chain: ChainSearchResult) => void;
  testnet: boolean;
}) {
  const t = useTranslations("App.X402.Chains");
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastSelected, setLastSelected] = useState<ChainSearchResult | null>(
    null,
  );
  const debouncedSearch = useDebouncedValue(searchQuery, 150);

  const { networks, isLoading } = usePaymentNodeSupportedX402NetworksQuery({
    allEnvironments: true,
    silentErrors: true,
  });

  const supportedChains = useMemo(
    () =>
      networks
        .filter((network) => network.isTestnet === testnet)
        .map(supportedToSearchResult),
    [networks, testnet],
  );

  const selectedChain = useMemo(() => {
    if (!selectedCaip2Id?.trim()) return null;

    if (lastSelected?.caip2Id === selectedCaip2Id) return lastSelected;

    const fromSupported = supportedChains.find(
      (chain) => chain.caip2Id === selectedCaip2Id,
    );
    if (fromSupported) return fromSupported;

    const displayName = selectedDisplayName?.trim();
    if (displayName) {
      const chainId = Number(selectedCaip2Id.split(":")[1]);
      if (!Number.isFinite(chainId)) return null;
      return {
        chainId,
        caip2Id: selectedCaip2Id,
        name: displayName,
        shortName: displayName,
        isTestnet: testnet,
        rpcUrl: null,
        icon: null,
      };
    }

    return null;
  }, [
    lastSelected,
    selectedCaip2Id,
    selectedDisplayName,
    supportedChains,
    testnet,
  ]);

  const searchLower = debouncedSearch.trim().toLowerCase();
  const displayedChains = useMemo(() => {
    if (!searchLower) return supportedChains;
    return supportedChains.filter(
      (chain) =>
        chain.name.toLowerCase().includes(searchLower) ||
        chain.caip2Id.toLowerCase().includes(searchLower),
    );
  }, [searchLower, supportedChains]);

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
            "h-10 w-full shrink-0 justify-between sm:min-w-56 sm:w-auto",
            !selectedChain && "text-muted-foreground",
          )}
          aria-label={t("chainPresetsAria")}
        >
          {selectedChain ? (
            <ChainLabel
              caip2Id={selectedChain.caip2Id}
              name={selectedChain.name}
              iconSlug={selectedChain.icon}
              className="min-w-0"
            />
          ) : (
            <span>{t("chainPresetPlaceholder")}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,22rem)] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("chainSearchPlaceholder")}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Spinner size={14} />
                {t("chainSearchLoading")}
              </div>
            ) : displayedChains.length === 0 ? (
              <CommandEmpty>{t("chainSearchEmpty")}</CommandEmpty>
            ) : (
              <CommandGroup heading={t("chainDefaults")}>
                {displayedChains.map((chain) => (
                  <CommandItem
                    key={chain.caip2Id}
                    value={chain.caip2Id}
                    onSelect={() => {
                      setLastSelected(chain);
                      onSelectChain(chain);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                    className="gap-2 p-2"
                  >
                    <ChainOption
                      chain={chain}
                      testnetLabel={t("testnet")}
                      mainnetLabel={t("mainnet")}
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
