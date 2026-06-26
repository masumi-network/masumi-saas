"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  useX402LowBalanceRules,
  useX402Networks,
  useX402Wallets,
} from "@/lib/hooks/use-x402";
import { cn, formatX402Amount, groupDigits, shortenAddress } from "@/lib/utils";
import { x402Mutate } from "@/lib/x402/api";
import type { X402LowBalanceRule } from "@/lib/x402/types";

import { X402FormDialog } from "./x402-form-dialog";

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
    <div className="space-y-4">
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

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted/30 dark:bg-muted/15">
            <tr className="border-b">
              {(
                [
                  "wallet",
                  "chain",
                  "asset",
                  "threshold",
                  "lastSeen",
                  "status",
                  "actions",
                ] as const
              ).map((col) => (
                <th
                  key={col}
                  scope="col"
                  className={`p-4 text-sm font-medium text-muted-foreground ${
                    col === "threshold" ||
                    col === "lastSeen" ||
                    col === "actions"
                      ? "text-right"
                      : "text-left"
                  }`}
                >
                  {t(`columns.${col}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading || networksLoading ? (
              <tr>
                <td colSpan={7} className="py-10">
                  <div className="flex justify-center">
                    <Spinner />
                  </div>
                </td>
              </tr>
            ) : envRules.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    title={t("emptyTitle")}
                    description={t("emptyDescription")}
                    action={
                      <Button asChild variant="outline" size="sm">
                        <Link href="/x402?tab=Wallets">{t("goToWallets")}</Link>
                      </Button>
                    }
                  />
                </td>
              </tr>
            ) : (
              envRules.map((rule) => (
                <tr
                  key={rule.id}
                  className={cn(
                    "border-b last:border-0",
                    !rule.enabled && "opacity-50",
                  )}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <span
                        className="font-mono text-sm"
                        title={rule.evmWalletAddress}
                      >
                        {shortenAddress(rule.evmWalletAddress, 6)}
                      </span>
                      <CopyButton value={rule.evmWalletAddress} />
                    </div>
                  </td>
                  <td className="p-4 text-sm">
                    {chainLabel(rule.caip2Network)}
                  </td>
                  <td className="p-4 font-mono text-sm">
                    {assetLabel(rule.asset)}
                  </td>
                  <td className="p-4 text-right font-mono text-sm">
                    {formatRuleAmount(rule.thresholdAmount, rule.asset)}
                  </td>
                  <td className="p-4 text-right font-mono text-sm text-muted-foreground">
                    {rule.lastKnownAmount != null
                      ? formatRuleAmount(rule.lastKnownAmount, rule.asset)
                      : "—"}
                  </td>
                  <td className="p-4">
                    <Badge variant={STATUS_VARIANT[rule.status]}>
                      {rule.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
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
                        size="sm"
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
                        size="sm"
                        aria-label={t("deleteAlert")}
                        className="text-destructive hover:text-destructive"
                        disabled={busyId === rule.id}
                        onClick={() => setRuleToDelete(rule)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
