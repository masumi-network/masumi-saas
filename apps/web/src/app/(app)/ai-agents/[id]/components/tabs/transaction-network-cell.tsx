"use client";

import { SiCardano } from "react-icons/si";

import { ChainLabel } from "@/components/x402/chain-icon";
import { getEvmChainByCaip2Id } from "@/lib/x402/evm-config";

const EMPTY_CELL = "\u2014";

function isEip155Caip2(network: string): boolean {
  return /^eip155:\d+$/.test(network.trim());
}

const CARDANO_NETWORK_LABELS: Record<string, string> = {
  Mainnet: "Cardano Mainnet",
  Preprod: "Cardano Preprod",
};

export function TransactionNetworkCell({ network }: { network: string }) {
  const trimmed = network.trim();
  if (!trimmed) {
    return <span className="text-muted-foreground">{EMPTY_CELL}</span>;
  }

  if (isEip155Caip2(trimmed)) {
    const chain = getEvmChainByCaip2Id(trimmed);
    return (
      <ChainLabel
        caip2Id={trimmed}
        name={chain?.displayName ?? trimmed}
        iconSlug={chain?.icon}
        iconSize={18}
      />
    );
  }

  const cardanoLabel = CARDANO_NETWORK_LABELS[trimmed];
  if (cardanoLabel) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <SiCardano
          className="size-[18px] shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="min-w-0 truncate">{cardanoLabel}</span>
      </div>
    );
  }

  return <span className="min-w-0 truncate">{trimmed}</span>;
}
