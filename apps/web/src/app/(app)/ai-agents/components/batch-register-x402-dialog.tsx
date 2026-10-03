"use client";

import { ArrowLeft, ArrowRight, Check, FileUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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
import { useChainRegistryIcons } from "@/hooks/use-chain-registry-icons";
import { useAgentCompletion } from "@/lib/context/agent-completion-context";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { dialogHeaderEnterClass } from "@/lib/dialog-motion";
import { cn } from "@/lib/utils";
import {
  batchRowMetadataToTags,
  type BatchX402RowMetadata,
  buildBatchRowMetadataFromProbe,
} from "@/lib/x402/batch-x402-row-metadata";
import { evmNetworkForCardanoPaymentNetwork } from "@/lib/x402/evm-config";
import {
  MAX_BATCH_RESOURCE_URLS,
  parseBatchResourceUrlsInput,
} from "@/lib/x402/parse-batch-resource-urls";
import { parseBatchResourceUrlsFromJson } from "@/lib/x402/parse-batch-resource-urls-from-json";
import { resourceUrlDuplicateKey } from "@/lib/x402/resource-url-duplicate-key";

import { BatchX402ResourceRowActions } from "./batch-x402-resource-row-actions";

const MAX_JSON_IMPORT_BYTES = 5 * 1024 * 1024;

function mergeImportedResourceUrls(
  existingText: string,
  importedUrls: string[],
): { text: string; addedCount: number } {
  const { urls: existingUrls } = parseBatchResourceUrlsInput(existingText);
  const seen = new Set(existingUrls.map((url) => url.toLowerCase()));
  const merged = [...existingUrls];
  let addedCount = 0;

  for (const url of importedUrls) {
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    if (merged.length >= MAX_BATCH_RESOURCE_URLS) break;
    seen.add(key);
    merged.push(url);
    addedCount += 1;
  }

  return { text: merged.join("\n"), addedCount };
}

type BatchStep = "paste" | "review" | "results";

type ProbeRowState = {
  resourceUrl: string;
  status:
    | "pending"
    | "probing"
    | "ok"
    | "incompatible"
    | "error"
    | "already_registered";
  sokosumiCompatible?: boolean;
  payTo?: string;
  amount?: string | null;
  message?: string;
  selected: boolean;
  metadata?: BatchX402RowMetadata;
};

type BatchResultRow = {
  resourceUrl: string;
  status: "started" | "skipped_duplicate" | "failed";
  agentId?: string;
  error?: string;
};

type BatchRegisterX402DialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialUrlText?: string;
  initialExtraTags?: string;
  autoProbeOnOpen?: boolean;
};

const DEFAULT_BATCH_TAGS = "x402, base, bazaar";

function resourceDisplayLabel(resourceUrl: string): string {
  try {
    const url = new URL(resourceUrl);
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return `${url.hostname}${path}`;
  } catch {
    return resourceUrl;
  }
}

async function probeResource(
  resourceUrl: string,
  network: "Mainnet" | "Preprod",
): Promise<{
  ok: boolean;
  row?: Record<string, unknown>;
  error?: string;
}> {
  const res = await fetch("/api/x402/probe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ resourceUrl, network }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    row?: Record<string, unknown>;
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof json.error === "string"
          ? json.error
          : typeof json.message === "string"
            ? json.message
            : "Probe failed",
    };
  }
  if (json.success !== true || !json.row) {
    return { ok: false, error: "Probe failed" };
  }
  return { ok: true, row: json.row };
}

async function fetchRegisteredResourceKeys(
  resourceUrls: string[],
): Promise<Set<string>> {
  if (resourceUrls.length === 0) return new Set();
  const res = await fetch("/api/agents/x402-registered-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ resourceUrls }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    registeredResourceKeys?: string[];
  };
  if (!res.ok || json.success !== true || !json.registeredResourceKeys) {
    return new Set();
  }
  return new Set(json.registeredResourceKeys);
}

function applyDuplicateRowBlocking(
  rows: ProbeRowState[],
  registeredKeys: Set<string>,
  messages: { alreadyRegistered: string; duplicateInBatch: string },
): ProbeRowState[] {
  const seenInBatch = new Set<string>();

  return rows.map((row) => {
    const key = resourceUrlDuplicateKey(row.resourceUrl);
    if (!key) return row;

    if (seenInBatch.has(key)) {
      return {
        ...row,
        status: "already_registered",
        selected: false,
        message: messages.duplicateInBatch,
      };
    }
    seenInBatch.add(key);

    if (registeredKeys.has(key)) {
      return {
        ...row,
        status: "already_registered",
        selected: false,
        message: messages.alreadyRegistered,
      };
    }

    return row;
  });
}

