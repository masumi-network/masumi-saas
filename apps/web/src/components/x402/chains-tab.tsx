"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { useX402SetupDialog } from "@/components/x402/x402-setup-dialog";
import { useX402Networks, useX402Wallets } from "@/lib/hooks/use-x402";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { shortenAddress } from "@/lib/utils";
import { x402Mutate } from "@/lib/x402/api";
import type { X402Network } from "@/lib/x402/types";
import { isTestnetEnv } from "@/lib/x402-rail";

import { X402FormDialog } from "./x402-form-dialog";

const NO_FACILITATOR = "__none__";

const chainSchema = z
  .object({
    caip2Id: z
      .string()
      .regex(
        /^eip155:\d+$/,
        "Must be a CAIP-2 EVM chain id, for example eip155:8453",
      ),
    displayName: z.string().min(1, "Required").max(120),
    rpcUrl: z.string().url("Must be a valid URL"),
    isTestnet: z.boolean(),
    isEnabled: z.boolean(),
    defaultAsset: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Must be an EVM token address")
      .or(z.literal(""))
      .optional(),
    facilitatorWalletId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.isEnabled &&
      (!data.facilitatorWalletId || data.facilitatorWalletId === NO_FACILITATOR)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A facilitator wallet is required to enable a chain",
        path: ["facilitatorWalletId"],
      });
    }
  });

type ChainFormValues = z.infer<typeof chainSchema>;

