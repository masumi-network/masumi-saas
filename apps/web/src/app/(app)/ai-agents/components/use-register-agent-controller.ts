"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useFormState, useWatch } from "react-hook-form";
import { toast } from "sonner";

import {
  type LangdockIntegrationConnection,
  NEW_LANGDOCK_CONNECTION,
  prefillLangdockFromConnection,
} from "@/components/integrations/langdock-connection-fields";
import { useChainRegistryIcons } from "@/hooks/use-chain-registry-icons";
import { syncPricesValidationAfterPricingModeChange } from "@/lib/agents/register-agent-pricing-effects";
import {
  persistRegistrationKind,
  readStoredRegistrationKind,
} from "@/lib/agents/register-agent-registration-kind-storage";
import { useAgentCompletion } from "@/lib/context/agent-completion-context";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { zodResolver } from "@/lib/form-zod-resolver";
import { useMainnetRegistrationCreditsGate } from "@/lib/hooks/use-mainnet-registration-credits-gate";
import { useX402Networks } from "@/lib/hooks/use-x402-networks";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import {
  getDefaultPricingAssetId,
  getPricingAssetOptions,
} from "@/lib/payment-node/pricing-assets";
import { evmNetworkForCardanoPaymentNetwork } from "@/lib/x402/evm-config";

import {
  buildRegisterAgentDefaultValues,
  buildRegisterAgentResetValues,
  buildRegisterAgentSchema,
  type PricingMode,
  type RegisterAgentDialogStep,
  type RegisterAgentFormType,
  registerFormHasMeaningfulDraft,
  type RegistrationKind,
  type RuntimeProvider,
  X402_REGISTRY_CAIP2_IDS,
} from "./register-agent-form-model";
import { buildRegisterAgentRequestBody } from "./register-agent-request-body";
import { useRegisterX402HttpController } from "./use-register-x402-http-controller";
import {
  validateX402Options,
  type X402OptionDraft,
} from "./x402-options-section";

export interface RegisterAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onBeginBatchX402Registration?: (payload: {
    urlText: string;
    extraTags: string;
  }) => void;
}

export type RegisterAgentController = ReturnType<
  typeof useRegisterAgentController
>;

