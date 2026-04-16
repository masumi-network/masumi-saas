"use client";

import {
  Info,
  MessageSquare,
  PlugZap,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { terminateConnectedAppAction } from "@/lib/actions/connected-apps.action";
import type { ConnectedOidcClient } from "@/lib/auth/connected-oidc-clients";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/utils/format-date";

type SerializedConnectedClient = Omit<
  ConnectedOidcClient,
  "lastTokenIssuedAt" | "firstConnectedAt" | "lastConnectedAt"
> & {
  lastTokenIssuedAt: string | null;
  firstConnectedAt: string | null;
  lastConnectedAt: string | null;
};

type ConnectedAppsSectionProps = {
  clients: SerializedConnectedClient[];
};

function buildInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : "?";
}

export function ConnectedAppsSection({ clients }: ConnectedAppsSectionProps) {
  const t = useTranslations("App.Account.Connected");
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();

  function handleRefresh() {
    startRefresh(() => {
      router.refresh();
      // router.refresh() settles when the RSC payload resolves; the transition
      // owns the pending state so we don't need a manual timeout here.
      toast.success(t("refreshed"));
    });
  }

  return (
    <Card>
      <CardHeader className={clients.length > 0 ? "border-b" : undefined}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <CardTitle className="truncate">{t("title")}</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t("descriptionTooltipLabel")}
                  className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {t("description")}
              </TooltipContent>
            </Tooltip>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                aria-label={t("refresh")}
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw
                  className={cn("h-4 w-4", isRefreshing && "animate-spin")}
                  aria-hidden
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("refresh")}</TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted-surface/50 px-4 py-12">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <PlugZap className="h-6 w-6 text-muted-foreground" aria-hidden />
            </div>
            <p className="text-center text-sm font-medium text-foreground">
              {t("emptyTitle")}
            </p>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              {t("emptyDescription")}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {clients.map((client) => (
              <ConnectedAppRow key={client.clientId} client={client} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectedAppRow({ client }: { client: SerializedConnectedClient }) {
  const t = useTranslations("App.Account.Connected");
  const router = useRouter();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleTerminate() {
    startTransition(async () => {
      const result = await terminateConnectedAppAction(client.clientId);
      if (!result.success) {
        toast.error(result.error || t("error"));
        return;
      }
      toast.success(t("success", { name: client.name }));
      setDialogOpen(false);
      router.refresh();
    });
  }

  const sessionLabel =
    client.activeTokenCount === 0
      ? t("noActiveSessions")
      : client.activeTokenCount === 1
        ? t("activeSession")
        : t("activeSessions", { count: client.activeTokenCount });

  const lastUsedDate = client.lastTokenIssuedAt ?? client.lastConnectedAt;
  const connectedDate = client.firstConnectedAt;

  return (
    <li className="flex flex-col gap-4 py-4 first:pt-2 last:pb-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm font-semibold",
            client.icon
              ? "border border-border bg-muted text-muted-foreground"
              : client.isFirstParty
                ? "bg-primary/10 ring-1 ring-primary/20"
                : "border border-border bg-muted text-muted-foreground",
          )}
        >
          {client.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.icon}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : client.isFirstParty ? (
            <MessageSquare className="h-5 w-5 text-primary" aria-hidden />
          ) : (
            <span aria-hidden>{buildInitial(client.name)}</span>
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{client.name}</p>
            {client.isFirstParty ? (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                {t("firstParty")}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {sessionLabel}
            {client.scopes.length > 0 ? (
              <>
                {" · "}
                {t("scopesCount", { count: client.scopes.length })}
              </>
            ) : null}
            {lastUsedDate ? (
              <>
                {" · "}
                {t("lastUsed", {
                  date: formatRelativeDate(new Date(lastUsedDate)),
                })}
              </>
            ) : connectedDate ? (
              <>
                {" · "}
                {t("connectedOn", {
                  date: formatRelativeDate(new Date(connectedDate)),
                })}
              </>
            ) : null}
          </p>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setDialogOpen(true)}
        className="w-full shrink-0 border-destructive/40 text-destructive hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive sm:w-auto"
      >
        {t("terminate")}
      </Button>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(next) => {
          if (isPending) return;
          setDialogOpen(next);
        }}
      >
        <DialogContent
          className="w-sm max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden"
          closeButtonClassName="top-8 right-4 -translate-y-1/2"
        >
          <div className="shrink-0 border-b border-border bg-masumi-gradient px-6 py-5 pr-12">
            <DialogHeader>
              <DialogTitle>
                {t("confirmTitle", { name: client.name })}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <DialogDescription className="text-muted-foreground text-sm">
              {t("confirmDescription", { name: client.name })}
            </DialogDescription>
          </div>
          <DialogFooter className="shrink-0 flex justify-end gap-2 border-t border-border bg-background px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="w-fit"
              onClick={handleTerminate}
              disabled={isPending}
            >
              {isPending ? <Spinner size={16} className="mr-2" /> : null}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
