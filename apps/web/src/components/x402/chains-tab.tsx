"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftRight, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { useX402Networks, useX402Wallets } from "@/lib/hooks/use-x402";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { cn, shortenAddress } from "@/lib/utils";
import { x402Mutate } from "@/lib/x402/api";
import {
  type EvmChainConfig,
  getDefaultStablecoinForChain,
  getEvmChainByCaip2Id,
  getEvmChainPresets,
} from "@/lib/x402/evm-config";
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
  const { networks, isLoading, isRefetching, refetch } = useX402Networks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<X402Network | null>(null);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

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
          <Button onClick={openAdd} className="flex items-center gap-2">
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
}: {
  open: boolean;
  editing: X402Network | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("App.X402.Chains");
  const { network: paymentNetwork, setNetwork } = usePaymentNetwork();
  const resolvedEnvironment = paymentNetwork;
  const alternateNetwork: PaymentNodeNetwork =
    paymentNetwork === "Mainnet" ? "Preprod" : "Mainnet";
  const { wallets } = useX402Wallets(open, "Selling");
  const [isSaving, setIsSaving] = useState(false);
  const [isSwitchAnimating, setIsSwitchAnimating] = useState(false);
  const lockedTestnet = isTestnetEnv(resolvedEnvironment);
  const evmEnvironmentLabel = lockedTestnet ? t("testnet") : t("mainnet");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ChainFormValues>({
    resolver: zodResolver(chainSchema),
    defaultValues: {
      caip2Id: editing?.caip2Id ?? "",
      displayName: editing?.displayName ?? "",
      rpcUrl: editing?.rpcUrl ?? "",
      isTestnet: editing?.isTestnet ?? lockedTestnet,
      isEnabled: editing?.isEnabled ?? true,
      defaultAsset: editing?.defaultAsset ?? "",
      facilitatorWalletId: editing?.facilitatorWalletId ?? NO_FACILITATOR,
    },
  });

  const chainPresets = useMemo(
    () => getEvmChainPresets(lockedTestnet),
    [lockedTestnet],
  );
  const selectedCaip2Id = useWatch({ control, name: "caip2Id" });

  useEffect(() => {
    if (!open || editing) return;
    setValue("caip2Id", "");
    setValue("displayName", "");
    setValue("rpcUrl", "");
    setValue("defaultAsset", "");
    setValue("isTestnet", lockedTestnet);
  }, [editing, lockedTestnet, open, setValue]);

  const handleSwitchNetwork = () => {
    setIsSwitchAnimating(true);
    setNetwork(alternateNetwork);
  };

  const applyChainPreset = (chain: EvmChainConfig) => {
    setValue("caip2Id", chain.caip2Id, { shouldValidate: true });
    setValue("displayName", chain.displayName, { shouldValidate: true });
    setValue("rpcUrl", chain.rpcUrl, { shouldValidate: true });
    setValue("isTestnet", chain.isTestnet);
    const defaultAsset = getDefaultStablecoinForChain(chain.caip2Id);
    if (defaultAsset) {
      setValue("defaultAsset", defaultAsset, { shouldValidate: true });
    }
  };

  const onSubmit = async (data: ChainFormValues) => {
    const knownChain = getEvmChainByCaip2Id(data.caip2Id);
    if (knownChain != null && knownChain.isTestnet !== lockedTestnet) {
      setError("caip2Id", {
        message: t("chainEnvironmentMismatch", {
          evmEnvironment: evmEnvironmentLabel,
        }),
      });
      return;
    }

    setIsSaving(true);
    const isTestnet = lockedTestnet;
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
      bodyClassName="space-y-3 p-5"
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
      <div className="space-y-1.5">
        <label htmlFor="chain-caip2Id" className="text-sm font-medium">
          {t("fields.caip2Id")}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            id="chain-caip2Id"
            placeholder="eip155:8453"
            className="font-mono sm:min-w-0 sm:flex-1"
            readOnly
            {...register("caip2Id")}
          />
          {!editing && chainPresets.length > 0 ? (
            <Select
              value={
                chainPresets.find((chain) => chain.caip2Id === selectedCaip2Id)
                  ?.id
              }
              onValueChange={(id) => {
                const chain = chainPresets.find((item) => item.id === id);
                if (chain) applyChainPreset(chain);
              }}
            >
              <SelectTrigger
                className="w-full shrink-0 sm:w-44"
                aria-label={t("chainPresetsAria")}
              >
                <SelectValue placeholder={t("chainPresetPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {chainPresets.map((chain) => (
                  <SelectItem key={chain.id} value={chain.id}>
                    {chain.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        {errors.caip2Id && (
          <p className="text-xs text-destructive">{errors.caip2Id.message}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
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

        <div className="space-y-1.5">
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
      </div>

      <div className="space-y-1.5">
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

      <div className="space-y-1.5">
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
          <p className="text-xs leading-snug text-muted-foreground">
            {t("facilitatorHint")}
          </p>
        )}
      </div>

      <div className="divide-y rounded-lg border">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <p className="text-sm font-medium">{t("fields.environment")}</p>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="whitespace-nowrap">
              {t("environmentBadge", {
                network: resolvedEnvironment,
                evmEnvironment: evmEnvironmentLabel,
              })}
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  aria-label={t("switchNetwork", { network: alternateNetwork })}
                  onClick={handleSwitchNetwork}
                >
                  <ArrowLeftRight
                    className={cn(
                      "h-3 w-3",
                      isSwitchAnimating && "animate-network-switch",
                    )}
                    onAnimationEnd={() => setIsSwitchAnimating(false)}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {t("switchNetwork", { network: alternateNetwork })}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <p className="text-sm font-medium">{t("fields.enabled")}</p>
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
      </div>
    </X402FormDialog>
  );
}
