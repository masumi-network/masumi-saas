"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import type { PaymentNodeNetwork } from "@/lib/payment-node";

const COOKIE_NAME = "payment_network";
const DEFAULT_NETWORK: PaymentNodeNetwork = "Preprod";

export type PaymentNetworkContextValue = {
  network: PaymentNodeNetwork;
  setNetwork: (network: PaymentNodeNetwork) => void;
};

const PaymentNetworkContext = createContext<PaymentNetworkContextValue | null>(
  null,
);

export function usePaymentNetwork(): PaymentNetworkContextValue {
  const ctx = useContext(PaymentNetworkContext);
  if (!ctx) {
    throw new Error(
      "usePaymentNetwork must be used within PaymentNetworkProvider",
    );
  }
  return ctx;
}

function readNetworkFromCookie(): PaymentNodeNetwork {
  if (typeof document === "undefined") return DEFAULT_NETWORK;
  const value = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`))
    ?.split("=")[1];
  if (value === "Mainnet" || value === "Preprod") return value;
  return DEFAULT_NETWORK;
}

function writeNetworkCookie(network: PaymentNodeNetwork) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${network}; path=/; max-age=31536000; SameSite=Lax`;
}

export function PaymentNetworkProvider({
  children,
  initialNetwork,
}: {
  children: React.ReactNode;
  initialNetwork?: PaymentNodeNetwork;
}) {
  const [network, setNetworkState] = useState<PaymentNodeNetwork>(
    () => initialNetwork ?? readNetworkFromCookie(),
  );

  useEffect(() => {
    const id = setTimeout(() => setNetworkState(readNetworkFromCookie()), 0);
    return () => clearTimeout(id);
  }, []);

  const setNetwork = useCallback((next: PaymentNodeNetwork) => {
    setNetworkState(next);
    writeNetworkCookie(next);
  }, []);

  const value: PaymentNetworkContextValue = { network, setNetwork };

  return (
    <PaymentNetworkContext.Provider value={value}>
      {children}
    </PaymentNetworkContext.Provider>
  );
}
