"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Placeholder type - will be replaced when payment service API is wired
type AgentTransaction = {
  id: string;
  type: "payment" | "purchase";
  txHash: string | null;
  amount: string;
  network: string;
  status: string;
  unlockTime: string | null;
  createdAt: string;
};

export type TransactionFilter =
  | "all"
  | "payments"
  | "purchases"
  | "refundRequests"
  | "disputes";

interface AgentTransactionsTableProps {
  agentId: string;
  transactions?: AgentTransaction[];
  isLoading?: boolean;
  searchQuery?: string;
  filter?: TransactionFilter;
}

function filterTransactions(
  txList: AgentTransaction[],
  filterType: TransactionFilter,
  query: string,
): AgentTransaction[] {
  let filtered = [...txList];

  if (filterType === "payments") {
    filtered = filtered.filter((t) => t.type === "payment");
  } else if (filterType === "purchases") {
    filtered = filtered.filter((t) => t.type === "purchase");
  } else if (filterType === "refundRequests") {
    filtered = filtered.filter((t) => t.status === "RefundRequested");
  } else if (filterType === "disputes") {
    filtered = filtered.filter((t) => t.status === "Disputed");
  }

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.id?.toLowerCase().includes(q) ||
        t.txHash?.toLowerCase().includes(q) ||
        t.status?.toLowerCase().includes(q) ||
        t.type?.toLowerCase().includes(q) ||
        t.network?.toLowerCase().includes(q) ||
        t.amount?.toLowerCase().includes(q),
    );
  }

  return filtered;
}

export function AgentTransactionsTable({
  agentId: _agentId,
  transactions = [],
  isLoading = false,
  searchQuery = "",
  filter = "all",
}: AgentTransactionsTableProps) {
  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, filter, searchQuery),
    [transactions, filter, searchQuery],
  );

  const t = useTranslations("App.Agents.Details.Transactions");

  const formatStatus = (status: string) => {
    if (!status) return "—";
    return status.replace(/([A-Z])/g, " $1").trim();
  };

  const formatTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) return "—";
    if (/^\d+$/.test(timestamp)) {
      return new Date(parseInt(timestamp)).toLocaleString();
    }
    return new Date(timestamp).toLocaleString();
  };

  if (!isLoading && filteredTransactions.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("noTransactions")}
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t("type")}</TableHead>
            <TableHead>{t("transactionHash")}</TableHead>
            <TableHead>{t("amount")}</TableHead>
            <TableHead>{t("network")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("unlockTime")}</TableHead>
            <TableHead>{t("date")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-28 bg-muted animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))
            : filteredTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="capitalize">{tx.type}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {tx.txHash
                        ? `${tx.txHash.slice(0, 8)}...${tx.txHash.slice(-8)}`
                        : "—"}
                    </span>
                  </TableCell>
                  <TableCell>{tx.amount}</TableCell>
                  <TableCell>{tx.network}</TableCell>
                  <TableCell>{formatStatus(tx.status)}</TableCell>
                  <TableCell>
                    {tx.status === "ResultSubmitted"
                      ? formatTimestamp(tx.unlockTime)
                      : "—"}
                  </TableCell>
                  <TableCell>{formatTimestamp(tx.createdAt)}</TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}
