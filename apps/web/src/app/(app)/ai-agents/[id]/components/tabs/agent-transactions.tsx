"use client";

import { FilterIcon, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Agent } from "@/lib/api/agent.client";

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
  }, [agent.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger when "f" is pressed without modifiers (Ctrl/Cmd/Alt).
      // Modifiers would indicate a browser shortcut (e.g. Cmd+F) which we must not override.
      if (e.key.toLowerCase() !== "f") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement;
      // Don't steal focus when user is typing in an input or editable field
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

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-row gap-4 items-center justify-between">
        <div
          onClick={() => searchInputRef.current?.focus()}
          className="flex w-full max-w-64 sm:max-w-80 cursor-text items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
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
            <kbd className="hidden sm:inline-flex h-6 shrink-0 items-center justify-center rounded-md border bg-muted px-2 font-mono text-xs text-foreground pointer-events-none">
              {t("searchShortcut")}
            </kbd>
          )}
        </div>
        <div className="text-sm flex items-center gap-2 self-end sm:self-auto">
          <span className="hidden sm:block">{t("showing")}</span>
          <Select
            value={filter}
            onValueChange={(value) => setFilter(value as TransactionFilter)}
          >
            <SelectTrigger className="w-fit flex items-center gap-2 [&>*:last-child]:hidden sm:[&>*:last-child]:inline">
              <FilterIcon className="block sm:hidden size-4 shrink-0" />
              <div className="hidden sm:block">
                <SelectValue className="text-sm" />
              </div>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">{t("filterAll")}</SelectItem>
              <SelectItem value="payments">{t("filterPayments")}</SelectItem>
              <SelectItem value="purchases">{t("filterPurchases")}</SelectItem>
              <SelectItem value="refundRequests">
                {t("filterRefundRequests")}
              </SelectItem>
              <SelectItem value="disputes">{t("filterDisputes")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
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
