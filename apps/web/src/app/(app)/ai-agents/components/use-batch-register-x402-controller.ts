"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useChainRegistryIcons } from "@/hooks/use-chain-registry-icons";
import { useAgentCompletion } from "@/lib/context/agent-completion-context";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { maxAgentRegistrationsForBalance } from "@/lib/credits/agent-registration-quota";
import { formatCreditAmount } from "@/lib/credits/format";
import { useCreditBalance } from "@/lib/hooks/use-credit-balance";
import {
  batchRowMetadataToTags,
  type BatchX402RowMetadata,
  buildBatchRowMetadataFromProbe,
} from "@/lib/x402/batch-x402-row-metadata";
import {
  MAX_BATCH_RESOURCE_URLS,
  parseBatchResourceUrlsInput,
} from "@/lib/x402/parse-batch-resource-urls";
import { parseBatchResourceUrlsFromJson } from "@/lib/x402/parse-batch-resource-urls-from-json";
import { resourceUrlDuplicateKey } from "@/lib/x402/resource-url-duplicate-key";

const MAX_JSON_IMPORT_BYTES = 5 * 1024 * 1024;

function mergeImportedResourceUrls(
  existingText: string,
  importedUrls: string[],
  maxUrls: number,
): { text: string; addedCount: number } {
  const { urls: existingUrls } = parseBatchResourceUrlsInput(existingText);
  const seen = new Set(existingUrls.map(resourceUrlDuplicateKey));
  const merged = [...existingUrls];
  let addedCount = 0;

  for (const url of importedUrls) {
    const key = resourceUrlDuplicateKey(url);
    if (seen.has(key)) continue;
    if (merged.length >= maxUrls) break;
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
  status: "started" | "skipped_duplicate" | "failed" | "not_attempted";
  agentId?: string;
  error?: string;
};

export type BatchRegisterX402DialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialUrlText?: string;
  initialExtraTags?: string;
  autoProbeOnOpen?: boolean;
};

const DEFAULT_BATCH_TAGS = "x402, base, bazaar";

