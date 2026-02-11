"use client";

import { Search } from "lucide-react";
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

export function AgentTransactions({ agent }: AgentTransactionsProps) {
  const t = useTranslations("App.Agents.Details.Transactions");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [isFocused, setIsFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "f" || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
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

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-row flex-wrap gap-4 items-center justify-between">
        <div
          onClick={() => searchInputRef.current?.focus()}
          className="flex w-full max-w-48 sm:max-w-80 cursor-text items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
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
              F
            </kbd>
          )}
        </div>
        <div className="text-sm flex items-center gap-2 self-end sm:self-auto">
          <span className="block">{t("showing")}</span>
          <Select
            value={filter}
            onValueChange={(value) => setFilter(value as TransactionFilter)}
          >
            <SelectTrigger className="w-42">
              <SelectValue />
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
      <AgentTransactionsTable
        agentId={agent.id}
        searchQuery={searchQuery}
        filter={filter}
      />
    </div>
  );
}