export function useRegisterAgentController({
  open,
  onClose,
  onSuccess,
  onBeginBatchX402Registration,
}: RegisterAgentDialogProps) {
  const t = useTranslations("App.Agents.Register");
  const tCreditsGate = useTranslations("App.Agents.CreditsGate");
  const { addPendingRegistration } = useAgentCompletion();
  const { network, setNetwork } = usePaymentNetwork();
  const mainnetCreditsGate = useMainnetRegistrationCreditsGate();
  const selectedX402Caip2 = evmNetworkForCardanoPaymentNetwork(network);
  const x402RegistryChainIconSlugs = useChainRegistryIcons([
    ...X402_REGISTRY_CAIP2_IDS,
  ]);
  const defaultPricingAssetId = getDefaultPricingAssetId(network);

  const [isLoading, setIsLoading] = useState(false);
  const closedViaConfirmRef = useRef(false);
  const userClosedViaConfirmRef = useRef(false);
  const closeConfirmOpenRef = useRef(false);
  const submitIdRef = useRef(0);
  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [closeConfirmReason, setCloseConfirmReason] = useState<
    "loading" | "unsaved" | null
  >(null);
  const [connections, setConnections] = useState<
    LangdockIntegrationConnection[]
  >([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [testingLangdock, setTestingLangdock] = useState(false);
  const { networks: x402Networks, isLoading: x402NetworksLoading } =
    useX402Networks({ silentErrors: true, requireFacilitator: true });
  const [x402Options, setX402Options] = useState<X402OptionDraft[]>([]);
  const [x402Error, setX402Error] = useState<string | null>(null);
  const [networkSwitchConfirmOpen, setNetworkSwitchConfirmOpen] =
    useState(false);
  const [pendingPaymentNetwork, setPendingPaymentNetwork] =
    useState<PaymentNodeNetwork | null>(null);
  const [step, setStep] = useState<RegisterAgentDialogStep>("form");
  const [reviewValues, setReviewValues] =
    useState<RegisterAgentFormType | null>(null);
  const [additionalFieldsExpanded, setAdditionalFieldsExpanded] =
    useState(false);
  const registerDialogBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onCloseRef.current = onClose;
  }, [onSuccess, onClose]);

  useEffect(() => {
    if (!open || step !== "form" || !additionalFieldsExpanded) return;
    const timer = window.setTimeout(() => {
      const body = registerDialogBodyRef.current;
      if (!body) return;
      body.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [additionalFieldsExpanded, open, step]);

  useEffect(() => {
    closeConfirmOpenRef.current = closeConfirmReason !== null;
  }, [closeConfirmReason]);

  // On open: reset close flags and invalidate any in-flight submit from a previous session so its response is ignored.
  useEffect(() => {
    if (open) {
      closedViaConfirmRef.current = false;
      userClosedViaConfirmRef.current = false;
      setCloseConfirmReason(null);
      submitIdRef.current += 1;
      setStep("form");
      setReviewValues(null);
      setAdditionalFieldsExpanded(false);
      setConnectionsLoading(true);
      fetch("/api/integrations/langdock", { credentials: "include" })
        .then((res) => res.json())
        .then((json) => {
          if (Array.isArray(json.data)) setConnections(json.data);
        })
        .catch(() => setConnections([]))
        .finally(() => setConnectionsLoading(false));
    }
  }, [open]);

  const form = useForm<RegisterAgentFormType>({
    resolver: zodResolver(buildRegisterAgentSchema(t, network)),
    defaultValues: buildRegisterAgentDefaultValues(
      readStoredRegistrationKind(),
      defaultPricingAssetId,
    ),
  });

  const { dirtyFields: registerFormDirtyFields } = useFormState({
    control: form.control,
  });

  const pricingType = useWatch({
    control: form.control,
    name: "pricingType",
    defaultValue: "Fixed",
  }) as PricingMode;

  useEffect(() => {
    syncPricesValidationAfterPricingModeChange(pricingType, form);
    if (pricingType === "Fixed") return;
    setX402Options([]);
    setX402Error(null);
  }, [pricingType, form]);

  useEffect(() => {
    if (!open) return;
    const allowedAssets = new Set(
      getPricingAssetOptions(network).map((option) => option.id),
    );
    const prices = form.getValues("prices") ?? [];
    prices.forEach((price, index) => {
      const asset = price.asset?.trim() || defaultPricingAssetId;
      if (!allowedAssets.has(asset)) {
        form.setValue(`prices.${index}.asset`, defaultPricingAssetId, {
          shouldDirty: false,
        });
      } else if (!price.asset?.trim()) {
        form.setValue(`prices.${index}.asset`, defaultPricingAssetId, {
          shouldDirty: false,
        });
      }
    });
  }, [open, network, defaultPricingAssetId, form]);

  useEffect(() => {
    if (!open) return;
    const stored = readStoredRegistrationKind();
    if (form.getValues("registrationKind") !== stored) {
      form.setValue("registrationKind", stored, { shouldDirty: false });
    }
    if (stored === "X402_HTTP") {
      form.setValue("pricingType", "Free", { shouldDirty: false });
      form.clearErrors("prices");
      form.clearErrors("payoutAddress");
    }
  }, [open, form]);

  const registrationKind = useWatch({
    control: form.control,
    name: "registrationKind",
    defaultValue: "STANDARD",
  }) as RegistrationKind;

  const runtimeProvider = useWatch({
    control: form.control,
    name: "runtimeProvider",
    defaultValue: "DIRECT_MIP",
  }) as RuntimeProvider;

  useEffect(() => {
    if (!open || connectionsLoading || connections.length === 0) return;
    const currentId = form.getValues("integrationConnectionId");
    const hasValidSavedSelection =
      currentId !== NEW_LANGDOCK_CONNECTION &&
      connections.some((connection) => connection.id === currentId);
    if (hasValidSavedSelection) return;

    const first = connections[0]!;
    form.setValue("integrationConnectionId", first.id, { shouldDirty: false });
    prefillLangdockFromConnection<RegisterAgentFormType>(first, (name, value) =>
      form.setValue(name, value, { shouldDirty: false }),
    );
  }, [open, connections, connectionsLoading, form]);

  const x402Http = useRegisterX402HttpController({
    open,
    form,
    network,
    registrationKind,
    setTags,
    t,
  });
  const { clearX402Probe, resetX402Probe } = x402Http;

  const handleLangdockConnectionSelect = useCallback(
    (connectionId: string) => {
      if (connectionId === NEW_LANGDOCK_CONNECTION) return;
      const connection = connections.find((item) => item.id === connectionId);
      if (!connection) return;
      prefillLangdockFromConnection<RegisterAgentFormType>(
        connection,
        (name, value) => form.setValue(name, value),
      );
    },
    [connections, form],
  );

  const handleRegistrationKindChange = (value: RegistrationKind) => {
    persistRegistrationKind(value);
    if (value === "X402_HTTP") {
      form.setValue("pricingType", "Free", { shouldDirty: true });
      form.setValue("exampleOutputs", [], { shouldDirty: true });
      form.clearErrors("prices");
      form.clearErrors("payoutAddress");
    }
    clearX402Probe();
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
      form.setValue("tags", [...tags, tag].join(", "));
      form.clearErrors("tags");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(newTags);
    form.setValue("tags", newTags.join(", "));
  };

  const resetSuccessfulSubmitState = () => {
    resetX402Probe();
    form.reset(
      buildRegisterAgentResetValues(
        readStoredRegistrationKind(),
        defaultPricingAssetId,
      ),
    );
    setTags([]);
    setTagInput("");
    setX402Options([]);
    setX402Error(null);
    setNetworkSwitchConfirmOpen(false);
    setPendingPaymentNetwork(null);
    setStep("form");
    setReviewValues(null);
    setAdditionalFieldsExpanded(false);
  };

  const applyPaymentNetworkChange = useCallback(
    (next: PaymentNodeNetwork) => {
      setNetwork(next);
      clearX402Probe();
    },
    [setNetwork, clearX402Probe],
  );

  const requestPaymentNetworkChange = useCallback(
    (next: PaymentNodeNetwork) => {
      if (next === network) return;
      setPendingPaymentNetwork(next);
      setNetworkSwitchConfirmOpen(true);
    },
    [network],
  );

  const confirmPaymentNetworkChange = () => {
    if (pendingPaymentNetwork) {
      applyPaymentNetworkChange(pendingPaymentNetwork);
    }
    setPendingPaymentNetwork(null);
    setNetworkSwitchConfirmOpen(false);
  };

  const handleNetworkSwitchConfirmOpenChange = (nextOpen: boolean) => {
    setNetworkSwitchConfirmOpen(nextOpen);
    if (!nextOpen) setPendingPaymentNetwork(null);
  };

  const finalizeSuccessfulSubmit = () => {
    toast.info(t("registrationStarted"));
    resetSuccessfulSubmitState();
    setIsLoading(false);
    setCloseConfirmReason(null);
    onSuccessRef.current();
    onCloseRef.current();
  };

  const testLangdockAndAutofill = async () => {
    const values = form.getValues();
    setTestingLangdock(true);
    try {
      const usingSaved =
        values.integrationConnectionId &&
        values.integrationConnectionId !== NEW_LANGDOCK_CONNECTION;
      const response = await fetch("/api/integrations/langdock/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...(usingSaved
            ? { integrationConnectionId: values.integrationConnectionId }
            : { apiKey: values.langdockApiKey }),
          agentId: values.langdockAgentId,
          baseUrl: values.langdockBaseUrl,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error || t("langdockTestError"));
      }
      if (json.agent?.name) {
        form.setValue("name", json.agent.name, { shouldDirty: true });
      }
      if (json.agent?.description) {
        form.setValue("description", json.agent.description, {
          shouldDirty: true,
        });
      }
      toast.success(t("langdockTestSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("langdockTestError"),
      );
    } finally {
      setTestingLangdock(false);
    }
  };

  const assertRegistrationPreflight = (
    data: RegisterAgentFormType,
  ): boolean => {
    if (tags.length === 0) {
      form.setError("tags", { message: t("tagsRequired") });
      return false;
    }
    if (
      data.registrationKind === "STANDARD" &&
      data.pricingType === "Fixed" &&
      x402Options.length > 0
    ) {
      const x402ValidationError = validateX402Options(x402Options);
      if (x402ValidationError) {
        setX402Error(x402ValidationError);
        toast.error(x402ValidationError);
        return false;
      }
    }
    setX402Error(null);
    return true;
  };

  const goToReview = () => {
    if (mainnetCreditsGate.isBlocked) {
      toast.error(tCreditsGate("registerBlocked"));
      return;
    }
    void form.handleSubmit((data) => {
      if (!assertRegistrationPreflight(data)) return;
      setReviewValues(data);
      setStep("review");
    })();
  };

  const handleBackFromReview = () => {
    if (isLoading) return;
    setStep("form");
  };

  const handleConfirmRegistration = () => {
    if (!reviewValues || isLoading) return;
    if (mainnetCreditsGate.isBlocked) {
      toast.error(tCreditsGate("registerBlocked"));
      return;
    }
    void onSubmit(reviewValues);
  };

  const onSubmit = async (data: RegisterAgentFormType) => {
    if (!assertRegistrationPreflight(data)) {
      if (step === "review") {
        setStep("form");
      }
      return;
    }
    setIsLoading(true);
    const submitId = ++submitIdRef.current;
    try {
      const body = buildRegisterAgentRequestBody(data, {
        tags,
        x402Options,
        defaultPricingAssetId,
      });

      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));

      if (submitId !== submitIdRef.current) return;

      const registrationAccepted =
        res.status === 200 &&
        json.success === true &&
        typeof json.agentId === "string";
      if (registrationAccepted) {
        addPendingRegistration(json.agentId);
        if (closedViaConfirmRef.current) {
          toast.info(t("registrationStarted"));
          onSuccessRef.current();
          setIsLoading(false);
          setCloseConfirmReason(null);
          userClosedViaConfirmRef.current = false;
          return;
        }
        if (userClosedViaConfirmRef.current) {
          // User closed via confirm but reopened before response; don't call onClose
          toast.info(t("registrationStarted"));
          onSuccessRef.current();
          setIsLoading(false);
          setCloseConfirmReason(null);
          userClosedViaConfirmRef.current = false;
          return;
        }
        if (closeConfirmOpenRef.current) {
          // Call directly: Radix onOpenChange may not fire when closing via controlled state.
          finalizeSuccessfulSubmit();
          return;
        }
        finalizeSuccessfulSubmit();
      } else {
        const message =
          res.status === 402
            ? tCreditsGate("apiInsufficientCredits")
            : json.error || t("error");
        toast.error(message);
        setIsLoading(false);
      }
    } catch (error) {
      if (submitId !== submitIdRef.current) return;
      toast.error(t("error"));
      console.error("Failed to register agent:", error);
      setIsLoading(false);
    }
  };

  const performClose = () => {
    setIsLoading(false);
    setCloseConfirmReason(null);
    resetSuccessfulSubmitState();
    onClose();
  };

  const openBatchX402Registration = () => {
    if (!onBeginBatchX402Registration) {
      toast.error(t("x402BatchUnavailable"));
      return;
    }
    const urlText = form.getValues("x402ResourceUrl")?.trim() ?? "";
    const extraTags =
      tags.join(", ").trim() ||
      form.getValues("tags")?.trim() ||
      "x402, base, bazaar";
    onBeginBatchX402Registration({ urlText, extraTags });
    performClose();
  };

  const registrationHasDraft = useCallback((): boolean => {
    if (step === "review") return true;
    if (
      registerFormHasMeaningfulDraft(
        form.getValues(),
        tags,
        tagInput,
        x402Options,
      )
    ) {
      return true;
    }
    if (form.getValues("runtimeProvider") === "LANGDOCK") {
      if (
        registerFormDirtyFields.langdockApiKey ||
        registerFormDirtyFields.langdockAgentId ||
        registerFormDirtyFields.langdockBaseUrl
      ) {
        return true;
      }
    }
    return false;
  }, [step, form, tags, tagInput, x402Options, registerFormDirtyFields]);

  const handleRegistrationDialogOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      closedViaConfirmRef.current = false;
      setCloseConfirmReason(null);
    } else {
      if (isLoading) {
        setCloseConfirmReason("loading");
        return;
      }
      if (registrationHasDraft()) {
        setCloseConfirmReason("unsaved");
        return;
      }
      performClose();
    }
  };

  const handleCloseConfirmOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      closedViaConfirmRef.current = false;
    } else {
      setCloseConfirmReason(null);
    }
  };

  const handleCloseConfirm = () => {
    if (closeConfirmReason === "loading") {
      closedViaConfirmRef.current = true;
      userClosedViaConfirmRef.current = true;
    }
    performClose();
  };

  return {
    t,
    form,
    network,
    selectedX402Caip2,
    x402RegistryChainIconSlugs,
    mainnetCreditsGate,
    isLoading,
    step,
    reviewValues,
    registrationKind,
    runtimeProvider,
    pricingType,
    registerDialogBodyRef,
    additionalFieldsExpanded,
    setAdditionalFieldsExpanded,
    tags,
    tagInput,
    setTagInput,
    handleAddTag,
    handleRemoveTag,
    connections,
    connectionsLoading,
    testingLangdock,
    testLangdockAndAutofill,
    handleLangdockConnectionSelect,
    x402Networks,
    x402NetworksLoading,
    x402Options,
    setX402Options,
    x402Error,
    x402Http,
    handleRegistrationKindChange,
    requestPaymentNetworkChange,
    openBatchX402Registration,
    goToReview,
    handleBackFromReview,
    handleConfirmRegistration,
    handleRegistrationDialogOpenChange,
    closeConfirmReason,
    handleCloseConfirmOpenChange,
    handleCloseConfirm,
    networkSwitchConfirmOpen,
    pendingPaymentNetwork,
    handleNetworkSwitchConfirmOpenChange,
    confirmPaymentNetworkChange,
  };
}
