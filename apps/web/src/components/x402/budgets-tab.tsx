"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { createOrgApiKeyAction } from "@/lib/actions/org-api-keys.action";
import {
  useOrgApiKeys,
  useX402Budgets,
  useX402Networks,
  useX402Wallets,
} from "@/lib/hooks/use-x402";
import { groupDigits, shortenAddress } from "@/lib/utils";
import { x402Mutate } from "@/lib/x402/api";
import { getEvmTokenPresetsForChain } from "@/lib/x402/evm-token-presets";
import type { X402Budget } from "@/lib/x402/types";

import { X402FormDialog } from "./x402-form-dialog";

const budgetFormSchema = z.object({
  orgApiKeyId: z.string().min(1, "Required"),
  evmWalletId: z.string().min(1, "Required"),
  caip2Network: z.string().regex(/^eip155:\d+$/, "Required"),
  asset: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be an EVM token address"),
  remainingAmount: z
    .string()
    .regex(/^\d+$/, "Whole number in token base units"),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export function BudgetsTab() {
  const t = useTranslations("App.X402.Budgets");
  const { budgets, isLoading, isRefetching, refetch } = useX402Budgets();
  const { networks, isLoading: networksLoading } = useX402Networks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<X402Budget | null>(null);

  const chainLabel = (caip2: string) =>
    networks.find((n) => n.caip2Id === caip2)?.displayName ?? caip2;

  const envChainIds = useMemo(
    () => new Set(networks.map((n) => n.caip2Id)),
    [networks],
  );
  const envBudgets = useMemo(
    () => budgets.filter((budget) => envChainIds.has(budget.caip2Network)),
    [budgets, envChainIds],
  );

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
            {t("setBudget")}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted/30 dark:bg-muted/15">
            <tr className="border-b">
              {(
                [
                  "orgApiKey",
                  "wallet",
                  "chain",
                  "asset",
                  "remaining",
                  "spent",
                  "actions",
                ] as const
              ).map((col) => (
                <th
                  key={col}
                  scope="col"
                  className={`p-4 text-sm font-medium text-muted-foreground ${
                    col === "remaining" || col === "spent" || col === "actions"
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
            ) : envBudgets.length === 0 ? (
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
              envBudgets.map((budget) => (
                <tr key={budget.id} className="border-b last:border-0">
                  <td className="p-4 font-mono text-xs">
                    {budget.orgApiKeyId}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <span
                        className="font-mono text-sm"
                        title={budget.evmWalletAddress}
                      >
                        {shortenAddress(budget.evmWalletAddress, 6)}
                      </span>
                      <CopyButton value={budget.evmWalletAddress} />
                    </div>
                  </td>
                  <td className="p-4 text-sm">
                    {chainLabel(budget.caip2Network)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm" title={budget.asset}>
                        {shortenAddress(budget.asset, 6)}
                      </span>
                      <CopyButton value={budget.asset} />
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono text-sm">
                    {groupDigits(budget.remainingAmount)}
                  </td>
                  <td className="p-4 text-right font-mono text-sm text-muted-foreground">
                    {groupDigits(budget.spentAmount)}
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("editBudget")}
                      onClick={() => {
                        setEditing(budget);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <BudgetDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        editing={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          refetch();
        }}
      />
    </div>
  );
}

export function BudgetDialog({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: X402Budget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("App.X402.Budgets");
  const queryClient = useQueryClient();
  const { orgApiKeys } = useOrgApiKeys();
  const { networks } = useX402Networks();
  const { wallets } = useX402Wallets(open, "Purchasing");
  const [isSaving, setIsSaving] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [createKeyError, setCreateKeyError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      orgApiKeyId: editing?.orgApiKeyId ?? "",
      evmWalletId: editing?.evmWalletId ?? "",
      caip2Network: editing?.caip2Network ?? "",
      asset: editing?.asset ?? "",
      remainingAmount: editing?.remainingAmount ?? "",
    },
  });

  const selectedNetwork = useWatch({ control, name: "caip2Network" });
  const selectedChain = useMemo(
    () =>
      networks.find((network) => network.caip2Id === selectedNetwork) ?? null,
    [networks, selectedNetwork],
  );
  const tokenPresets = useMemo(
    () =>
      getEvmTokenPresetsForChain(selectedNetwork, selectedChain?.defaultAsset),
    [selectedChain?.defaultAsset, selectedNetwork],
  );

  const handleCreateOrgApiKey = async () => {
    setCreateKeyError(null);
    setIsCreatingKey(true);
    const result = await createOrgApiKeyAction(keyName);
    setIsCreatingKey(false);
    if (!result.success) {
      setCreateKeyError(result.error);
      return;
    }
    setCreatedKey(result.key);
    setValue("orgApiKeyId", result.item.id, { shouldValidate: true });
    await queryClient.invalidateQueries({ queryKey: ["org-api-keys"] });
  };

  const onSelectNetwork = (caip2: string) => {
    setValue("caip2Network", caip2, { shouldValidate: true });
    const chain = networks.find((n) => n.caip2Id === caip2);
    if (chain?.defaultAsset && !editing) {
      setValue("asset", chain.defaultAsset, { shouldValidate: true });
    }
  };

  const onSubmit = async (data: BudgetFormValues) => {
    setIsSaving(true);
    const result = await x402Mutate<X402Budget>(
      "/budgets",
      {
        method: "POST",
        body: JSON.stringify({
          orgApiKeyId: data.orgApiKeyId,
          evmWalletId: data.evmWalletId,
          caip2Network: data.caip2Network,
          asset: data.asset,
          remainingAmount: data.remainingAmount,
        }),
      },
      {
        successMessage: editing ? t("updated") : t("set"),
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
      title={editing ? t("editTitle") : t("setTitle")}
      description={t("dialogDescription")}
      maxWidthClassName="sm:max-w-lg"
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
                ? t("updateBudget")
                : t("setBudget")}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">{t("fields.orgApiKey")}</label>
        {orgApiKeys.length === 0 && !createdKey ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{t("noOrgApiKeys")}</p>
            <Input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder={t("orgApiKeyNamePlaceholder")}
              disabled={isCreatingKey}
            />
            {createKeyError && (
              <p className="text-xs text-destructive">{createKeyError}</p>
            )}
            <Button
              type="button"
              size="sm"
              disabled={isCreatingKey || !keyName.trim()}
              onClick={() => void handleCreateOrgApiKey()}
            >
              {isCreatingKey ? t("saving") : t("createOrgApiKey")}
            </Button>
          </div>
        ) : (
          <>
            {createdKey && (
              <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs text-muted-foreground">
                  {t("orgApiKeyCreated")}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                    {createdKey}
                  </code>
                  <CopyButton value={createdKey} />
                </div>
              </div>
            )}
            <Controller
              control={control}
              name="orgApiKeyId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!!editing}
                >
                  <SelectTrigger aria-label={t("fields.orgApiKey")}>
                    <SelectValue
                      placeholder={t("fields.orgApiKeyPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {orgApiKeys.map((key) => (
                      <SelectItem key={key.id} value={key.id}>
                        <span className="font-mono text-xs">
                          {key.keyPrefix}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          {key.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </>
        )}
        {errors.orgApiKeyId && (
          <p className="text-xs text-destructive">
            {errors.orgApiKeyId.message}
          </p>
        )}
      </div>

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
        <Select
          value={selectedNetwork}
          onValueChange={onSelectNetwork}
          disabled={!!editing}
        >
          <SelectTrigger aria-label={t("fields.chain")}>
            <SelectValue placeholder={t("fields.chainPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {networks.map((network) => (
              <SelectItem key={network.id} value={network.caip2Id}>
                {network.displayName}
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {network.caip2Id}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.caip2Network && (
          <p className="text-xs text-destructive">
            {errors.caip2Network.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="budget-asset" className="text-sm font-medium">
          {t("fields.asset")}
        </label>
        {tokenPresets.length > 0 && !editing ? (
          <div className="flex flex-wrap gap-2">
            {tokenPresets.map((preset) => (
              <Button
                key={`${preset.id}-${preset.address}`}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  setValue("asset", preset.address, { shouldValidate: true })
                }
              >
                {preset.label}
              </Button>
            ))}
          </div>
        ) : null}
        <Input
          id="budget-asset"
          placeholder="0x…"
          className="font-mono"
          readOnly={!!editing}
          {...register("asset")}
        />
        {errors.asset ? (
          <p className="text-xs text-destructive">{errors.asset.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t("assetHint")}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="budget-remainingAmount" className="text-sm font-medium">
          {t("fields.remainingAmount")}
        </label>
        <Input
          id="budget-remainingAmount"
          placeholder="1000000"
          className="font-mono"
          {...register("remainingAmount")}
        />
        {errors.remainingAmount && (
          <p className="text-xs text-destructive">
            {errors.remainingAmount.message}
          </p>
        )}
      </div>
    </X402FormDialog>
  );
}
