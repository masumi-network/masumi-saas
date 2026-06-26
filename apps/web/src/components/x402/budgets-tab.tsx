"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

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
import { authClient } from "@/lib/auth/auth.client";
import {
  useUserApiKeys,
  useX402Budgets,
  useX402Networks,
  useX402Wallets,
} from "@/lib/hooks/use-x402";
import { groupDigits, shortenAddress } from "@/lib/utils";
import { x402Mutate } from "@/lib/x402/api";
import { getEvmTokenPresetsForChain } from "@/lib/x402/evm-token-presets";
import type { X402Budget } from "@/lib/x402/types";

import { X402FormDialog } from "./x402-form-dialog";
import {
  x402ActionsCellClass,
  x402ActionsHeadClass,
  X402TableEmptyState,
  X402TableLoading,
} from "./x402-table-ui";

const budgetFormSchema = z.object({
  apiKeyId: z.string().min(1, "Required"),
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
  const { apiKeys } = useUserApiKeys();
  const { networks, isLoading: networksLoading } = useX402Networks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<X402Budget | null>(null);
  const [budgetToDelete, setBudgetToDelete] = useState<X402Budget | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const apiKeyLabelById = useMemo(
    () =>
      new Map(
        apiKeys.map((key) => [
          key.id,
          {
            prefix: key.start ?? key.prefix ?? key.id.slice(0, 8),
            name: key.name ?? "API Key",
          },
        ]),
      ),
    [apiKeys],
  );

  const apiKeyLabel = (apiKeyId: string) => {
    const key = apiKeyLabelById.get(apiKeyId);
    if (key == null) return apiKeyId;
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono">{key.prefix}</span>
        <span className="text-muted-foreground">{key.name}</span>
      </span>
    );
  };

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

  const confirmDelete = async () => {
    if (!budgetToDelete) return;
    const budgetId = budgetToDelete.id;
    setBusyId(budgetId);
    const result = await x402Mutate(
      "/budgets",
      { method: "DELETE", body: JSON.stringify({ budgetId }) },
      { successMessage: t("deleted"), errorMessage: t("deleteFailed") },
    );
    setBusyId(null);
    setBudgetToDelete(null);
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
            {t("setBudget")}
          </Button>
        </div>
      </div>

      {isLoading || networksLoading ? (
        <X402TableLoading />
      ) : envBudgets.length === 0 ? (
        <X402TableEmptyState
          icon={CircleDollarSign}
          message={`${t("emptyTitle")}. ${t("emptyDescription")}`}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/80">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {(
                  [
                    "apiKey",
                    "wallet",
                    "chain",
                    "asset",
                    "remaining",
                    "spent",
                  ] as const
                ).map((col) => (
                  <TableHead
                    key={col}
                    className={
                      col === "remaining" || col === "spent"
                        ? "text-right"
                        : undefined
                    }
                  >
                    {t(`columns.${col}`)}
                  </TableHead>
                ))}
                <TableHead className={x402ActionsHeadClass}>
                  {t("columns.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {envBudgets.map((budget, index) => (
                <TableRow
                  key={budget.id}
                  className="animate-table-row-in transition-[background-color,opacity] duration-150"
                  style={{ animationDelay: `${Math.min(index, 9) * 40}ms` }}
                >
                  <TableCell className="text-xs">
                    {apiKeyLabel(budget.apiKeyId)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span
                        className="font-mono text-sm"
                        title={budget.evmWalletAddress}
                      >
                        {shortenAddress(budget.evmWalletAddress, 6)}
                      </span>
                      <CopyButton value={budget.evmWalletAddress} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {chainLabel(budget.caip2Network)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm" title={budget.asset}>
                        {shortenAddress(budget.asset, 6)}
                      </span>
                      <CopyButton value={budget.asset} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {groupDigits(budget.remainingAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {groupDigits(budget.spentAmount)}
                  </TableCell>
                  <TableCell className={x402ActionsCellClass}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={t("editBudget")}
                        onClick={() => {
                          setEditing(budget);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        aria-label={t("deleteBudget")}
                        disabled={busyId === budget.id}
                        onClick={() => setBudgetToDelete(budget)}
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

      <ConfirmDialog
        open={budgetToDelete !== null}
        onOpenChange={(open) => !open && setBudgetToDelete(null)}
        title={t("deleteTitle")}
        description={t("deleteDescription")}
        onConfirm={confirmDelete}
        isLoading={busyId !== null && busyId === budgetToDelete?.id}
        variant="destructive"
        confirmText={t("delete")}
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
  const { apiKeys } = useUserApiKeys();
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
      apiKeyId: editing?.apiKeyId ?? "",
      evmWalletId: editing?.evmWalletId ?? "",
      caip2Network: editing?.caip2Network ?? "",
      asset: editing?.asset ?? "",
      remainingAmount: editing?.remainingAmount ?? "",
    },
  });

  const selectedNetwork = useWatch({ control, name: "caip2Network" });
  const assetValue = useWatch({ control, name: "asset" });
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
  const selectedPresetId = useMemo(
    () =>
      tokenPresets.find(
        (preset) =>
          preset.address.toLowerCase() === (assetValue ?? "").toLowerCase(),
      )?.id,
    [assetValue, tokenPresets],
  );

  const handleCreateApiKey = async () => {
    setCreateKeyError(null);
    setIsCreatingKey(true);
    const { data, error } = await authClient.apiKey.create({
      name: keyName.trim() || undefined,
    });
    setIsCreatingKey(false);
    if (error) {
      setCreateKeyError(error.message || t("createApiKeyFailed"));
      return;
    }
    if (!data?.key || !data?.id) {
      setCreateKeyError(t("createApiKeyFailed"));
      return;
    }
    setCreatedKey(data.key);
    setValue("apiKeyId", data.id, { shouldValidate: true });
    await queryClient.invalidateQueries({ queryKey: ["user-api-keys"] });
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
          apiKeyId: data.apiKeyId,
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
        <label className="text-sm font-medium">{t("fields.apiKey")}</label>
        {apiKeys.length === 0 && !createdKey ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{t("noApiKeys")}</p>
            <Input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder={t("apiKeyNamePlaceholder")}
              disabled={isCreatingKey}
            />
            {createKeyError && (
              <p className="text-xs text-destructive">{createKeyError}</p>
            )}
            <Button
              type="button"
              size="sm"
              disabled={isCreatingKey || !keyName.trim()}
              onClick={() => void handleCreateApiKey()}
            >
              {isCreatingKey ? t("saving") : t("createApiKey")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("manageApiKeysHint")}{" "}
              <Link
                href="/api-keys"
                className="underline hover:text-foreground"
              >
                {t("apiKeysPath")}
              </Link>
            </p>
          </div>
        ) : (
          <>
            {createdKey && (
              <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs text-muted-foreground">
                  {t("apiKeyCreated")}
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
              name="apiKeyId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!!editing}
                >
                  <SelectTrigger aria-label={t("fields.apiKey")}>
                    <SelectValue placeholder={t("fields.apiKeyPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {apiKeys.map((key) => (
                      <SelectItem key={key.id} value={key.id}>
                        <span className="font-mono text-xs">
                          {key.start ?? key.prefix ?? key.id.slice(0, 8)}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          {key.name ?? "API Key"}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </>
        )}
        {errors.apiKeyId && (
          <p className="text-xs text-destructive">{errors.apiKeyId.message}</p>
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            id="budget-asset"
            placeholder="0x…"
            className="font-mono sm:min-w-0 sm:flex-1"
            readOnly={!!editing}
            {...register("asset")}
          />
          {tokenPresets.length > 0 && !editing ? (
            <Select
              value={selectedPresetId}
              onValueChange={(id) => {
                const preset = tokenPresets.find((item) => item.id === id);
                if (preset) {
                  setValue("asset", preset.address, { shouldValidate: true });
                }
              }}
            >
              <SelectTrigger
                className="w-full shrink-0 sm:w-40"
                aria-label={t("assetPresetsAria")}
              >
                <SelectValue placeholder={t("assetPresetPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {tokenPresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
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
