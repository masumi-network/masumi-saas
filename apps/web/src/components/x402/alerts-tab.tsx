"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useX402LowBalanceRules,
  useX402Networks,
  useX402Wallets,
} from "@/lib/hooks/use-x402";
import { cn, formatX402Amount, groupDigits, shortenAddress } from "@/lib/utils";
import { x402Mutate } from "@/lib/x402/api";
import type { X402LowBalanceRule } from "@/lib/x402/types";

import { X402FormDialog } from "./x402-form-dialog";
import {
  x402ActionsCellWideClass,
  x402ActionsHeadWideClass,
  X402TableEmptyState,
  X402TableLoading,
} from "./x402-table-ui";

const NATIVE = "native";

const STATUS_VARIANT: Record<
  X402LowBalanceRule["status"],
  BadgeProps["variant"]
> = {
  Healthy: "success",
  Low: "warning",
  Unknown: "secondary",
};

const ruleFormSchema = z
  .object({
    evmWalletId: z.string().min(1, "Required"),
    caip2Network: z.string().regex(/^eip155:\d+$/, "Required"),
    assetKind: z.enum(["native", "token"]),
    asset: z.string(),
    thresholdAmount: z.string().regex(/^\d+$/, "Whole number in base units"),
  })
  .refine(
    (v) => v.assetKind === "native" || /^0x[a-fA-F0-9]{40}$/.test(v.asset),
    {
      message: "Must be an EVM token address",
      path: ["asset"],
    },
  );

type RuleFormValues = z.infer<typeof ruleFormSchema>;

