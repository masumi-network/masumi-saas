"use client";

import { MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ApiKeyListItem } from "@/lib/actions/auth.action";
import { authClient } from "@/lib/auth/auth.client";

import { CreateApiKeyDialog } from "../../components/dashboard/create-api-key-dialog";
import { formatRelativeDate } from "./format-relative-date";

const EMPTY_CELL = "\u2014";

export function ApiKeysList({ keys }: { keys: ApiKeyListItem[] }) {
  const t = useTranslations("App.ApiKeys");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const filteredKeys = useMemo(() => {
    if (!searchQuery.trim()) return keys;
    const q = searchQuery.toLowerCase().trim();
    return keys.filter(
      (k) =>
        k.name?.toLowerCase().includes(q) ||
        k.prefix?.toLowerCase().includes(q) ||
        k.start?.toLowerCase().includes(q),
    );
  }, [keys, searchQuery]);

  const handleRevoke = async (keyId: string) => {
    setRevokeError(null);
    setRevokeLoading(true);
    try {
      const { error } = await authClient.apiKey.delete({ keyId });
      if (error) {
        setRevokeError(error.message || t("revokeError"));
        return;
      }
      setRevokeKeyId(null);
      router.refresh();
    } catch {
      setRevokeError(t("revokeError"));
    } finally {
      setRevokeLoading(false);
    }
  };

  const handleRefresh = () => {
    startTransition(() => router.refresh());
  };

  return (
    <>
      <div className="min-w-0 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex w-64 items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-6 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton
              onRefresh={handleRefresh}
              isRefreshing={isPending}
              variant="icon-only"
              size="sm"
            />
            <Button
              onClick={() => setCreateOpen(true)}
              size="icon"
              className="md:hidden"
              aria-label={t("addApiKey")}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setCreateOpen(true)}
              className="hidden md:flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {t("addApiKey")}
            </Button>
          </div>
        </div>

        {filteredKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted-surface/50 py-12 px-4 text-center">
            <p className="text-muted-foreground text-sm">
              {searchQuery.trim()
                ? t("noKeysMatchingSearch")
                : t("emptyDescription")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="p-4 pl-6">{t("nameLabel")}</TableHead>
                  <TableHead className="p-4">{t("keyLabel")}</TableHead>
                  <TableHead className="p-4">{t("created")}</TableHead>
                  <TableHead className="p-4">{t("lastUsed")}</TableHead>
                  <TableHead className="sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background p-4 text-right">
                    {t("actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKeys.map((key, index) => (
                  <TableRow
                    key={key.id}
                    className="animate-table-row-in transition-[background-color,opacity] duration-150"
                    style={{
                      animationDelay: `${Math.min(index, 9) * 40}ms`,
                    }}
                  >
                    <TableCell className="p-4 pl-6 font-medium">
                      {key.name || key.prefix || key.start || "API Key"}
                    </TableCell>
                    <TableCell className="p-4 font-mono text-sm text-muted-foreground">
                      {(key.start ?? key.prefix)
                        ? `${key.start ?? key.prefix}…`
                        : EMPTY_CELL}
                    </TableCell>
                    <TableCell className="p-4 text-sm text-muted-foreground">
                      {formatRelativeDate(key.createdAt)}
                    </TableCell>
                    <TableCell className="p-4 text-sm text-muted-foreground">
                      {key.lastRequest
                        ? formatRelativeDate(key.lastRequest)
                        : t("neverUsed")}
                    </TableCell>
                    <TableCell className="sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={t("actions")}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="min-w-[120px]"
                        >
                          <DropdownMenuItem
                            onClick={() => {
                              setRevokeError(null);
                              setRevokeKeyId(key.id);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4 shrink-0" />
                            {t("revoke")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CreateApiKeyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          router.refresh();
        }}
      />

      <Dialog
        open={!!revokeKeyId}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeKeyId(null);
            setRevokeError(null);
          } else {
            setRevokeError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("revoke")}</DialogTitle>
            <DialogDescription>{t("confirmRevoke")}</DialogDescription>
          </DialogHeader>
          {revokeError && (
            <p className="text-sm text-destructive">{revokeError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeKeyId(null)}
              disabled={revokeLoading}
            >
              {t("revokeCancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => revokeKeyId && handleRevoke(revokeKeyId)}
              disabled={revokeLoading}
            >
              {revokeLoading ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  {t("revoke")}
                </>
              ) : (
                t("revokeConfirm")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