export function ChainsTab() {
  const t = useTranslations("App.X402.Chains");
  const { openSetup } = useX402SetupDialog();
  const { networks, isLoading, isRefetching, refetch } = useX402Networks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<X402Network | null>(null);

  const openEdit = (network: X402Network) => {
    setEditing(network);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <div className="flex shrink-0 items-center gap-2">
          <RefreshButton onRefresh={refetch} isRefreshing={isRefetching} />
          <Button
            onClick={() => openSetup()}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("addChain")}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted/30 dark:bg-muted/15">
            <tr className="border-b">
              <th
                scope="col"
                className="p-4 text-left text-sm font-medium text-muted-foreground"
              >
                {t("columns.chain")}
              </th>
              <th
                scope="col"
                className="p-4 text-left text-sm font-medium text-muted-foreground"
              >
                {t("columns.rpcUrl")}
              </th>
              <th
                scope="col"
                className="p-4 text-left text-sm font-medium text-muted-foreground"
              >
                {t("columns.status")}
              </th>
              <th
                scope="col"
                className="p-4 text-left text-sm font-medium text-muted-foreground"
              >
                {t("columns.defaultAsset")}
              </th>
              <th
                scope="col"
                className="p-4 text-left text-sm font-medium text-muted-foreground"
              >
                {t("columns.facilitator")}
              </th>
              <th
                scope="col"
                className="p-4 text-right text-sm font-medium text-muted-foreground"
              >
                {t("columns.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-10">
                  <div className="flex justify-center">
                    <Spinner />
                  </div>
                </td>
              </tr>
            ) : networks.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    title={t("emptyTitle")}
                    description={t("emptyDescription")}
                  />
                </td>
              </tr>
            ) : (
              networks.map((network) => (
                <tr key={network.id} className="border-b last:border-0">
                  <td className="p-4">
                    <div className="font-medium">{network.displayName}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {network.caip2Id}
                    </div>
                  </td>
                  <td
                    className="max-w-[260px] truncate p-4 font-mono text-sm"
                    title={network.rpcUrl}
                  >
                    {network.rpcUrl}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={network.isEnabled ? "success" : "secondary"}
                      >
                        {network.isEnabled ? t("enabled") : t("disabled")}
                      </Badge>
                      <Badge variant="outline">
                        {network.isTestnet ? t("testnet") : t("mainnet")}
                      </Badge>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-sm">
                    {network.defaultAsset ? (
                      <div className="flex items-center gap-1">
                        <span title={network.defaultAsset}>
                          {shortenAddress(network.defaultAsset, 6)}
                        </span>
                        <CopyButton value={network.defaultAsset} />
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-4 text-sm">
                    {network.facilitatorWalletId ? (
                      <span className="font-mono">
                        {network.facilitatorWalletAddress
                          ? shortenAddress(network.facilitatorWalletAddress, 6)
                          : network.facilitatorWalletId}
                      </span>
                    ) : (
                      <Badge variant="warning">{t("notSet")}</Badge>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("editChain")}
                      onClick={() => openEdit(network)}
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

      <ChainDialog
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

export function ChainDialog({
  open,
  editing,
  onClose,
  onSaved,
  environmentNetwork,
}: {
  open: boolean;
  editing: X402Network | null;
  onClose: () => void;
  onSaved: () => void;
  /** When set (e.g. from setup wizard), locks testnet/mainnet to match Cardano env. */
  environmentNetwork?: PaymentNodeNetwork;
}) {
  const t = useTranslations("App.X402.Chains");
  const { wallets } = useX402Wallets(open, "Selling");
  const [isSaving, setIsSaving] = useState(false);
  const lockedTestnet =
    environmentNetwork !== undefined
      ? isTestnetEnv(environmentNetwork)
      : undefined;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ChainFormValues>({
    resolver: zodResolver(chainSchema),
    defaultValues: {
      caip2Id: editing?.caip2Id ?? "",
      displayName: editing?.displayName ?? "",
      rpcUrl: editing?.rpcUrl ?? "",
      isTestnet: editing?.isTestnet ?? lockedTestnet ?? false,
      isEnabled: editing?.isEnabled ?? true,
      defaultAsset: editing?.defaultAsset ?? "",
      facilitatorWalletId: editing?.facilitatorWalletId ?? NO_FACILITATOR,
    },
  });

  const onSubmit = async (data: ChainFormValues) => {
    setIsSaving(true);
    const isTestnet = lockedTestnet ?? data.isTestnet;
    const result = await x402Mutate<X402Network>(
      "/networks",
      {
        method: "POST",
        body: JSON.stringify({
          caip2Id: data.caip2Id,
          displayName: data.displayName,
          rpcUrl: data.rpcUrl,
          isTestnet,
          isEnabled: data.isEnabled,
          defaultAsset: data.defaultAsset ? data.defaultAsset : null,
          facilitatorWalletId:
            data.facilitatorWalletId &&
            data.facilitatorWalletId !== NO_FACILITATOR
              ? data.facilitatorWalletId
              : null,
        }),
      },
      {
        successMessage: editing ? t("updated") : t("added"),
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
                ? t("saveChanges")
                : t("addChain")}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <label htmlFor="chain-caip2Id" className="text-sm font-medium">
          {t("fields.caip2Id")}
        </label>
        <Input
          id="chain-caip2Id"
          placeholder="eip155:8453"
          className="font-mono"
          readOnly={!!editing}
          {...register("caip2Id")}
        />
        {errors.caip2Id && (
          <p className="text-xs text-destructive">{errors.caip2Id.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="chain-displayName" className="text-sm font-medium">
          {t("fields.displayName")}
        </label>
        <Input
          id="chain-displayName"
          placeholder="Base"
          {...register("displayName")}
        />
        {errors.displayName && (
          <p className="text-xs text-destructive">
            {errors.displayName.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="chain-rpcUrl" className="text-sm font-medium">
          {t("fields.rpcUrl")}
        </label>
        <Input
          id="chain-rpcUrl"
          placeholder="https://mainnet.base.org"
          {...register("rpcUrl")}
        />
        {errors.rpcUrl && (
          <p className="text-xs text-destructive">{errors.rpcUrl.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="chain-defaultAsset" className="text-sm font-medium">
          {t("fields.defaultAsset")}
        </label>
        <Input
          id="chain-defaultAsset"
          placeholder="0x…"
          className="font-mono"
          {...register("defaultAsset")}
        />
        {errors.defaultAsset && (
          <p className="text-xs text-destructive">
            {errors.defaultAsset.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t("fields.facilitator")}</label>
        <Controller
          control={control}
          name="facilitatorWalletId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label={t("fields.facilitator")}>
                <SelectValue placeholder={t("fields.facilitatorPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FACILITATOR}>{t("none")}</SelectItem>
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
        {errors.facilitatorWalletId ? (
          <p className="text-xs text-destructive">
            {errors.facilitatorWalletId.message}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("facilitatorHint")}
          </p>
        )}
      </div>

      {lockedTestnet !== undefined && environmentNetwork ? (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">{t("fields.environment")}</p>
            <p className="text-xs text-muted-foreground">
              {t("environmentLockedHint", { network: environmentNetwork })}
            </p>
          </div>
          <Badge variant="outline">
            {lockedTestnet ? t("testnet") : t("mainnet")}
          </Badge>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">{t("fields.testnet")}</p>
            <p className="text-xs text-muted-foreground">{t("testnetHint")}</p>
          </div>
          <Controller
            control={control}
            name="isTestnet"
            render={({ field }) => (
              <Switch
                aria-label={t("fields.testnet")}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">{t("fields.enabled")}</p>
          <p className="text-xs text-muted-foreground">{t("enabledHint")}</p>
        </div>
        <Controller
          control={control}
          name="isEnabled"
          render={({ field }) => (
            <Switch
              aria-label={t("fields.enabled")}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
    </X402FormDialog>
  );
}