export function resourceDisplayLabel(resourceUrl: string): string {
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

export function useBatchRegisterX402Controller({
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
  const { data: creditBalance, isPending: creditsPending } = useCreditBalance();

  const creditsRemaining = creditBalance?.creditsRemaining ?? 0;
  const registrationQuota = useMemo(
    () =>
      maxAgentRegistrationsForBalance({
        network,
        creditsRemaining,
        maxPerBatch: MAX_BATCH_RESOURCE_URLS,
      }),
    [creditsRemaining, network],
  );

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
    notAttempted?: number;
    stoppedReason?: "insufficient_credits";
  } | null>(null);

  const operationRef = useRef(0);
  const previousNetworkRef = useRef(network);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const reset = useCallback(() => {
    operationRef.current += 1;
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

  useEffect(() => {
    if (!open) reset();
    else if (previousNetworkRef.current !== network) {
      operationRef.current += 1;
      setIsProbing(false);
      setIsSubmitting(false);
      setRows([]);
      setResults([]);
      setSummary(null);
      setStep("paste");
    }
    previousNetworkRef.current = network;
  }, [open, network, reset]);

  useEffect(
    () => () => {
      operationRef.current += 1;
    },
    [],
  );

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
    async (textOverride?: string, tagsOverride?: string) => {
      const source = textOverride ?? urlText;
      const { urls: parsedUrls, invalidLines } =
        parseBatchResourceUrlsInput(source);
      if (parsedUrls.length === 0) {
        toast.error(t("noValidUrls"));
        return;
      }
      if (invalidLines.length > 0) {
        toast.warning(t("invalidLinesSkipped", { count: invalidLines.length }));
      }

      if (network === "Mainnet" && creditsPending) {
        toast.error(t("creditsQuotaLoading"));
        return;
      }

      let urls = parsedUrls;
      if (urls.length > registrationQuota) {
        urls = urls.slice(0, registrationQuota);
        toast.warning(
          t("creditsQuotaUrlCap", {
            max: registrationQuota,
            credits: formatCreditAmount(creditsRemaining),
          }),
        );
      }

      if (network === "Mainnet" && registrationQuota === 0) {
        toast.error(t("insufficientCredits"));
        return;
      }

      const operation = ++operationRef.current;
      const isCurrent = () => operation === operationRef.current;
      setIsSubmitting(false);
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
        if (!isCurrent()) return;
        setRows((prev) =>
          prev.map((row) =>
            row.resourceUrl === resourceUrl ? { ...row, ...patch } : row,
          ),
        );
      };

      async function worker() {
        while (isCurrent() && index < urls.length) {
          const current = urls[index];
          index += 1;
          if (!current) continue;
          updateRow(current, { status: "probing" });
          const probe = await probeResource(current, network).catch(() => ({
            ok: false,
            row: undefined,
            error: t("probeFailed"),
          }));
          if (!isCurrent()) return;
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
                extraTagsText: tagsOverride ?? extraTags,
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

      try {
        await Promise.all(
          Array.from({ length: Math.min(concurrency, urls.length) }, () =>
            worker(),
          ),
        );
        if (!isCurrent()) return;
        const registeredKeys = await fetchRegisteredResourceKeys(urls);
        if (!isCurrent()) return;
        setRows((prev) =>
          applyDuplicateRowBlocking(prev, registeredKeys, {
            alreadyRegistered: t("alreadyRegisteredMessage"),
            duplicateInBatch: t("duplicateInBatchMessage"),
          }),
        );
      } catch {
        if (isCurrent()) toast.error(t("probeFailed"));
      } finally {
        if (isCurrent()) setIsProbing(false);
      }
    },
    [
      autofillMetadata,
      creditsPending,
      creditsRemaining,
      extraTags,
      network,
      registrationQuota,
      t,
      urlText,
    ],
  );

  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const initialBatchHandledRef = useRef(false);

  const handleJsonImport = useCallback(
    async (file: File) => {
      const operation = operationRef.current;
      if (file.size > MAX_JSON_IMPORT_BYTES) {
        toast.error(t("importJsonFileTooLarge"));
        return;
      }

      let jsonText: string;
      try {
        jsonText = await file.text();
        if (operation !== operationRef.current) return;
      } catch {
        if (operation !== operationRef.current) return;
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
        registrationQuota,
      );
      setUrlText(nextText);

      if (addedCount === 0) {
        toast.message(t("importJsonDuplicate"));
        return;
      }

      if (parsed.truncated) {
        toast.warning(t("importJsonTruncated", { max: registrationQuota }));
      }

      toast.success(
        hadExisting
          ? t("importJsonMerged", { count: addedCount, fileName: file.name })
          : t("importJsonSuccess", { count: addedCount, fileName: file.name }),
      );
    },
    [registrationQuota, t, urlText],
  );
  useEffect(() => {
    if (!open) {
      initialBatchHandledRef.current = false;
      return;
    }
    if (!initialUrlText?.trim() || initialBatchHandledRef.current) return;
    if (autoProbeOnOpen && network === "Mainnet" && creditsPending) return;
    initialBatchHandledRef.current = true;
    setUrlText(initialUrlText);
    if (initialExtraTags?.trim()) {
      setExtraTags(initialExtraTags.trim());
    }
    if (autoProbeOnOpen) {
      void runProbes(initialUrlText, initialExtraTags?.trim());
    }
  }, [
    autoProbeOnOpen,
    creditsPending,
    initialExtraTags,
    initialUrlText,
    network,
    open,
    runProbes,
  ]);

  const toggleRow = (resourceUrl: string, selected: boolean) => {
    setRows((prev) => {
      if (selected && network === "Mainnet") {
        const selectedOk = prev.filter(
          (row) => row.selected && row.status === "ok",
        ).length;
        const target = prev.find((row) => row.resourceUrl === resourceUrl);
        if (
          target?.status === "ok" &&
          !target.selected &&
          selectedOk >= registrationQuota
        ) {
          toast.error(
            t("creditsQuotaExceededSelection", { max: registrationQuota }),
          );
          return prev;
        }
      }
      return prev.map((row) =>
        row.resourceUrl === resourceUrl ? { ...row, selected } : row,
      );
    });
  };

  const selectAllCompatible = (selected: boolean) => {
    setRows((prev) => {
      if (!selected) {
        return prev.map((row) =>
          row.status === "ok" ? { ...row, selected: false } : row,
        );
      }
      let slots = registrationQuota;
      return prev.map((row) => {
        if (row.status !== "ok") return row;
        if (slots > 0) {
          slots -= 1;
          return { ...row, selected: true };
        }
        return { ...row, selected: false };
      });
    });
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
    let selectedRows = rows.filter(
      (row) => row.selected && row.status === "ok",
    );
    if (selectedRows.length === 0) {
      toast.error(t("nothingSelected"));
      return;
    }

    if (network === "Mainnet" && selectedRows.length > registrationQuota) {
      selectedRows = selectedRows.slice(0, registrationQuota);
      toast.warning(
        t("creditsQuotaExceededSelection", { max: registrationQuota }),
      );
    }

    const operation = ++operationRef.current;
    const isCurrent = () => operation === operationRef.current;
    setIsProbing(false);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/agents/batch-x402?network=${network}`, {
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
          notAttempted?: number;
          stoppedReason?: "insufficient_credits";
        };
        creditsRemaining?: number;
        error?: string;
        message?: string;
      };

      if (res.status === 402) {
        if (!isCurrent()) return;
        toast.error(
          typeof json.error === "string"
            ? json.error
            : t("insufficientCredits"),
        );
        return;
      }

      if (!res.ok || json.success !== true || !json.results || !json.summary) {
        if (!isCurrent()) return;
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

      onSuccessRef.current();
      if (!isCurrent()) return;

      setResults(json.results);
      setSummary(json.summary);
      setStep("results");
      if (json.summary.stoppedReason === "insufficient_credits") {
        toast.warning(
          t("submitStoppedCredits", { started: json.summary.started }),
        );
      } else {
        toast.success(
          t("submitSuccess", {
            started: json.summary.started,
            failed: json.summary.failed,
          }),
        );
      }
    } catch {
      if (isCurrent()) toast.error(t("submitFailed"));
    } finally {
      if (isCurrent()) setIsSubmitting(false);
    }
  }, [
    addPendingRegistration,
    autofillMetadata,
    network,
    registrationQuota,
    rows,
    t,
  ]);

  return {
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
  };
}
