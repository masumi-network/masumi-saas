"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePaymentNetwork } from "@/lib/context/payment-network-context";

const LAST_VISIT_KEY = "masumi_last_activity_visit";
const NEW_COUNT_KEY = "masumi_new_transactions_count";

const REFETCH_INTERVAL_MS = 25_000;

type TransactionItem = { id: string; date: string };

function getLastVisit(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_VISIT_KEY);
}

function setLastVisit(iso: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_VISIT_KEY, iso);
}

function getStoredCount(): number {
  if (typeof window === "undefined") return 0;
  const v = localStorage.getItem(NEW_COUNT_KEY);
  if (!v) return 0;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}

function setStoredCount(n: number): void {
  if (typeof window === "undefined") return;
  const safe = Number.isNaN(n) ? 0 : n;
  localStorage.setItem(NEW_COUNT_KEY, String(safe));
}

export function useNewTransactionsCount(options?: { trackVisit?: boolean }) {
  const trackVisit = options?.trackVisit !== false;
  const { network } = usePaymentNetwork();
  const [newCount, setNewCount] = useState(() =>
    trackVisit ? getStoredCount() : 0,
  );
  const seenIdsRef = useRef<Set<string>>(new Set());
  const hasSeededSeenRef = useRef(false);
  const lastUpdateRef = useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: ["activity", "transactions", "badge", network],
    queryFn: async (): Promise<{
      items: TransactionItem[];
      lastUpdate?: string;
      usedLastUpdate: boolean;
    }> => {
      const sentLastUpdate = lastUpdateRef.current;
      const params = new URLSearchParams({ filter: "transactions", network });
      if (sentLastUpdate) params.set("lastUpdate", sentLastUpdate);
      const res = await fetch(`/api/activity?${params.toString()}`);
      const json = await res.json();
      if (!json.success)
        return { items: [], usedLastUpdate: Boolean(sentLastUpdate) };
      const raw = (json.data?.items ?? []) as TransactionItem[];
      const items = raw.filter(
        (i) => i && typeof i.id === "string" && typeof i.date === "string",
      );
      const newLastUpdate = json.data?.lastUpdate as string | undefined;
      if (newLastUpdate) lastUpdateRef.current = newLastUpdate;
      return {
        items,
        lastUpdate: newLastUpdate,
        usedLastUpdate: Boolean(sentLastUpdate),
      };
    },
    staleTime: REFETCH_INTERVAL_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
    enabled: trackVisit,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const usedLastUpdate = data?.usedLastUpdate ?? false;

  useEffect(() => {
    if (!trackVisit || !data) return;

    if (usedLastUpdate) {
      if (items.length > 0) {
        const nextCount = getStoredCount() + items.length;
        items.forEach((i) => seenIdsRef.current.add(i.id));
        setStoredCount(nextCount);
        queueMicrotask(() => setNewCount(nextCount));
      }
      return;
    }

    if (items.length === 0) return;

    const lastVisit = getLastVisit();

    if (!lastVisit) {
      setLastVisit(new Date().toISOString());
      seenIdsRef.current = new Set(items.map((i) => i.id));
      hasSeededSeenRef.current = true;
      setStoredCount(0);
      queueMicrotask(() => setNewCount(0));
      return;
    }

    const lastVisitTime = new Date(lastVisit).getTime();
    const seen = seenIdsRef.current;

    if (!hasSeededSeenRef.current) {
      const newOnes = items.filter(
        (i) => new Date(i.date).getTime() > lastVisitTime,
      );
      if (newOnes.length > 0) {
        const nextCount = getStoredCount() + newOnes.length;
        setStoredCount(nextCount);
        queueMicrotask(() => setNewCount(nextCount));
      }
      items.forEach((i) => seen.add(i.id));
      hasSeededSeenRef.current = true;
      return;
    }

    const newOnes = items.filter(
      (i) => !seen.has(i.id) && new Date(i.date).getTime() > lastVisitTime,
    );
    if (newOnes.length > 0) {
      const nextCount = getStoredCount() + newOnes.length;
      setStoredCount(nextCount);
      queueMicrotask(() => setNewCount(nextCount));
      newOnes.forEach((i) => seen.add(i.id));
    }
    items.forEach((i) => seen.add(i.id));
  }, [trackVisit, data, items, usedLastUpdate]);

  const markAllAsRead = useCallback(() => {
    if (!trackVisit) return;
    setLastVisit(new Date().toISOString());
    seenIdsRef.current = new Set();
    hasSeededSeenRef.current = false;
    setNewCount(0);
    setStoredCount(0);
  }, [trackVisit]);

  return { newTransactionsCount: newCount, markAllAsRead };
}
