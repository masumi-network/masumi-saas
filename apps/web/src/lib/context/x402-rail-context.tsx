"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { useX402NetworksAll } from "@/lib/hooks/use-x402";
import {
  chainsForIsTestnet,
  isX402ChainUsable,
  readX402IsTestnetFromStorage,
  X402_ENV_STORAGE_KEY,
} from "@/lib/x402-rail";
import { isCardanoOnlyPage, isX402OnlyPage } from "@/lib/x402-rail-pages";

export type PaymentRail = "cardano" | "x402";

type X402RailContextValue = {
  activeRail: PaymentRail;
  setActiveRail: (rail: PaymentRail) => void;
  selectedX402ChainId: string | null;
  setSelectedX402ChainId: (id: string | null) => void;
  /** x402 EVM environment — independent of Cardano Preprod/Mainnet after first persist. */
  x402IsTestnet: boolean;
  setX402IsTestnet: (isTestnet: boolean) => void;
  isSetupMode: boolean;
  setIsSetupMode: (value: boolean) => void;
};

const X402RailContext = createContext<X402RailContextValue | null>(null);

const RAIL_STORAGE_KEY = "masumi_payment_rail";
const CHAIN_STORAGE_KEY = "masumi_x402_chain_id";

function readRail(): PaymentRail {
  if (typeof window === "undefined") return "cardano";
  const value = localStorage.getItem(RAIL_STORAGE_KEY);
  return value === "x402" ? "x402" : "cardano";
}

function readChainId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CHAIN_STORAGE_KEY);
}

export function X402RailProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { network: cardanoNetwork } = usePaymentNetwork();
  const { networks, isLoading: networksLoading } = useX402NetworksAll({
    silentErrors: true,
  });

  const [activeRail, setActiveRailState] = useState<PaymentRail>("cardano");
  const [selectedX402ChainId, setSelectedX402ChainIdState] = useState<
    string | null
  >(null);
  const [x402IsTestnet, setX402IsTestnetState] = useState(false);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setActiveRailState(readRail());
      setSelectedX402ChainIdState(readChainId());
      setX402IsTestnetState(
        readX402IsTestnetFromStorage(cardanoNetwork === "Preprod"),
      );
      setHydrated(true);
    }, 0);
    return () => clearTimeout(id);
    // Cardano network is only a one-time default when x402 env was never stored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveRail = useCallback(
    (rail: PaymentRail) => {
      setActiveRailState(rail);
      if (typeof window !== "undefined") {
        localStorage.setItem(RAIL_STORAGE_KEY, rail);
      }
      if (rail === "cardano" && isX402OnlyPage(pathname)) {
        router.push("/");
      }
      if (rail === "x402" && isCardanoOnlyPage(pathname)) {
        router.push("/x402");
      }
    },
    [pathname, router],
  );

  const setSelectedX402ChainId = useCallback((id: string | null) => {
    setSelectedX402ChainIdState(id);
    if (typeof window === "undefined") return;
    if (id) localStorage.setItem(CHAIN_STORAGE_KEY, id);
    else localStorage.removeItem(CHAIN_STORAGE_KEY);
  }, []);

  const setX402IsTestnet = useCallback((isTestnet: boolean) => {
    setX402IsTestnetState(isTestnet);
    if (typeof window !== "undefined") {
      localStorage.setItem(X402_ENV_STORAGE_KEY, String(isTestnet));
    }
  }, []);

  const envChains = useMemo(
    () => chainsForIsTestnet(networks, x402IsTestnet),
    [networks, x402IsTestnet],
  );

  // Keep x402 chain selection coherent with the active x402 environment.
  useEffect(() => {
    if (!hydrated || networksLoading) return;
    if (activeRail !== "x402") return;

    const onX402WorkspacePage = isX402OnlyPage(pathname);

    const selectedChain =
      envChains.find((chain) => chain.id === selectedX402ChainId) ?? null;

    if (selectedChain && isX402ChainUsable(selectedChain)) return;

    if (envChains.length === 0) {
      if (!onX402WorkspacePage) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- No EVM chains for env on Cardano routes.
        setActiveRailState("cardano");
        setSelectedX402ChainIdState(null);
        if (typeof window !== "undefined") {
          localStorage.setItem(RAIL_STORAGE_KEY, "cardano");
          localStorage.removeItem(CHAIN_STORAGE_KEY);
        }
      }
      return;
    }

    const usable = envChains.find(isX402ChainUsable);
    if (usable) {
      if (selectedX402ChainId !== usable.id) {
        setSelectedX402ChainIdState(usable.id);
        if (typeof window !== "undefined") {
          localStorage.setItem(CHAIN_STORAGE_KEY, usable.id);
        }
      }
      return;
    }

    if (!selectedChain) {
      setSelectedX402ChainIdState(envChains[0]?.id ?? null);
      if (envChains[0]?.id && typeof window !== "undefined") {
        localStorage.setItem(CHAIN_STORAGE_KEY, envChains[0].id);
      }
    }
  }, [
    hydrated,
    networksLoading,
    activeRail,
    selectedX402ChainId,
    envChains,
    pathname,
  ]);

  // Auto-select rail from route.
  useEffect(() => {
    if (!hydrated) return;
    if (isX402OnlyPage(pathname) && activeRail !== "x402") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Match rail to x402-only routes.
      setActiveRailState("x402");
      if (typeof window !== "undefined") {
        localStorage.setItem(RAIL_STORAGE_KEY, "x402");
      }
    }
  }, [hydrated, pathname, activeRail]);

  const value = useMemo(
    () => ({
      activeRail,
      setActiveRail,
      selectedX402ChainId,
      setSelectedX402ChainId,
      x402IsTestnet,
      setX402IsTestnet,
      isSetupMode,
      setIsSetupMode,
    }),
    [
      activeRail,
      setActiveRail,
      selectedX402ChainId,
      setSelectedX402ChainId,
      x402IsTestnet,
      setX402IsTestnet,
      isSetupMode,
    ],
  );

  return (
    <X402RailContext.Provider value={value}>
      {children}
    </X402RailContext.Provider>
  );
}

export function useX402Rail(): X402RailContextValue {
  const ctx = useContext(X402RailContext);
  if (!ctx) {
    throw new Error("useX402Rail must be used within X402RailProvider");
  }
  return ctx;
}
