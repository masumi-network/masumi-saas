"use client";

import { CheckCircle2, Plug, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DiscoveryEmptyState } from "@/components/discovery-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HorizontalScrollArea } from "@/components/ui/horizontal-scroll-area";
import { Input } from "@/components/ui/input";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFormatDate } from "@/hooks/use-format-date";

import { AddLangdockConnectionDialog } from "./add-langdock-connection-dialog";
import { IntegrationsTableSkeleton } from "./integrations-table-skeleton";

type Connection = {
  id: string;
  provider: string;
  name: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

const EMPTY_CELL = "\u2014";

function connectionSearchHaystack(connection: Connection): string {
  const metadata = connection.metadata ?? {};
  return [
    connection.name,
    connection.provider,
    String(metadata.lastAgentName ?? ""),
    String(metadata.lastAgentId ?? ""),
    String(metadata.baseUrl ?? ""),
  ]
    .join(" ")
    .toLowerCase();
}

export function IntegrationsPageContent() {
  const t = useTranslations("App.Integrations");
  const { formatRelativeDate } = useFormatDate();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/integrations/langdock", {
        credentials: "include",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || t("loadError"));
      setConnections(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("loadError"));
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "f" || e.ctrlKey || e.metaKey || e.altKey)
        return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredConnections = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((connection) =>
      connectionSearchHaystack(connection).includes(q),
    );
  }, [connections, debouncedSearch]);

  const emptyMessage = debouncedSearch.trim()
    ? t("noConnectionsMatchingSearch")
    : t("empty");

  return (
    <>
      <div className="min-w-0 space-y-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            onClick={() => searchInputRef.current?.focus()}
            className="relative flex min-w-0 flex-1 cursor-text items-center gap-2 rounded-lg border border-border/80 bg-muted-surface/60 px-3 py-2.5 text-sm ring-offset-background transition-colors focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 md:max-w-md lg:max-w-sm"
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="search"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="h-6 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
            {!isSearchFocused && (
              <kbd className="pointer-events-none hidden h-6 shrink-0 items-center justify-center rounded-md border bg-muted px-2 font-mono text-xs text-foreground sm:inline-flex">
                {t("searchShortcut")}
              </kbd>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <RefreshButton
              onRefresh={() => void loadConnections()}
              isRefreshing={loading}
              size="md"
            />
            <Button
              type="button"
              size="icon"
              className="h-9 w-9 md:hidden"
              onClick={() => setDialogOpen(true)}
              aria-label={t("addConnection")}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              className="hidden h-9 items-center gap-2 md:flex"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {t("addConnection")}
            </Button>
          </div>
        </div>

        {loading ? (
          <IntegrationsTableSkeleton />
        ) : filteredConnections.length === 0 ? (
          <DiscoveryEmptyState
            icon={Plug}
            message={emptyMessage}
            description={
              debouncedSearch.trim() ? undefined : t("emptyDescription")
            }
          />
        ) : (
          <HorizontalScrollArea className="rounded-xl border border-border/80">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("table.name")}</TableHead>
                  <TableHead>{t("table.agent")}</TableHead>
                  <TableHead>{t("table.baseUrl")}</TableHead>
                  <TableHead>{t("table.lastChecked")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConnections.map((connection) => {
                  const lastChecked = connection.metadata?.lastCheckedAt;
                  const lastCheckedLabel =
                    typeof lastChecked === "string" && lastChecked
                      ? formatRelativeDate(lastChecked)
                      : EMPTY_CELL;

                  return (
                    <TableRow key={connection.id}>
                      <TableCell className="font-medium">
                        {connection.name}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate text-muted-foreground">
                        {String(
                          connection.metadata?.lastAgentName ?? EMPTY_CELL,
                        )}
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate font-mono text-xs text-muted-foreground">
                        {String(connection.metadata?.baseUrl ?? EMPTY_CELL)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lastCheckedLabel}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {t("connected")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </HorizontalScrollArea>
        )}
      </div>

      <AddLangdockConnectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => void loadConnections()}
      />
    </>
  );
}