export function AlertsTab() {
  const t = useTranslations("App.X402.Alerts");
  const { rules, isLoading, isRefetching, refetch } = useX402LowBalanceRules();
  const { networks, isLoading: networksLoading } = useX402Networks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<X402LowBalanceRule | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<X402LowBalanceRule | null>(
    null,
  );

  const chainLabel = (caip2: string) =>
    networks.find((n) => n.caip2Id === caip2)?.displayName ?? caip2;

  const envChainIds = useMemo(
    () => new Set(networks.map((n) => n.caip2Id)),
    [networks],
  );
  const envRules = useMemo(
    () => rules.filter((rule) => envChainIds.has(rule.caip2Network)),
    [rules, envChainIds],
  );

  const formatRuleAmount = (
    amount: string | null | undefined,
    asset: string,
  ) =>
    asset === NATIVE
      ? `${formatX402Amount(amount, 18)} ETH`
      : `${groupDigits(amount)} ${t("baseUnits")}`;

  const assetLabel = (asset: string) =>
    asset === NATIVE ? t("nativeGas") : shortenAddress(asset, 6);

  const toggleEnabled = async (rule: X402LowBalanceRule) => {
    setBusyId(rule.id);
    const result = await x402Mutate(
      "/low-balance",
      {
        method: "PATCH",
        body: JSON.stringify({ ruleId: rule.id, enabled: !rule.enabled }),
      },
      { errorMessage: t("updateFailed") },
    );
    setBusyId(null);
    if (result) refetch();
  };

  const confirmDelete = async () => {
    if (!ruleToDelete) return;
    const ruleId = ruleToDelete.id;
    setBusyId(ruleId);
    const result = await x402Mutate(
      "/low-balance",
      { method: "DELETE", body: JSON.stringify({ ruleId }) },
      { successMessage: t("deleted"), errorMessage: t("deleteFailed") },
    );
    setBusyId(null);
    setRuleToDelete(null);
    if (result) refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <div className="flex shrink-0 items-center gap-2">
          <RefreshButton onRefresh={refetch} isRefreshing={isRefetching} />
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("addAlert")}
          </Button>
        </div>
      </div>

      {isLoading || networksLoading ? (
        <X402TableLoading />
      ) : envRules.length === 0 ? (
        <X402TableEmptyState
          icon={Bell}
          message={`${t("emptyTitle")}. ${t("emptyDescription")}`}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/80">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {(
                  [
                    "wallet",
                    "chain",
                    "asset",
                    "threshold",
                    "lastSeen",
                    "status",
                  ] as const
                ).map((col) => (
                  <TableHead
                    key={col}
                    className={
                      col === "threshold" || col === "lastSeen"
                        ? "text-right"
                        : undefined
                    }
                  >
                    {t(`columns.${col}`)}
                  </TableHead>
                ))}
                <TableHead className={x402ActionsHeadWideClass}>
                  {t("columns.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {envRules.map((rule, index) => (
                <TableRow
                  key={rule.id}
                  className={cn(
                    "animate-table-row-in transition-[background-color,opacity] duration-150",
                    !rule.enabled && "opacity-50",
                  )}
                  style={{ animationDelay: `${Math.min(index, 9) * 40}ms` }}
                >
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span
                        className="font-mono text-sm"
                        title={rule.evmWalletAddress}
                      >
                        {shortenAddress(rule.evmWalletAddress, 6)}
                      </span>
                      <CopyButton value={rule.evmWalletAddress} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {chainLabel(rule.caip2Network)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {assetLabel(rule.asset)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatRuleAmount(rule.thresholdAmount, rule.asset)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {rule.lastKnownAmount != null
                      ? formatRuleAmount(rule.lastKnownAmount, rule.asset)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[rule.status]}>
                      {rule.status}
                    </Badge>
                  </TableCell>
                  <TableCell className={x402ActionsCellWideClass}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === rule.id}
                        onClick={() => toggleEnabled(rule)}
                      >
                        {rule.enabled ? t("disable") : t("enable")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={t("editAlert")}
                        onClick={() => {
                          setEditing(rule);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        aria-label={t("deleteAlert")}
                        disabled={busyId === rule.id}
                        onClick={() => setRuleToDelete(rule)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        editing={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          refetch();
        }}
      />

      <ConfirmDialog
        open={ruleToDelete !== null}
        onOpenChange={(open) => !open && setRuleToDelete(null)}
        title={t("deleteTitle")}
        description={t("deleteDescription")}
        onConfirm={confirmDelete}
        isLoading={busyId !== null && busyId === ruleToDelete?.id}
        variant="destructive"
        confirmText={t("delete")}
      />
    </div>
  );
}

function AlertDialog({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: X402LowBalanceRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("App.X402.Alerts");
  const { networks } = useX402Networks();
  const { wallets } = useX402Wallets(open);
  const [isSaving, setIsSaving] = useState(false);

  const editingAssetKind =
    editing == null ? "native" : editing.asset === NATIVE ? "native" : "token";

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      evmWalletId: editing?.evmWalletId ?? "",
      caip2Network: editing?.caip2Network ?? "",
      assetKind: editingAssetKind,
      asset: editing && editing.asset !== NATIVE ? editing.asset : "",
      thresholdAmount: editing?.thresholdAmount ?? "",
    },
  });

  const assetKind = useWatch({ control, name: "assetKind" });
  const selectedNetwork = useWatch({ control, name: "caip2Network" });

  const onSubmit = async (data: RuleFormValues) => {
    setIsSaving(true);
    const asset = data.assetKind === "native" ? NATIVE : data.asset;
    const result = editing
      ? await x402Mutate(
          "/low-balance",
          {
            method: "PATCH",
            body: JSON.stringify({
              ruleId: editing.id,
              thresholdAmount: data.thresholdAmount,
            }),
          },
          {
            successMessage: t("updated"),
            errorMessage: t("saveFailed"),
          },
        )
      : await x402Mutate(
          "/low-balance",
          {
            method: "POST",
            body: JSON.stringify({
              evmWalletId: data.evmWalletId,
              caip2Network: data.caip2Network,
              asset,
              thresholdAmount: data.thresholdAmount,
            }),
          },
          {
            successMessage: t("added"),
            errorMessage: t("saveFailed"),
          },
        );
    setIsSaving(false);
    if (result) onSaved();
  };

  return (
    <X402FormDialog
      open={open}
      onClose={onClose}
      title={editing ? t("editTitle") : t("addTitle")}
      description={t("dialogDescription")}
      onSubmit={handleSubmit(onSubmit)}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving
              ? t("saving")
              : editing
                ? t("updateAlert")
                : t("addAlert")}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">{t("fields.wallet")}</label>
        <Controller
          control={control}
          name="evmWalletId"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={!!editing}
            >
              <SelectTrigger aria-label={t("fields.wallet")}>
                <SelectValue placeholder={t("fields.walletPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {wallets.map((wallet) => (
                  <SelectItem
                    key={wallet.id}
                    value={wallet.id}
                    className="font-mono"
                  >
                    {shortenAddress(wallet.address, 8)}
                    <span className="ml-2 text-muted-foreground">
                      {wallet.type}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.evmWalletId && (
          <p className="text-xs text-destructive">
            {errors.evmWalletId.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t("fields.chain")}</label>
        <Controller
          control={control}
          name="caip2Network"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(caip2) => {
                field.onChange(caip2);
                if (assetKind === "token") {
                  const chain = networks.find((n) => n.caip2Id === caip2);
                  setValue("asset", chain?.defaultAsset ?? "", {
                    shouldValidate: true,
                  });
                }
              }}
              disabled={!!editing}
            >
              <SelectTrigger aria-label={t("fields.chain")}>
                <SelectValue placeholder={t("fields.chainPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {networks.map((network) => (
                  <SelectItem key={network.id} value={network.caip2Id}>
                    {network.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.caip2Network && (
          <p className="text-xs text-destructive">
            {errors.caip2Network.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t("fields.asset")}</label>
        <Controller
          control={control}
          name="assetKind"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                if (value === "native") setValue("asset", "");
                else {
                  const chain = networks.find(
                    (n) => n.caip2Id === selectedNetwork,
                  );
                  if (chain?.defaultAsset)
                    setValue("asset", chain.defaultAsset);
                }
              }}
              disabled={!!editing}
            >
              <SelectTrigger aria-label={t("fields.asset")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="native">{t("nativeGas")}</SelectItem>
                <SelectItem value="token">{t("erc20")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {assetKind === "token" && (
          <Input
            aria-label={t("fields.tokenAddress")}
            placeholder="0x…"
            className="font-mono"
            readOnly={!!editing}
            {...register("asset")}
          />
        )}
        {errors.asset && (
          <p className="text-xs text-destructive">{errors.asset.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="alert-thresholdAmount" className="text-sm font-medium">
          {t("fields.threshold")}
        </label>
        <Input
          id="alert-thresholdAmount"
          placeholder="10000000000000000"
          className="font-mono"
          {...register("thresholdAmount")}
        />
        {errors.thresholdAmount && (
          <p className="text-xs text-destructive">
            {errors.thresholdAmount.message}
          </p>
        )}
      </div>
    </X402FormDialog>
  );
}
