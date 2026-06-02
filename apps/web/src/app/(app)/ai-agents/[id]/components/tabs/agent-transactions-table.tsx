"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormatDate } from "@/hooks/use-format-date";

type TimestampFormatter = (date: Date) => string;

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
    filtered = filtered.filter((t) => {
      const statusNorm = t.status.toLowerCase().replace(/\s+/g, "");
      return statusNorm.includes("refundrequested");
    });
  } else if (filterType === "disputes") {
    filtered = filtered.filter((t) =>
      t.status.toLowerCase().includes("dispute"),
    );
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

function formatStatus(status: string) {
  if (!status) return "—";
  return status.replace(/([A-Z])/g, " $1").trim();
}

function formatTimestamp(
  timestamp: string | null | undefined,
  fmt: TimestampFormatter,
) {
  if (!timestamp) return "—";
  if (/^\d+$/.test(timestamp)) {
    return fmt(new Date(parseInt(timestamp)));
  }
  return fmt(new Date(timestamp));
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
  const { formatDateTime } = useFormatDate();

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
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
              </TableRow>
            ))
          ) : filteredTransactions.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="p-8 text-center text-sm text-muted-foreground"
              >
                {t("noTransactions")}
              </TableCell>
            </TableRow>
          ) : (
            filteredTransactions.map((tx, index) => (
              <TableRow
                key={tx.id}
                className="hover:bg-muted/50 animate-table-row-in transition-[background-color,opacity] duration-150"
                style={{
                  animationDelay: `${Math.min(index, 9) * 40}ms`,
                }}
              >
                <TableCell className="capitalize">{tx.type}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {tx.txHash
                    ? `${tx.txHash.slice(0, 8)}...${tx.txHash.slice(-8)}`
                    : "—"}
                </TableCell>
                <TableCell>{tx.amount}</TableCell>
                <TableCell>{tx.network}</TableCell>
                <TableCell>{formatStatus(tx.status)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {tx.status === "ResultSubmitted"
                    ? formatTimestamp(tx.unlockTime, formatDateTime)
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTimestamp(tx.createdAt, formatDateTime)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