export function BatchRegisterX402Dialog({
  open,
  onClose,
  onSuccess,
  initialUrlText,
  initialExtraTags,
  autoProbeOnOpen = true,
}: BatchRegisterX402DialogProps) {
  const t = useTranslations("App.Agents.BatchRegisterX402");
  const tRegister = useTranslations("App.Agents.Register");
  const { network, setNetwork } = usePaymentNetwork();
  const x402RegistryChainIconSlugs = useChainRegistryIcons([
    "eip155:84532",
    "eip155:8453",
  ] as const);
  const { addPendingRegistration } = useAgentCompletion();

  const [step, setStep] = useState<BatchStep>("paste");
  const [urlText, setUrlText] = useState("");
  const [extraTags, setExtraTags] = useState(DEFAULT_BATCH_TAGS);
  const [autofillMetadata, setAutofillMetadata] = useState(true);
  const [rows, setRows] = useState<ProbeRowState[]>([]);
  const [isProbing, setIsProbing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<BatchResultRow[]>([]);
  const [summary, setSummary] = useState<{
    started: number;
    skippedDuplicate: number;
    failed: number;
  } | null>(null);

  const reset = useCallback(() => {
    setStep("paste");
    setUrlText("");
    setExtraTags(DEFAULT_BATCH_TAGS);
    setAutofillMetadata(true);
    setRows([]);
    setIsProbing(false);
    setIsSubmitting(false);
    setResults([]);
    setSummary(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const parsedPreview = useMemo(
    () => parseBatchResourceUrlsInput(urlText),
    [urlText],
  );

  const selectedCompatibleCount = useMemo(
    () => rows.filter((row) => row.selected && row.status === "ok").length,
    [rows],
  );

  const compatibleRowCount = useMemo(
    () => rows.filter((row) => row.status === "ok").length,
    [rows],
  );

  const runProbes = useCallback(
    async (textOverride?: string) => {
      const source = textOverride ?? urlText;
      const { urls, invalidLines } = parseBatchResourceUrlsInput(source);
      if (urls.length === 0) {
        toast.error(t("noValidUrls"));
        return;
      }
      if (invalidLines.length > 0) {
        toast.warning(t("invalidLinesSkipped", { count: invalidLines.length }));
      }

      setStep("review");
      setIsProbing(true);
      const initial: ProbeRowState[] = urls.map((resourceUrl) => ({
        resourceUrl,
        status: "pending",
        selected: true,
      }));
      setRows(initial);

      const concurrency = 3;
      let index = 0;
      const updateRow = (
        resourceUrl: string,
        patch: Partial<ProbeRowState>,
      ) => {
        setRows((prev) =>
          prev.map((row) =>
            row.resourceUrl === resourceUrl ? { ...row, ...patch } : row,
          ),
        );
      };

      async function worker() {
        while (index < urls.length) {
          const current = urls[index];
          index += 1;
          if (!current) continue;
          updateRow(current, { status: "probing" });
          const probe = await probeResource(current, network);
          if (!probe.ok || !probe.row) {
            updateRow(current, {
              status: "error",
              selected: false,
              message: probe.error ?? t("probeFailed"),
            });
            continue;
          }
          const compatible = probe.row.sokosumiCompatible === true;
          const metadata = compatible
            ? buildBatchRowMetadataFromProbe({
                resourceUrl: current,
                probeRow: probe.row,
                autofillMetadata,
                extraTagsText: extraTags,
              })
            : undefined;
          updateRow(current, {
            status: compatible ? "ok" : "incompatible",
            selected: compatible,
            sokosumiCompatible: compatible,
            payTo:
              typeof probe.row.payTo === "string" ? probe.row.payTo : undefined,
            amount:
              probe.row.amount === null || probe.row.amount === undefined
                ? null
                : String(probe.row.amount),
            message: compatible ? undefined : t("notSokosumiCompatible"),
            metadata,
          });
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(concurrency, urls.length) }, () =>
          worker(),
        ),
      );

      const registeredKeys = await fetchRegisteredResourceKeys(urls);
      setRows((prev) =>
        applyDuplicateRowBlocking(prev, registeredKeys, {
          alreadyRegistered: t("alreadyRegisteredMessage"),
          duplicateInBatch: t("duplicateInBatchMessage"),
        }),
      );
      setIsProbing(false);
    },
    [autofillMetadata, extraTags, network, t, urlText],
  );

  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const initialBatchHandledRef = useRef(false);

  const handleJsonImport = useCallback(
    async (file: File) => {
      if (file.size > MAX_JSON_IMPORT_BYTES) {
        toast.error(t("importJsonFileTooLarge"));
        return;
      }

      let jsonText: string;
      try {
        jsonText = await file.text();
      } catch {
        toast.error(t("importJsonReadFailed"));
        return;
      }

      const parsed = parseBatchResourceUrlsFromJson(jsonText);
      if (parsed.parseError) {
        toast.error(t("importJsonInvalid"));
        return;
      }
      if (parsed.urls.length === 0) {
        toast.error(t("importJsonEmpty"));
        return;
      }

      const hadExisting = urlText.trim().length > 0;
      const { text: nextText, addedCount } = mergeImportedResourceUrls(
        urlText,
        parsed.urls,
      );
      setUrlText(nextText);

      if (addedCount === 0) {
        toast.message(t("importJsonDuplicate"));
        return;
      }

      if (parsed.truncated) {
        toast.warning(
          t("importJsonTruncated", { max: MAX_BATCH_RESOURCE_URLS }),
        );
      }

      toast.success(
        hadExisting
          ? t("importJsonMerged", { count: addedCount, fileName: file.name })
          : t("importJsonSuccess", { count: addedCount, fileName: file.name }),
      );
    },
    [t, urlText],
  );
  useEffect(() => {
    if (!open) {
      initialBatchHandledRef.current = false;
      return;
    }
    if (!initialUrlText?.trim() || initialBatchHandledRef.current) return;
    initialBatchHandledRef.current = true;
    setUrlText(initialUrlText);
    if (initialExtraTags?.trim()) {
      setExtraTags(initialExtraTags.trim());
    }
    if (autoProbeOnOpen) {
      void runProbes(initialUrlText);
    }
  }, [autoProbeOnOpen, initialExtraTags, initialUrlText, open, runProbes]);

  const toggleRow = (resourceUrl: string, selected: boolean) => {
    setRows((prev) =>
      prev.map((row) =>
        row.resourceUrl === resourceUrl ? { ...row, selected } : row,
      ),
    );
  };

  const selectAllCompatible = (selected: boolean) => {
    setRows((prev) =>
      prev.map((row) => (row.status === "ok" ? { ...row, selected } : row)),
    );
  };

  const removeRow = (resourceUrl: string) => {
    setRows((prev) => prev.filter((row) => row.resourceUrl !== resourceUrl));
  };

  const saveRowMetadata = (
    resourceUrl: string,
    metadata: BatchX402RowMetadata,
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.resourceUrl === resourceUrl ? { ...row, metadata } : row,
      ),
    );
  };

  const submitBatch = useCallback(async () => {
    const selectedRows = rows.filter(
      (row) => row.selected && row.status === "ok",
    );
    if (selectedRows.length === 0) {
      toast.error(t("nothingSelected"));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/agents/batch-x402", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          autofillMetadata,
          skipExisting: true,
          registrations: selectedRows.map((row) => ({
            resourceUrl: row.resourceUrl,
            name: row.metadata?.name.trim() || undefined,
            description: row.metadata?.description.trim() || undefined,
            tags: row.metadata
              ? batchRowMetadataToTags(row.metadata)
              : undefined,
          })),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        results?: BatchResultRow[];
        summary?: {
          started: number;
          skippedDuplicate: number;
          failed: number;
        };
        error?: string;
        message?: string;
      };

      if (!res.ok || json.success !== true || !json.results || !json.summary) {
        toast.error(
          typeof json.error === "string"
            ? json.error
            : typeof json.message === "string"
              ? json.message
              : t("submitFailed"),
        );
        return;
      }

      for (const row of json.results) {
        if (row.status === "started" && row.agentId) {
          addPendingRegistration(row.agentId);
        }
      }

      setResults(json.results);
      setSummary(json.summary);
      setStep("results");
      onSuccess();
      toast.success(
        t("submitSuccess", {
          started: json.summary.started,
          failed: json.summary.failed,
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [addPendingRegistration, autofillMetadata, onSuccess, rows, t]);

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
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    {tRegister("x402Chain")}
                  </Label>
                  <X402RegistryChainPicker
                    cardanoNetwork={network}
                    onCardanoNetworkChange={setNetwork}
                    chainIconSlugs={x402RegistryChainIconSlugs}
                  />
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
                      max: MAX_BATCH_RESOURCE_URLS,
                    })}
                    rows={5}
                    spellCheck={false}
                    className="min-h-[120px] resize-y font-mono text-xs leading-relaxed"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("urlsHint", { max: MAX_BATCH_RESOURCE_URLS })}{" "}
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
                  disabled={parsedPreview.urls.length === 0}
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
                    isProbing || isSubmitting || selectedCompatibleCount === 0
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
