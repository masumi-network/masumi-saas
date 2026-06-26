"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Link2, ListFilter, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { useX402Networks, useX402Wallets } from "@/lib/hooks/use-x402";
import { shortenAddress } from "@/lib/utils";
import { x402Mutate } from "@/lib/x402/api";
import {
  type EvmChainConfig,
  getDefaultStablecoinForChain,
  getEvmChainPresets,
} from "@/lib/x402/evm-config";
import type { X402Network } from "@/lib/x402/types";
import { isTestnetEnv } from "@/lib/x402-rail";

import { X402FormDialog } from "./x402-form-dialog";
import {
  x402ActionsCellClass,
  x402ActionsHeadClass,
  X402TableEmptyState,
  X402TableLoading,
  X402TableSearch,
} from "./x402-table-ui";
import { X402TestnetField } from "./x402-testnet-field";

const NO_FACILITATOR = "__none__";
const FILTER_ALL = "__all__";

type ChainListFilters = {
  enabled?: boolean;
  facilitatorSet?: boolean;
};

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
  const [searchQuery, setSearchQuery] = useState("");
  const [listFilters, setListFilters] = useState<ChainListFilters>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 200);

  const activeFilterCount = useMemo(
    () =>
      [listFilters.enabled, listFilters.facilitatorSet].filter(
        (value) => value !== undefined,
      ).length,
    [listFilters],
  );

  const filteredNetworks = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    return networks.filter((network) => {
      if (
        listFilters.enabled !== undefined &&
        network.isEnabled !== listFilters.enabled
      ) {
        return false;
      }

      if (listFilters.facilitatorSet === true && !network.facilitatorWalletId) {
        return false;
      }

      if (listFilters.facilitatorSet === false && network.facilitatorWalletId) {
        return false;
      }

      if (!query) return true;

      return (
        network.displayName.toLowerCase().includes(query) ||
        network.caip2Id.toLowerCase().includes(query) ||
        network.rpcUrl.toLowerCase().includes(query) ||
        network.defaultAsset?.toLowerCase().includes(query) ||
        network.facilitatorWalletAddress?.toLowerCase().includes(query) ||
        network.facilitatorWalletId?.toLowerCase().includes(query)
      );
    });
  }, [debouncedSearch, listFilters, networks]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || event.ctrlKey || event.metaKey) {
        return;
      }

      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      event.preventDefault();
      searchInputRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const clearFilters = () => setListFilters({});

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (network: X402Network) => {
    setEditing(network);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <X402TableSearch
          inputRef={searchInputRef}
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("searchPlaceholder")}
          shortcutLabel={t("searchShortcut")}
        />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ChainsFiltersPopover
            filters={listFilters}
            activeFilterCount={activeFilterCount}
            onChange={setListFilters}
            onClear={clearFilters}
          />
          <RefreshButton
            onRefresh={refetch}
            isRefreshing={isRefetching}
            size="md"
          />
          <Button
            onClick={openAdd}
            size="icon"
            className="md:hidden"
            aria-label={t("addChain")}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            onClick={openAdd}
            className="hidden items-center gap-2 md:flex"
          >
            <Plus className="h-4 w-4" />
            {t("addChain")}
          </Button>
        </div>
      </div>

      {activeFilterCount > 0 ? (
        <ChainsActiveFilters filters={listFilters} onClear={clearFilters} />
      ) : null}

      {isLoading ? (
        <X402TableLoading columns={5} withActions />
      ) : networks.length === 0 ? (
        <X402TableEmptyState
          icon={Link2}
          message={`${t("emptyTitle")}. ${t("emptyDescription")}`}
        />
      ) : filteredNetworks.length === 0 ? (
        <X402TableEmptyState icon={Link2} message={t("noSearchResults")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/80">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("columns.chain")}</TableHead>
                <TableHead>{t("columns.rpcUrl")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.defaultAsset")}</TableHead>
                <TableHead>{t("columns.facilitator")}</TableHead>
                <TableHead className={x402ActionsHeadClass}>
                  {t("columns.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNetworks.map((network, index) => (
                <TableRow
                  key={network.id}
                  className="animate-table-row-in transition-[background-color,opacity] duration-150"
                  style={{ animationDelay: `${Math.min(index, 9) * 40}ms` }}
                >
                  <TableCell>
                    <div className="font-medium">{network.displayName}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {network.caip2Id}
                    </div>
                  </TableCell>
                  <TableCell
                    className="max-w-[260px] truncate font-mono text-sm"
                    title={network.rpcUrl}
                  >
                    {network.rpcUrl}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="font-mono text-sm">
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
                  </TableCell>
                  <TableCell className="text-sm">
                    {network.facilitatorWalletId ? (
                      <span className="font-mono">
                        {network.facilitatorWalletAddress
                          ? shortenAddress(network.facilitatorWalletAddress, 6)
                          : network.facilitatorWalletId}
                      </span>
                    ) : (
                      <Badge variant="warning">{t("notSet")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className={x402ActionsCellClass}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={t("editChain")}
                      onClick={() => openEdit(network)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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

function ChainsFiltersPopover({
  filters,
  activeFilterCount,
  onChange,
  onClear,
}: {
  filters: ChainListFilters;
  activeFilterCount: number;
  onChange: React.Dispatch<React.SetStateAction<ChainListFilters>>;
  onClear: () => void;
}) {
  const t = useTranslations("App.X402.Chains");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-9 w-9 shrink-0"
          aria-label={t("filtersAria")}
        >
          <ListFilter className="h-4 w-4" />
          {activeFilterCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 overflow-hidden rounded-xl border-border/80 p-0 shadow-lg"
        align="end"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">{t("filters")}</p>
          {activeFilterCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={onClear}
            >
              {t("clearFilters")}
            </Button>
          ) : null}
        </div>
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="chains-filter-status">{t("filterStatus")}</Label>
            <Select
              value={
                filters.enabled === undefined
                  ? FILTER_ALL
                  : filters.enabled
                    ? "enabled"
                    : "disabled"
              }
              onValueChange={(value) =>
                onChange((prev) => ({
                  ...prev,
                  enabled:
                    value === FILTER_ALL ? undefined : value === "enabled",
                }))
              }
            >
              <SelectTrigger id="chains-filter-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>{t("allStatuses")}</SelectItem>
                <SelectItem value="enabled">{t("enabledOnly")}</SelectItem>
                <SelectItem value="disabled">{t("disabledOnly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chains-filter-facilitator">
              {t("filterFacilitator")}
            </Label>
            <Select
              value={
                filters.facilitatorSet === undefined
                  ? FILTER_ALL
                  : filters.facilitatorSet
                    ? "set"
                    : "not_set"
              }
              onValueChange={(value) =>
                onChange((prev) => ({
                  ...prev,
                  facilitatorSet:
                    value === FILTER_ALL ? undefined : value === "set",
                }))
              }
            >
              <SelectTrigger id="chains-filter-facilitator" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>
                  {t("allFacilitators")}
                </SelectItem>
                <SelectItem value="set">
                  {t("facilitatorConfigured")}
                </SelectItem>
                <SelectItem value="not_set">
                  {t("facilitatorNotConfigured")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ChainsActiveFilters({
  filters,
  onClear,
}: {
  filters: ChainListFilters;
  onClear: () => void;
}) {
  const t = useTranslations("App.X402.Chains");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.enabled !== undefined ? (
        <Badge variant="outline" className="font-normal">
          {filters.enabled ? t("enabled") : t("disabled")}
        </Badge>
      ) : null}
      {filters.facilitatorSet !== undefined ? (
        <Badge variant="outline" className="font-normal">
          {filters.facilitatorSet
            ? t("facilitatorConfigured")
            : t("facilitatorNotConfigured")}
        </Badge>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground"
        onClick={onClear}
      >
        {t("clearFilters")}
      </Button>
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
  const { network } = usePaymentNetwork();
  const wantTestnet = isTestnetEnv(network);
  const { wallets } = useX402Wallets(open, "Selling");
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ChainFormValues>({
    resolver: zodResolver(chainSchema),
    defaultValues: {
      caip2Id: editing?.caip2Id ?? "",
      displayName: editing?.displayName ?? "",
      rpcUrl: editing?.rpcUrl ?? "",
      isTestnet: editing?.isTestnet ?? wantTestnet,
      isEnabled: editing?.isEnabled ?? true,
      defaultAsset: editing?.defaultAsset ?? "",
      facilitatorWalletId: editing?.facilitatorWalletId ?? NO_FACILITATOR,
    },
  });

  const chainPresets = useMemo(
    () =>
      getEvmChainPresets().filter((chain) => chain.isTestnet === wantTestnet),
    [wantTestnet],
  );
  const selectedCaip2Id = useWatch({ control, name: "caip2Id" });

  useEffect(() => {
    if (!open || editing) return;
    setValue("caip2Id", "");
    setValue("displayName", "");
    setValue("rpcUrl", "");
    setValue("defaultAsset", "");
    setValue("isTestnet", wantTestnet);
  }, [editing, open, setValue, wantTestnet]);

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
    setIsSaving(true);
    const result = await x402Mutate<X402Network>(
      "/networks",
      {
        method: "POST",
        body: JSON.stringify({
          caip2Id: data.caip2Id,
          displayName: data.displayName,
          rpcUrl: data.rpcUrl,
          isTestnet: wantTestnet,
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
                    <span className="text-muted-foreground">
                      {" · "}
                      {chain.isTestnet ? t("testnet") : t("mainnet")}
                    </span>
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

      <Controller
        control={control}
        name="isTestnet"
        render={({ field }) => (
          <X402TestnetField
            checked={field.value ?? false}
            onCheckedChange={field.onChange}
            disabled
          />
        )}
      />

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
