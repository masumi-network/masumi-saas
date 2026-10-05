"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import {
  hasMultipleX402ResourceUrlsInInput,
  parseBatchResourceUrlsInput,
} from "@/lib/x402/parse-batch-resource-urls";
import {
  buildX402ResourceAutofill,
  resolveX402AutofillPresetIcon,
  type X402ProbeRowSnapshot,
} from "@/lib/x402/resource-autofill";

import {
  buildX402ResourceProbeKey,
  isProbeableResourceUrl,
  type RegisterAgentFormType,
  type RegisterAgentTranslate,
  type RegistrationKind,
  type X402ProbeViewState,
} from "./register-agent-form-model";

// Live 402 probe, duplicate check and metadata autofill for the single x402 HTTP resource URL field.
export function useRegisterX402HttpController({
  open,
  form,
  network,
  registrationKind,
  setTags,
  t,
}: {
  open: boolean;
  form: UseFormReturn<RegisterAgentFormType>;
  network: PaymentNodeNetwork;
  registrationKind: RegistrationKind;
  setTags: (tags: string[]) => void;
  t: RegisterAgentTranslate;
}) {
  const [x402Probe, setX402Probe] = useState<X402ProbeViewState>({
    status: "idle",
  });
  const [x402ProbeRow, setX402ProbeRow] = useState<X402ProbeRowSnapshot | null>(
    null,
  );
  const [x402AutofillInProgress, setX402AutofillInProgress] = useState(false);
  const x402ProbeGenerationRef = useRef(0);
  const lastAutoProbeKeyRef = useRef<string | null>(null);

  // On open: drop any in-flight probe from a previous session.
  useEffect(() => {
    if (open) {
      x402ProbeGenerationRef.current += 1;
      lastAutoProbeKeyRef.current = null;
    }
  }, [open]);

  const watchedX402ResourceUrl = useWatch({
    control: form.control,
    name: "x402ResourceUrl",
    defaultValue: "",
  });
  const x402ParsedResourceUrls = useMemo(
    () => parseBatchResourceUrlsInput(watchedX402ResourceUrl ?? "").urls,
    [watchedX402ResourceUrl],
  );
  const x402BatchResourceMode = useMemo(
    () => hasMultipleX402ResourceUrlsInInput(watchedX402ResourceUrl ?? ""),
    [watchedX402ResourceUrl],
  );
  const x402ProbeTargetUrl =
    x402ParsedResourceUrls.length === 1 ? x402ParsedResourceUrls[0] : "";
  const debouncedX402ProbeTargetUrl = useDebouncedValue(
    x402ProbeTargetUrl,
    500,
  );

  // Forget the last probe result so the next URL value is probed again.
  const clearX402Probe = useCallback(() => {
    lastAutoProbeKeyRef.current = null;
    setX402ProbeRow(null);
    setX402Probe({ status: "idle" });
  }, []);

  // Also invalidate any in-flight probe so its response is ignored.
  const resetX402Probe = useCallback(() => {
    x402ProbeGenerationRef.current += 1;
    clearX402Probe();
  }, [clearX402Probe]);

  const handleX402ResourceUrlInput = (value: string) => {
    x402ProbeGenerationRef.current += 1;
    lastAutoProbeKeyRef.current = null;
    setX402ProbeRow(null);
    if (hasMultipleX402ResourceUrlsInInput(value)) {
      form.clearErrors("x402ResourceUrl");
    }
  };

  const runX402ResourceProbe = useCallback(
    async (resourceUrl: string): Promise<X402ProbeViewState> => {
      const trimmed = resourceUrl.trim();
      const key = buildX402ResourceProbeKey(network, trimmed);
      const probeGeneration = ++x402ProbeGenerationRef.current;
      const isCurrentProbe = () =>
        probeGeneration === x402ProbeGenerationRef.current;

      setX402Probe({ status: "checking", key });
      setX402ProbeRow(null);

      try {
        const res = await fetch("/api/x402/probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ resourceUrl: trimmed, network }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          row?: X402ProbeRowSnapshot;
        };
        if (!isCurrentProbe()) {
          return { status: "idle" };
        }
        if (!res.ok) {
          const next: X402ProbeViewState = {
            status: "invalid",
            key,
            message: json.error || t("x402ProbeError"),
          };
          setX402Probe(next);
          setX402ProbeRow(null);
          return next;
        }

        const registeredCheck = await fetch(
          "/api/agents/x402-registered-check",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ resourceUrls: [trimmed] }),
          },
        );
        const registeredJson = (await registeredCheck
          .json()
          .catch(() => ({}))) as {
          registeredResourceKeys?: string[];
        };
        if (!isCurrentProbe()) {
          return { status: "idle" };
        }
        if (
          registeredCheck.ok &&
          (registeredJson.registeredResourceKeys?.length ?? 0) > 0
        ) {
          const next: X402ProbeViewState = {
            status: "invalid",
            key,
            message: t("x402ResourceAlreadyRegistered"),
          };
          setX402Probe(next);
          setX402ProbeRow(null);
          return next;
        }

        const next: X402ProbeViewState = { status: "valid", key };
        setX402Probe(next);
        setX402ProbeRow(json.row ?? { resource: trimmed });
        return next;
      } catch {
        if (!isCurrentProbe()) {
          return { status: "idle" };
        }
        const next: X402ProbeViewState = {
          status: "invalid",
          key,
          message: t("x402ProbeError"),
        };
        setX402Probe(next);
        setX402ProbeRow(null);
        return next;
      }
    },
    [network, t],
  );

  useEffect(() => {
    if (!open || registrationKind !== "X402_HTTP") return;

    if (x402BatchResourceMode) {
      lastAutoProbeKeyRef.current = null;
      x402ProbeGenerationRef.current += 1;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Batch mode skips single-URL probe.
      setX402Probe({ status: "idle" });
      setX402ProbeRow(null);
      return;
    }

    const liveResourceUrl = x402ProbeTargetUrl.trim();
    const resourceUrl = debouncedX402ProbeTargetUrl.trim();

    if (!liveResourceUrl) {
      lastAutoProbeKeyRef.current = null;
      x402ProbeGenerationRef.current += 1;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Clear stale probe when URL is empty.
      setX402Probe({ status: "idle" });
      setX402ProbeRow(null);
      return;
    }

    if (
      resourceUrl !== liveResourceUrl ||
      !resourceUrl ||
      !isProbeableResourceUrl(resourceUrl)
    ) {
      return;
    }

    const probeKey = buildX402ResourceProbeKey(network, resourceUrl);
    if (lastAutoProbeKeyRef.current === probeKey) {
      return;
    }
    lastAutoProbeKeyRef.current = probeKey;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Debounced live 402 probe on URL input.
    void runX402ResourceProbe(resourceUrl);
  }, [
    debouncedX402ProbeTargetUrl,
    x402BatchResourceMode,
    x402ProbeTargetUrl,
    open,
    registrationKind,
    network,
    runX402ResourceProbe,
  ]);

  const autofillX402Metadata = async () => {
    if (
      !x402ProbeRow ||
      x402Probe.status !== "valid" ||
      x402AutofillInProgress
    ) {
      return;
    }
    setX402AutofillInProgress(true);
    try {
      const filled = buildX402ResourceAutofill(x402ProbeRow);
      form.setValue("name", filled.name, { shouldDirty: true });
      form.setValue("description", filled.description, { shouldDirty: true });
      setTags(filled.tags);
      form.setValue("tags", filled.tags.join(", "), { shouldDirty: true });
      form.clearErrors("name");
      form.clearErrors("description");
      form.clearErrors("tags");

      const iconPreset = resolveX402AutofillPresetIcon(x402ProbeRow);
      form.setValue("icon", iconPreset, { shouldDirty: true });
      form.clearErrors("icon");

      toast.success(t("x402AutofillSuccess"));
    } finally {
      setX402AutofillInProgress(false);
    }
  };

  const x402ResourceUrlTrimmed = x402ProbeTargetUrl.trim();
  const x402ProbeKeyForField = buildX402ResourceProbeKey(
    network,
    x402ResourceUrlTrimmed,
  );
  const showX402ResourceProbeStatus =
    registrationKind === "X402_HTTP" &&
    !x402BatchResourceMode &&
    x402Probe.status !== "idle" &&
    x402Probe.key === x402ProbeKeyForField &&
    isProbeableResourceUrl(x402ResourceUrlTrimmed);
  const x402ResourceProbeInFlight =
    x402Probe.status === "checking" && x402Probe.key === x402ProbeKeyForField;
  const x402CanAutofillMetadata =
    showX402ResourceProbeStatus &&
    x402Probe.status === "valid" &&
    x402ProbeRow != null;

  return {
    x402Probe,
    x402ProbeRow,
    x402AutofillInProgress,
    x402BatchResourceMode,
    showX402ResourceProbeStatus,
    x402ResourceProbeInFlight,
    x402CanAutofillMetadata,
    clearX402Probe,
    resetX402Probe,
    handleX402ResourceUrlInput,
    autofillX402Metadata,
  };
}
