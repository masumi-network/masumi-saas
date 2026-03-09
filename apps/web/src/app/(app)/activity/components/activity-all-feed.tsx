"use client";

import { Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActivityFeedItem } from "@/lib/types/activity";
import { formatDate } from "@/lib/utils";

const EMPTY_CELL = "\u2014"; // em dash for empty table cells

const LIFECYCLE_LABELS: Record<string, string> = {
  RegistrationInitiated: "Registration initiated",
  RegistrationConfirmed: "Registration confirmed",
  RegistrationFailed: "Registration failed",
  DeregistrationRequested: "Deregistration requested",
  DeregistrationConfirmed: "Deregistration confirmed",
  AgentVerified: "Agent verified",
  AgentDeleted: "Agent deleted",
};

export function ActivityAllFeed() {
  const t = useTranslations("App.Activity");
  const router = useRouter();
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/activity");
      const json = await res.json();
      if (json.success && json.data?.items) {
        setItems(json.data.items);
      } else {
        setItems([]);
        if (!json.success && json.error) setError(json.error);
      }
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          className="mt-2 text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => fetchFeed()}
        >
          {t("tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t("type")}</TableHead>
            <TableHead>{t("transactionHash")}</TableHead>
            <TableHead>{t("agent")}</TableHead>
            <TableHead>{t("amount")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("date")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
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
                  <Skeleton className="h-4 w-32" />
                </TableCell>
              </TableRow>
            ))
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="p-8 text-center text-sm text-muted-foreground"
              >
                {t("noActivity")}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const agentId = item.agentId ?? null;
              const handleRowClick = agentId
                ? () => router.push(`/ai-agents/${agentId}`)
                : undefined;
              if (item.kind === "lifecycle") {
                return (
                  <TableRow
                    key={item.id}
                    className={
                      agentId
                        ? "cursor-pointer hover:bg-muted/50"
                        : "hover:bg-muted/50"
                    }
                    onClick={handleRowClick}
                  >
                    <TableCell className="text-sm">
                      {t("agentActivity")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {EMPTY_CELL}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.agentName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {EMPTY_CELL}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {LIFECYCLE_LABELS[item.type] ?? item.type}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(item.date)}
                    </TableCell>
                  </TableRow>
                );
              }
              return (
                <TableRow
                  key={item.id}
                  className={
                    agentId
                      ? "cursor-pointer hover:bg-muted/50"
                      : "hover:bg-muted/50"
                  }
                  onClick={handleRowClick}
                >
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm capitalize">
                      <Receipt className="size-4 text-muted-foreground" />
                      {item.type}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {item.txHash
                      ? `${item.txHash.slice(0, 8)}...${item.txHash.slice(-8)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.agentName ?? "—"}
                  </TableCell>
                  <TableCell>{item.amount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.status.replace(/([A-Z])/g, " $1").trim()}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(item.date)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
