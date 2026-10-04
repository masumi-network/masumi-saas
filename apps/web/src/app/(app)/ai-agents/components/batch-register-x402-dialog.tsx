"use client";

import { ArrowLeft, ArrowRight, Check, FileUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContentPanel,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { X402Logo } from "@/components/x402/x402-logo";
import { X402RegistryChainPicker } from "@/components/x402/x402-registry-chain-picker";
import { formatCreditAmount } from "@/lib/credits/format";
import { dialogHeaderEnterClass } from "@/lib/dialog-motion";
import { cn } from "@/lib/utils";
import { evmNetworkForCardanoPaymentNetwork } from "@/lib/x402/evm-config";
import { MAX_BATCH_RESOURCE_URLS } from "@/lib/x402/parse-batch-resource-urls";

import { BatchX402ResourceRowActions } from "./batch-x402-resource-row-actions";
import { MainnetCreditsRequiredNotice } from "./mainnet-credits-required-notice";
import {
  type BatchRegisterX402DialogProps,
  resourceDisplayLabel,
  useBatchRegisterX402Controller,
} from "./use-batch-register-x402-controller";

export function BatchRegisterX402Dialog(props: BatchRegisterX402DialogProps) {
  const { open } = props;
  const {
    t,
    tRegister,
    network,
    setNetwork,
    x402RegistryChainIconSlugs,
    creditsPending,
    creditsRemaining,
    registrationQuota,
    step,
    setStep,
    urlText,
    setUrlText,
    autofillMetadata,
    setAutofillMetadata,
    rows,
    isProbing,
    isSubmitting,
    results,
    summary,
    handleClose,
    parsedPreview,
    selectedCompatibleCount,
    compatibleRowCount,
    runProbes,
    jsonFileInputRef,
    handleJsonImport,
    toggleRow,
    selectAllCompatible,
    removeRow,
    saveRowMetadata,
    submitBatch,
  } = useBatchRegisterX402Controller(props);
  const evmNetworkLabel = evmNetworkForCardanoPaymentNetwork(network);

  const stepIndex = step === "paste" ? 0 : step === "review" ? 1 : 2;
  const stepLabels = [t("stepUrls"), t("stepReview"), t("stepDone")] as const;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <DialogContentPanel
          className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
          closeButtonClassName="top-8 right-4 -translate-y-1/2"
        >
          <div
            className={cn(
              "shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12",
              dialogHeaderEnterClass,
            )}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                <X402Logo className="-mb-px h-5 w-auto shrink-0" />
                {t("title")}
              </DialogTitle>
              <DialogDescription className="pt-1 text-sm text-muted-foreground">
                {t("description")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <DialogBody className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <ol
              className="flex items-center gap-2 text-xs text-muted-foreground"
              aria-label="Registration steps"
            >
              {stepLabels.map((label, i) => (
                <li key={label} className="flex items-center gap-2">
                  {i > 0 ? (
                    <span className="text-border" aria-hidden>
                      /
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      i === stepIndex && "font-medium text-foreground",
                      i < stepIndex && "text-foreground/80",
                    )}
                  >
                    {label}
                  </span>
                </li>
              ))}
            </ol>

            {step === "paste" ? (
              <>
                <MainnetCreditsRequiredNotice />
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    {tRegister("x402Chain")}
                  </Label>
                  <X402RegistryChainPicker
                    cardanoNetwork={network}
                    onCardanoNetworkChange={setNetwork}
                    chainIconSlugs={x402RegistryChainIconSlugs}
                  />
                  <p className="text-xs text-muted-foreground">
                    {network === "Mainnet"
                      ? creditsPending
                        ? t("creditsQuotaLoading")
                        : t("creditsQuotaMainnet", {
                            max: registrationQuota,
                            credits: formatCreditAmount(creditsRemaining),
                          })
                      : t("creditsQuotaPreprod", {
                          max: MAX_BATCH_RESOURCE_URLS,
                        })}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="batch-x402-urls">{t("urlsLabel")}</Label>
                    <div className="flex items-center gap-2">
                      {parsedPreview.urls.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {t("parsedCount", {
                            count: parsedPreview.urls.length,
                          })}
                        </span>
                      ) : null}
                      <input
                        ref={jsonFileInputRef}
                        type="file"
                        accept=".json,application/json"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) void handleJsonImport(file);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => jsonFileInputRef.current?.click()}
                      >
                        <FileUp className="size-3.5" aria-hidden />
                        {t("importJson")}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="batch-x402-urls"
                    value={urlText}
                    onChange={(e) => setUrlText(e.target.value)}
                    placeholder={t("urlsPlaceholder", {
                      max: registrationQuota,
                    })}
                    rows={5}
                    spellCheck={false}
                    className="min-h-[120px] resize-y font-mono text-xs leading-relaxed"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("urlsHint", { max: registrationQuota })}{" "}
                    {t("importJsonHint")}
                  </p>
                </div>
                <div className="flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2.5">
                  <Checkbox
                    id="batch-x402-autofill-metadata"
                    checked={autofillMetadata}
                    onCheckedChange={(checked) =>
                      setAutofillMetadata(checked === true)
                    }
                  />
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="batch-x402-autofill-metadata"
                      className="cursor-pointer text-sm font-normal leading-snug"
                    >
                      {t("autofillMetadataLabel")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t("autofillMetadataHint")}
                    </p>
                  </div>
                </div>
              </>
            ) : null}

            {step === "review" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{t("reviewHeading")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("reviewSubheading", { network: evmNetworkLabel })}
                    </p>
                  </div>
                  {!isProbing && compatibleRowCount > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() =>
                        selectAllCompatible(
                          selectedCompatibleCount < compatibleRowCount,
                        )
                      }
                    >
                      {selectedCompatibleCount < compatibleRowCount
                        ? t("selectAllCompatible")
                        : t("clearSelection")}
                    </Button>
                  ) : null}
                </div>

                {isProbing ? (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
                    <Spinner size={16} />
                    {t("probing")}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {rows.map((row) => (
                      <li
                        key={row.resourceUrl}
                        className={cn(
                          "rounded-lg border bg-muted/20 px-3 py-2.5 transition-colors",
                          row.selected &&
                            row.status === "ok" &&
                            "border-primary/30 bg-primary/5",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            className="mt-0.5"
                            checked={row.selected}
                            disabled={
                              row.status !== "ok" || isProbing || isSubmitting
                            }
                            onCheckedChange={(checked) =>
                              toggleRow(row.resourceUrl, checked === true)
                            }
                            aria-label={t("selectRow")}
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p
                                className="truncate text-sm font-medium"
                                title={row.metadata?.name ?? row.resourceUrl}
                              >
                                {row.metadata?.name ??
                                  resourceDisplayLabel(row.resourceUrl)}
                              </p>
                              {row.status === "probing" ? (
                                <Spinner size={14} />
                              ) : row.status === "ok" ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {t("statusOk")}
                                </Badge>
                              ) : row.status === "incompatible" ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {t("statusIncompatible")}
                                </Badge>
                              ) : row.status === "error" ? (
                                <Badge
                                  variant="destructive"
                                  className="text-[10px]"
                                >
                                  {t("statusError")}
                                </Badge>
                              ) : row.status === "already_registered" ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {t("statusAlreadyRegistered")}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {t("statusPending")}
                                </Badge>
                              )}
                            </div>
                            <p
                              className="truncate font-mono text-[11px] text-muted-foreground"
                              title={row.resourceUrl}
                            >
                              {row.resourceUrl}
                            </p>
                            {row.metadata?.description ? (
                              <p className="line-clamp-2 text-xs text-muted-foreground">
                                {row.metadata.description}
                              </p>
                            ) : null}
                            {row.message ? (
                              <p className="text-xs text-muted-foreground">
                                {row.message}
                              </p>
                            ) : null}
                          </div>
                          {row.status !== "pending" &&
                          row.status !== "probing" ? (
                            <BatchX402ResourceRowActions
                              rowId={encodeURIComponent(row.resourceUrl)}
                              metadata={row.metadata}
                              canEdit={row.status === "ok"}
                              disabled={isSubmitting}
                              labels={{
                                actions: t("rowActions"),
                                edit: t("rowEdit"),
                                delete: t("rowDelete"),
                                editTitle: t("rowEditTitle"),
                                name: tRegister("name"),
                                description: tRegister("description"),
                                tags: tRegister("tags"),
                                save: t("rowEditSave"),
                                cancel: t("cancel"),
                              }}
                              onDelete={() => removeRow(row.resourceUrl)}
                              onSaveMetadata={(metadata) =>
                                saveRowMetadata(row.resourceUrl, metadata)
                              }
                            />
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {!isProbing ? (
                  <p className="text-sm text-muted-foreground">
                    {t("selectedCount", { count: selectedCompatibleCount })}
                  </p>
                ) : null}
              </div>
            ) : null}

            {step === "results" && summary ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("resultsDismissHint")}
                </p>
                <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                  {t("resultsSummary", {
                    started: summary.started,
                    skipped: summary.skippedDuplicate,
                    failed: summary.failed,
                  })}
                  {(summary.notAttempted ?? 0) > 0 ? (
                    <p className="mt-2 text-muted-foreground">
                      {t("resultsNotAttemptedCount", {
                        count: summary.notAttempted ?? 0,
                      })}
                    </p>
                  ) : null}
                  {summary.stoppedReason === "insufficient_credits" ? (
                    <p className="mt-2 text-muted-foreground">
                      {t("resultsStoppedCredits")}
                    </p>
                  ) : null}
                </div>
                <ul className="max-h-[min(40vh,280px)] space-y-2 overflow-y-auto">
                  {results.map((row) => (
                    <li
                      key={row.resourceUrl}
                      className="rounded-lg border px-3 py-2.5 text-sm"
                    >
                      <p
                        className="truncate font-medium"
                        title={row.resourceUrl}
                      >
                        {resourceDisplayLabel(row.resourceUrl)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.status === "started"
                          ? t("resultStarted", { id: row.agentId ?? "" })
                          : row.status === "skipped_duplicate"
                            ? t("resultSkippedDuplicate")
                            : row.status === "not_attempted"
                              ? t("resultNotAttempted", {
                                  error: row.error ?? t("unknownError"),
                                })
                              : t("resultFailed", {
                                  error: row.error ?? t("unknownError"),
                                })}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </DialogBody>

          <Separator />

          <DialogFooter
            className={cn(
              "shrink-0 w-full gap-2 border-t bg-background px-6 py-4",
              step === "results"
                ? "justify-end"
                : "justify-between sm:justify-between",
            )}
          >
            {step === "review" ? (
              <Button
                type="button"
                variant="outline"
                className="group gap-2"
                disabled={isProbing || isSubmitting}
                onClick={() => setStep("paste")}
              >
                <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
                  <ArrowLeft
                    aria-hidden
                    className="size-4 transition-all duration-200 ease-out motion-reduce:transition-none opacity-100 group-hover:-translate-x-0.5 group-active:-translate-x-1 motion-reduce:group-hover:translate-x-0 motion-reduce:group-active:translate-x-0"
                  />
                </span>
                {tRegister("reviewBack")}
              </Button>
            ) : step === "paste" ? (
              <Button type="button" variant="outline" onClick={handleClose}>
                {t("cancel")}
              </Button>
            ) : null}
            <div className="flex shrink-0 gap-2">
              {step === "paste" ? (
                <Button
                  type="button"
                  variant="primary"
                  className="group gap-2"
                  disabled={
                    parsedPreview.urls.length === 0 ||
                    (network === "Mainnet" &&
                      (creditsPending || registrationQuota === 0))
                  }
                  onClick={() => void runProbes()}
                >
                  {tRegister("continue")}
                  <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
                    <ArrowRight
                      aria-hidden
                      className="size-4 transition-all duration-200 ease-out motion-reduce:transition-none opacity-100 group-hover:translate-x-0.5 group-active:translate-x-1 motion-reduce:group-hover:translate-x-0 motion-reduce:group-active:translate-x-0"
                    />
                  </span>
                </Button>
              ) : null}
              {step === "review" ? (
                <Button
                  type="button"
                  variant="primary"
                  className="group gap-2"
                  disabled={
                    isProbing ||
                    isSubmitting ||
                    selectedCompatibleCount === 0 ||
                    (network === "Mainnet" && registrationQuota === 0)
                  }
                  onClick={() => void submitBatch()}
                >
                  {isSubmitting
                    ? t("submitting")
                    : t("registerSelected", { count: selectedCompatibleCount })}
                  <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
                    <ArrowRight
                      aria-hidden
                      className={cn(
                        "size-4 transition-all duration-200 ease-out motion-reduce:transition-none",
                        isSubmitting
                          ? "scale-75 opacity-0"
                          : "opacity-100 group-hover:translate-x-0.5 group-active:translate-x-1 motion-reduce:group-hover:translate-x-0 motion-reduce:group-active:translate-x-0",
                      )}
                    />
                    <Spinner
                      size={16}
                      className={cn(
                        "absolute transition-all duration-200 ease-out motion-reduce:transition-none",
                        isSubmitting
                          ? "scale-100 opacity-100"
                          : "scale-75 opacity-0",
                      )}
                    />
                  </span>
                </Button>
              ) : null}
              {step === "results" ? (
                <Button
                  type="button"
                  variant="primary"
                  className="gap-2"
                  onClick={handleClose}
                >
                  <Check className="size-4 shrink-0" aria-hidden />
                  {t("done")}
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContentPanel>
      </DialogPortal>
    </Dialog>
  );
}
