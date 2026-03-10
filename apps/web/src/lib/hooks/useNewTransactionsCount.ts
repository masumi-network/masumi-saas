"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  return v ? parseInt(v, 10) : 0;
}

function setStoredCount(n: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NEW_COUNT_KEY, String(n));
}

export function useNewTransactionsCount(options?: { trackVisit?: boolean }) {
  const trackVisit = options?.trackVisit !== false;
  const [newCount, setNewCount] = useState(() =>
    trackVisit ? getStoredCount() : 0,
  );
  const seenIdsRef = useRef<Set<string>>(new Set());
  const lastItemsRef = useRef<TransactionItem[]>([]);

  const fetchTransactions = useCallback(async (): Promise<
    TransactionItem[]
  > => {
    const res = await fetch("/api/activity?filter=transactions");
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data?.items)) return [];
    return (json.data.items as TransactionItem[]).filter(
      (i) => i && typeof i.id === "string" && typeof i.date === "string",
    );
  }, []);

  useEffect(() => {
    if (!trackVisit) return;

    let cancelled = false;

    const run = async () => {
      const items = await fetchTransactions();
      if (cancelled) return;

      lastItemsRef.current = items;
      const lastVisit = getLastVisit();

      if (!lastVisit) {
        setLastVisit(new Date().toISOString());
        seenIdsRef.current = new Set(items.map((i) => i.id));
        setNewCount(0);
        setStoredCount(0);
        return;
      }

      const lastVisitTime = new Date(lastVisit).getTime();
      const seen = seenIdsRef.current;
      const newOnes = items.filter(
        (i) => !seen.has(i.id) && new Date(i.date).getTime() > lastVisitTime,
      );

      if (newOnes.length > 0) {
        const nextCount = getStoredCount() + newOnes.length;
        setNewCount(nextCount);
        setStoredCount(nextCount);
        newOnes.forEach((i) => seen.add(i.id));
      }

      items.forEach((i) => seen.add(i.id));
    };

    run();
    const interval = setInterval(run, REFETCH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [trackVisit, fetchTransactions]);

  const markAllAsRead = useCallback(() => {
    if (!trackVisit) return;
    setLastVisit(new Date().toISOString());
    seenIdsRef.current = new Set();
    setNewCount(0);
    setStoredCount(0);
  }, [trackVisit]);

  return { newTransactionsCount: newCount, markAllAsRead };
}
