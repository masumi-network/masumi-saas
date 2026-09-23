"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { RefreshButton } from "@/components/ui/refresh-button";
import { type Agent } from "@/lib/api/agent.client";

import {
  AgentTransactionsFiltersPopover,
  countAgentTransactionFilters,
} from "./agent-transactions-filters-popover";
import {
  AgentTransactionsTable,
  type TransactionFilter,
} from "./agent-transactions-table";

interface AgentTransactionsProps {
  agent: Agent;
}

type ApiTransaction = {
  id: string;
  type: "payment" | "purchase";
  txHash: string | null;
  amount: string;
  network: string;
  status: string;
  unlockTime: string | null;
  createdAt: string;
};

export function AgentTransactions({ agent }: AgentTransactionsProps) {
  const t = useTranslations("App.Agents.Details.Transactions");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [isFocused, setIsFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeFilterCount = useMemo(
    () => countAgentTransactionFilters(filter),
    [filter],
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setError(null);
      setIsLoading(true);
      fetch(`/api/agents/${agent.id}/transactions`)
        .then((res) => res.json())
        .then(
          (json: {
            success: boolean;
            data?: { transactions: ApiTransaction[] };
            error?: string;
          }) => {
            if (cancelled) return;
            if (json.success && json.data?.transactions) {
              setTransactions(json.data.transactions);
            } else {
              setTransactions([]);
              if (!json.success && json.error) setError(json.error);
            }
          },
        )
        .catch((err) => {
          if (!cancelled) {
            setTransactions([]);
            setError(err instanceof Error ? err.message : "Failed to load");
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [agent.id, refreshKey]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "f") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      searchInputRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          onClick={() => searchInputRef.current?.focus()}
          className="flex w-full max-w-64 cursor-text items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 sm:max-w-80"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="search"
            placeholder={t("searchLabel")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="h-6 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
          {!isFocused && (
            <kbd className="pointer-events-none hidden h-6 shrink-0 items-center justify-center rounded-md border bg-muted px-2 font-mono text-xs text-foreground sm:inline-flex">
              {t("searchShortcut")}
            </kbd>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <AgentTransactionsFiltersPopover
            filter={filter}
            activeFilterCount={activeFilterCount}
            onFilterChange={setFilter}
            onClear={() => setFilter("all")}
          />
          <RefreshButton
            onRefresh={handleRefresh}
            isRefreshing={isLoading}
            size="md"
            aria-label={t("refreshAria")}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <AgentTransactionsTable
        agentId={agent.id}
        transactions={transactions}
        isLoading={isLoading}
        searchQuery={searchQuery}
        filter={filter}
      />
    </div>
  );
}
