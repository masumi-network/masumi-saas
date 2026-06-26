"use client";

import { CircleHelp, Plug, Sparkles, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { RichTextEditor } from "@/components/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRegistrationCompletion } from "@/lib/context/registration-completion-context";
import { zodResolver } from "@/lib/form-zod-resolver";
import { useX402Networks } from "@/lib/hooks/use-x402-networks";
import { cn } from "@/lib/utils";

import { AgentIconPicker } from "./agent-icon-picker";
import {
  validateX402Options,
  type X402OptionDraft,
  X402OptionsSection,
} from "./x402-options-section";

const CURRENCY_SYMBOL = "$";
const NEW_LANGDOCK_CONNECTION = "__new__";

type RuntimeProvider = "DIRECT_MIP" | "LANGDOCK";

type RegisterAgentFormType = AgentFormFields & {
  runtimeProvider: RuntimeProvider;
  apiUrl: string;
  integrationConnectionId: string;
  langdockApiKey: string;
  langdockAgentId: string;
  langdockBaseUrl: string;
};

interface RegisterAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type PricingMode = "Free" | "Fixed" | "Dynamic";

type AgentFormFields = {
  name: string;
  description?: string;
  extendedDescription?: string;
  pricingType: PricingMode;
  prices: Array<{ amount: string }>;
  tags?: string;
  icon?: string;
  authorName?: string;
  authorEmail?: string;
  organization?: string;
  contactOther?: string;
  termsOfUseUrl?: string;
  privacyPolicyUrl?: string;
  otherUrl?: string;
  capabilityName?: string;
  capabilityVersion?: string;
  exampleOutputs?: Array<{ name: string; url: string; mimeType: string }>;
};

type IntegrationConnection = {
  id: string;
  name: string;
  provider: string;
  metadata?: Record<string, unknown> | null;
};

function ExampleOutputsFields({
  form: outputsForm,
  t: outputsT,
}: {
  form: UseFormReturn<AgentFormFields>;
  t: (key: string) => string;
}) {
  const { fields, append, remove } = useFieldArray({
    control: outputsForm.control,
    name: "exampleOutputs",
  });

  return (
    <div className="space-y-4 rounded-lg border border-border/80 bg-muted/40 p-4">
      <div className="flex items-center justify-between">
        <FormLabel>{outputsT("exampleOutputs")}</FormLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ name: "", url: "", mimeType: "" })}
        >
          {outputsT("addExample")}
        </Button>
      </div>
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="relative flex items-center rounded-md border border-border/60 bg-background p-4 gap-2"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 mb-0">
            <FormField
              control={outputsForm.control}
              name={`exampleOutputs.${index}.name`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder={outputsT("exampleOutputNamePlaceholder")}
                      {...f}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={outputsForm.control}
              name={`exampleOutputs.${index}.url`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder={outputsT("exampleOutputUrlPlaceholder")}
                      {...f}
                      className="h-11 font-mono text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={outputsForm.control}
              name={`exampleOutputs.${index}.mimeType`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder={outputsT("exampleOutputMimePlaceholder")}
                      {...f}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(index)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function PricingFields({
  form: pricingForm,
  t: pricingT,
  pricingMode,
}: {
  form: UseFormReturn<AgentFormFields>;
  t: (key: string) => string;
  pricingMode: PricingMode;
}) {
  const fixedLocked = pricingMode !== "Fixed";
  const { fields, append, remove } = useFieldArray({
    control: pricingForm.control,
    name: "prices",
  });

  return (
    <div
      className="space-y-3 transition-opacity duration-200"
      style={{
        opacity: fixedLocked ? 0.4 : 1,
        pointerEvents: fixedLocked ? "none" : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <FormLabel>{pricingT("prices")}</FormLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={fixedLocked}
          onClick={() => append({ amount: "" })}
        >
          {pricingT("addPrice")}
        </Button>
      </div>
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2 items-center">
            <span className="text-muted-foreground text-sm shrink-0">
              {CURRENCY_SYMBOL}
            </span>
            <FormField
              control={pricingForm.control}
              name={`prices.${index}.amount`}
              render={({ field: amountField }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      type="number"
                      placeholder={pricingT("amountPlaceholder")}
                      min="0"
                      step="0.01"
                      {...amountField}
                      disabled={fixedLocked}
                      className="h-11"
                      onChange={(e) => amountField.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {fields.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={fixedLocked}
                onClick={() => remove(index)}
                className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        {pricingForm.formState.errors.prices && (
          <p className="text-sm text-destructive">
            {pricingForm.formState.errors.prices.message}
          </p>
        )}
      </div>
    </div>
  );
}

export function RegisterAgentDialog({
  open,
  onClose,
  onSuccess,
}: RegisterAgentDialogProps) {
  const t = useTranslations("App.Agents.Register");
  const { addPendingAgent } = useRegistrationCompletion();

  const [isLoading, setIsLoading] = useState(false);
  const closedViaConfirmRef = useRef(false);
  const userClosedViaConfirmRef = useRef(false);
  const showCloseConfirmRef = useRef(false);
  const submitIdRef = useRef(0);
  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [testingLangdock, setTestingLangdock] = useState(false);
  const { networks: x402Networks, isLoading: x402NetworksLoading } =
    useX402Networks({ silentErrors: true });
  const [x402Options, setX402Options] = useState<X402OptionDraft[]>([]);
  const [x402Error, setX402Error] = useState<string | null>(null);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onCloseRef.current = onClose;
  }, [onSuccess, onClose]);

  useEffect(() => {
    showCloseConfirmRef.current = showCloseConfirm;
  }, [showCloseConfirm]);

  // On open: reset close flags and invalidate any in-flight submit from a previous session so its response is ignored.
  useEffect(() => {
    if (open) {
      closedViaConfirmRef.current = false;
      userClosedViaConfirmRef.current = false;
      submitIdRef.current += 1;
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

  const registerAgentSchema = z
    .object({
      name: z.string().min(1, t("nameRequired")).max(250, t("nameMaxLength")),
      description: z
        .string()
        .max(250, t("descriptionMaxLength"))
        .optional()
        .or(z.literal("")),
      extendedDescription: z
        .string()
        .max(5000, t("extendedDescriptionMaxLength"))
        .optional()
        .or(z.literal("")),
      runtimeProvider: z.enum(["DIRECT_MIP", "LANGDOCK"]),
      apiUrl: z.string().optional().or(z.literal("")),
      integrationConnectionId: z.string().optional().or(z.literal("")),
      langdockApiKey: z.string().optional().or(z.literal("")),
      langdockAgentId: z.string().optional().or(z.literal("")),
      langdockBaseUrl: z
        .union([z.literal(""), z.string().url().max(250)])
        .optional(),
      pricingType: z.enum(["Free", "Fixed", "Dynamic"]),
      prices: z.array(z.object({ amount: z.string() })),
      tags: z.string().optional(),
      icon: z.string().max(2000).optional(),
      termsOfUseUrl: z
        .union([z.literal(""), z.string().url().max(250)])
        .optional(),
      privacyPolicyUrl: z
        .union([z.literal(""), z.string().url().max(250)])
        .optional(),
      otherUrl: z.union([z.literal(""), z.string().url().max(250)]).optional(),
      capabilityName: z.string().max(250).optional(),
      capabilityVersion: z.string().max(250).optional(),
      exampleOutputs: z
        .array(
          z.object({
            name: z.string().max(60),
            url: z.string(),
            mimeType: z.string().max(60),
          }),
        )
        .optional(),
    })
    .refine(
      (data) => {
        if (data.pricingType !== "Fixed") return true;
        const filled = (data.prices ?? []).filter((p) => p.amount?.trim());
        return filled.length > 0;
      },
      { message: t("priceAmountRequired"), path: ["prices"] },
    )
    .superRefine((data, ctx) => {
      if (data.runtimeProvider === "DIRECT_MIP") {
        const apiUrl = data.apiUrl?.trim() ?? "";
        try {
          const url = new URL(apiUrl);
          if (url.protocol !== "http:" && url.protocol !== "https:") {
            ctx.addIssue({
              code: "custom",
              message: t("apiUrlProtocol"),
              path: ["apiUrl"],
            });
          }
        } catch {
          ctx.addIssue({
            code: "custom",
            message: t("apiUrlInvalid"),
            path: ["apiUrl"],
          });
        }
      }

      if (data.runtimeProvider === "LANGDOCK") {
        if (!data.langdockAgentId?.trim()) {
          ctx.addIssue({
            code: "custom",
            message: t("langdockAgentIdRequired"),
            path: ["langdockAgentId"],
          });
        }
        const usingSaved =
          data.integrationConnectionId &&
          data.integrationConnectionId !== NEW_LANGDOCK_CONNECTION;
        if (!usingSaved && !data.langdockApiKey?.trim()) {
          ctx.addIssue({
            code: "custom",
            message: t("langdockApiKeyRequired"),
            path: ["langdockApiKey"],
          });
        }
      }
    });

  const form = useForm<RegisterAgentFormType>({
    resolver: zodResolver(registerAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      extendedDescription: "",
      runtimeProvider: "DIRECT_MIP",
      apiUrl: "",
      integrationConnectionId: NEW_LANGDOCK_CONNECTION,
      langdockApiKey: "",
      langdockAgentId: "",
      langdockBaseUrl: "",
      pricingType: "Fixed",
      prices: [{ amount: "" }],
      tags: "",
      icon: "bot",
      termsOfUseUrl: "",
      privacyPolicyUrl: "",
      otherUrl: "",
      capabilityName: "",
      capabilityVersion: "",
      exampleOutputs: [],
    },
  });

  const pricingType = useWatch({
    control: form.control,
    name: "pricingType",
    defaultValue: "Fixed",
  }) as PricingMode;

  useEffect(() => {
    if (pricingType !== "Free") return;
    setX402Options([]);
    setX402Error(null);
  }, [pricingType]);

  const runtimeProvider = useWatch({
    control: form.control,
    name: "runtimeProvider",
    defaultValue: "DIRECT_MIP",
  }) as RuntimeProvider;

  const selectedConnectionId = useWatch({
    control: form.control,
    name: "integrationConnectionId",
    defaultValue: NEW_LANGDOCK_CONNECTION,
  });

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
    form.reset({
      name: "",
      description: "",
      extendedDescription: "",
      runtimeProvider: "DIRECT_MIP",
      apiUrl: "",
      integrationConnectionId: NEW_LANGDOCK_CONNECTION,
      langdockApiKey: "",
      langdockAgentId: "",
      langdockBaseUrl: "",
      pricingType: "Fixed",
      prices: [{ amount: "" }],
      tags: "",
      icon: "bot",
      termsOfUseUrl: "",
      privacyPolicyUrl: "",
      otherUrl: "",
      capabilityName: "",
      capabilityVersion: "",
      exampleOutputs: [],
    });
    setTags([]);
    setTagInput("");
    setX402Options([]);
    setX402Error(null);
  };

  const finalizeSuccessfulSubmit = () => {
    toast.info(t("registrationStarted"));
    resetSuccessfulSubmitState();
    setIsLoading(false);
    setShowCloseConfirm(false);
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

  const onSubmit = async (data: RegisterAgentFormType) => {
    if (tags.length === 0) {
      form.setError("tags", { message: t("tagsRequired") });
      return;
    }
    setIsLoading(true);
    const submitId = ++submitIdRef.current;
    try {
      if (data.pricingType !== "Free" && x402Options.length > 0) {
        const x402ValidationError = validateX402Options(x402Options);
        if (x402ValidationError) {
          setX402Error(x402ValidationError);
          toast.error(x402ValidationError);
          setIsLoading(false);
          return;
        }
      }
      setX402Error(null);

      const exampleOutputs = (data.exampleOutputs ?? []).filter(
        (e) => e.name?.trim() && e.url?.trim() && e.mimeType?.trim(),
      );

      const pricingBody =
        data.pricingType === "Free"
          ? { pricingType: "Free" as const }
          : data.pricingType === "Dynamic"
            ? { pricingType: "Dynamic" as const }
            : {
                pricingType: "Fixed" as const,
                prices: (data.prices ?? [])
                  .filter((p) => p.amount?.trim())
                  .map((p) => ({
                    amount: p.amount.trim(),
                    currency: "USD",
                  })),
              };

      const evmSupportedSources =
        data.pricingType === "Free"
          ? []
          : x402Options.map((option) => ({
              chain: "EVM" as const,
              network: option.caip2Network,
              scheme: "Exact" as const,
              asset: option.asset,
              amount: option.amount,
              decimals: Number(option.decimals),
              payTo: option.payTo,
              ...(option.resource.trim()
                ? { resource: option.resource.trim() }
                : {}),
            }));

      const body = {
        runtimeProvider: data.runtimeProvider,
        name: data.name,
        description: data.description?.trim() ?? "",
        extendedDescription: data.extendedDescription?.trim() ?? "",
        apiUrl: data.runtimeProvider === "DIRECT_MIP" ? data.apiUrl : undefined,
        integrationConnectionId:
          data.runtimeProvider === "LANGDOCK" &&
          data.integrationConnectionId !== NEW_LANGDOCK_CONNECTION
            ? data.integrationConnectionId
            : undefined,
        langdockApiKey:
          data.runtimeProvider === "LANGDOCK" &&
          data.integrationConnectionId === NEW_LANGDOCK_CONNECTION
            ? data.langdockApiKey
            : undefined,
        langdockAgentId:
          data.runtimeProvider === "LANGDOCK"
            ? data.langdockAgentId
            : undefined,
        langdockBaseUrl:
          data.runtimeProvider === "LANGDOCK"
            ? data.langdockBaseUrl
            : undefined,
        tags: tags.join(", "),
        icon: data.icon?.trim() ?? "",
        pricing: pricingBody,
        termsOfUseUrl: data.termsOfUseUrl?.trim() ?? "",
        privacyPolicyUrl: data.privacyPolicyUrl?.trim() ?? "",
        otherUrl: data.otherUrl?.trim() ?? "",
        capabilityName: data.capabilityName?.trim() ?? "",
        capabilityVersion: data.capabilityVersion?.trim() ?? "",
        exampleOutputs: exampleOutputs.length > 0 ? exampleOutputs : undefined,
        ...(evmSupportedSources.length > 0
          ? { supportedPaymentSources: evmSupportedSources }
          : {}),
      };

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
        addPendingAgent(json.agentId);
        if (closedViaConfirmRef.current) {
          toast.info(t("registrationStarted"));
          onSuccessRef.current();
          setIsLoading(false);
          setShowCloseConfirm(false);
          userClosedViaConfirmRef.current = false;
          return;
        }
        if (userClosedViaConfirmRef.current) {
          // User closed via confirm but reopened before response; don't call onClose
          toast.info(t("registrationStarted"));
          onSuccessRef.current();
          setIsLoading(false);
          setShowCloseConfirm(false);
          userClosedViaConfirmRef.current = false;
          return;
        }
        if (showCloseConfirmRef.current) {
          // Call directly: Radix onOpenChange may not fire when closing via controlled state.
          finalizeSuccessfulSubmit();
          return;
        }
        finalizeSuccessfulSubmit();
      } else {
        toast.error(json.error || t("error"));
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
    resetSuccessfulSubmitState();
    onClose();
  };

  const handleOnOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      closedViaConfirmRef.current = false;
      setShowCloseConfirm(false);
    } else {
      if (isLoading) {
        setShowCloseConfirm(true);
        return;
      }
      performClose();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOnOpenChange}>
        <DialogContent
          className="sm:max-w-2xl max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0"
          closeButtonClassName="top-8 right-4 -translate-y-1/2"
        >
          <div className="shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {t("title")}
              </DialogTitle>
            </DialogHeader>
          </div>

          <Form {...form}>
            <form
              className="flex flex-1 flex-col min-h-0 overflow-hidden"
              onSubmit={(e) => form.handleSubmit(onSubmit)(e)}
            >
              <DialogBody stagger={false} className="space-y-8">
                {/* Icon section */}
                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <AgentIconPicker
                      value={field.value ?? "bot"}
                      onChange={field.onChange}
                      onClearError={() => form.clearErrors("icon")}
                      onClearIcon={() => form.setValue("icon", "bot")}
                      translations={{
                        icon: t("icon"),
                        iconTooltip: t("iconTooltip"),
                        iconDescription: t("iconDescription"),
                        iconCustomUrlPlaceholder: t("iconCustomUrlPlaceholder"),
                        scrollLeft: t("scrollLeft"),
                        scrollRight: t("scrollRight"),
                        iconClear: t("iconClear"),
                      }}
                    />
                  )}
                />

                <Separator />

                {/* Basic info */}
                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("name")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("namePlaceholder")}
                            {...field}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("description")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("descriptionPlaceholder")}
                            {...field}
                            className="h-11"
                            maxLength={251}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          {(field.value ?? "").length}
                          {" / "}
                          {250}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="extendedDescription"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormLabel>{t("extendedDescription")}</FormLabel>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                                <CircleHelp className="h-4 w-4" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t("descriptionRichTextHint")}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <FormControl>
                          <RichTextEditor
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder={t("extendedDescriptionPlaceholder")}
                            minHeight="min-h-28"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="runtimeProvider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("runtimeProvider")}</FormLabel>
                        <FormControl>
                          <div
                            className="grid gap-3 sm:grid-cols-2"
                            role="radiogroup"
                            aria-label={t("runtimeProvider")}
                          >
                            {(
                              [
                                {
                                  value: "DIRECT_MIP" as const,
                                  titleKey: "runtimeDirectTitle",
                                  descKey: "runtimeDirectDescription",
                                  Icon: Plug,
                                },
                                {
                                  value: "LANGDOCK" as const,
                                  titleKey: "runtimeLangdockTitle",
                                  descKey: "runtimeLangdockDescription",
                                  Icon: Sparkles,
                                },
                              ] as const
                            ).map((opt) => {
                              const selected = field.value === opt.value;
                              const Icon = opt.Icon;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  role="radio"
                                  aria-checked={selected}
                                  className={cn(
                                    "rounded-lg border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                    selected
                                      ? "border-primary bg-primary/5 shadow-sm"
                                      : "border-border/80 bg-muted/20 hover:bg-muted/40",
                                  )}
                                  onClick={() => field.onChange(opt.value)}
                                >
                                  <span className="mb-2 flex items-center gap-2 text-sm font-medium">
                                    <Icon className="h-4 w-4" />
                                    {t(opt.titleKey)}
                                  </span>
                                  <span className="block text-xs text-muted-foreground leading-snug">
                                    {t(opt.descKey)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {runtimeProvider === "DIRECT_MIP" ? (
                    <FormField
                      control={form.control}
                      name="apiUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("apiUrl")}</FormLabel>
                          <FormControl>
                            <Input
                              type="url"
                              placeholder={t("apiUrlPlaceholder")}
                              {...field}
                              className="h-11 font-mono text-sm"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <div className="space-y-4 rounded-lg border border-border/80 bg-muted/30 p-4">
                      {connections.length > 0 && (
                        <FormField
                          control={form.control}
                          name="integrationConnectionId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("langdockConnection")}</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={connectionsLoading}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-11">
                                    <SelectValue
                                      placeholder={t("langdockConnection")}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value={NEW_LANGDOCK_CONNECTION}>
                                    {t("langdockNewConnection")}
                                  </SelectItem>
                                  {connections.map((connection) => (
                                    <SelectItem
                                      key={connection.id}
                                      value={connection.id}
                                    >
                                      {connection.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {selectedConnectionId === NEW_LANGDOCK_CONNECTION && (
                        <FormField
                          control={form.control}
                          name="langdockApiKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("langdockApiKey")}</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder={t("langdockApiKeyPlaceholder")}
                                  {...field}
                                  className="h-11 font-mono text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="langdockAgentId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("langdockAgentId")}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t("langdockAgentIdPlaceholder")}
                                  {...field}
                                  className="h-11 font-mono text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="langdockBaseUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("langdockBaseUrl")}</FormLabel>
                              <FormControl>
                                <Input
                                  type="url"
                                  placeholder="https://api.langdock.com"
                                  {...field}
                                  className="h-11 font-mono text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={testLangdockAndAutofill}
                        disabled={testingLangdock}
                        className="gap-2"
                      >
                        {testingLangdock ? (
                          <Spinner size={16} />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {t("langdockTestAutofill")}
                      </Button>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="pricingType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("pricingModel")}</FormLabel>
                        <FormControl>
                          <div
                            className="grid gap-3 sm:grid-cols-3"
                            role="radiogroup"
                            aria-label={t("pricingModel")}
                          >
                            {(
                              [
                                {
                                  value: "Free" as const,
                                  titleKey: "pricingFreeTitle",
                                  descKey: "pricingFreeDescription",
                                },
                                {
                                  value: "Fixed" as const,
                                  titleKey: "pricingFixedTitle",
                                  descKey: "pricingFixedDescription",
                                },
                                {
                                  value: "Dynamic" as const,
                                  titleKey: "pricingDynamicTitle",
                                  descKey: "pricingDynamicDescription",
                                },
                              ] as const
                            ).map((opt) => {
                              const selected = field.value === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  role="radio"
                                  aria-checked={selected}
                                  className={cn(
                                    "rounded-lg border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                    selected
                                      ? "border-primary bg-primary/5 shadow-sm"
                                      : "border-border/80 bg-muted/20 hover:bg-muted/40",
                                  )}
                                  onClick={() => field.onChange(opt.value)}
                                >
                                  <p className="text-sm font-medium">
                                    {t(opt.titleKey)}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground leading-snug">
                                    {t(opt.descKey)}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {pricingType === "Dynamic" && (
                    <div className="rounded-lg border border-dashed border-primary/35 bg-muted/30 px-4 py-3 text-sm text-muted-foreground leading-relaxed">
                      {t("pricingDynamicContext")}
                    </div>
                  )}

                  <PricingFields
                    form={form as unknown as UseFormReturn<AgentFormFields>}
                    t={t}
                    pricingMode={pricingType}
                  />

                  {pricingType !== "Free" ? (
                    <X402OptionsSection
                      options={x402Options}
                      networks={x402Networks}
                      networksLoading={x402NetworksLoading}
                      onChange={setX402Options}
                      error={x402Error}
                      t={t}
                    />
                  ) : null}
                </div>

                <Separator />

                {/* Tags */}
                <FormField
                  control={form.control}
                  name="tags"
                  render={() => (
                    <FormItem>
                      <FormLabel>{t("tags")}</FormLabel>
                      <div className="flex gap-2 items-center">
                        <Input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddTag();
                            }
                          }}
                          placeholder={t("tagsPlaceholder")}
                          className="h-11"
                        />
                        <Button
                          type="button"
                          onClick={handleAddTag}
                          variant="secondary"
                          className="shrink-0"
                        >
                          {t("addTag")}
                        </Button>
                      </div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {tags.map((tag, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="gap-1.5 py-1.5 pl-2.5 pr-1 text-sm"
                            >
                              {tag}
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(tag)}
                                className="rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center gap-4 pt-2">
                  <Separator className="flex-1" />
                  <h3 className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                    {t("additionalFields")}
                  </h3>
                  <Separator className="flex-1" />
                </div>

                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="termsOfUseUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("termsOfUseUrl")}</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            placeholder={t("termsOfUseUrlPlaceholder")}
                            {...field}
                            className="h-11 font-mono text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="privacyPolicyUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("privacyPolicyUrl")}</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            placeholder={t("privacyPolicyUrlPlaceholder")}
                            {...field}
                            className="h-11 font-mono text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="otherUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("otherUrl")}</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            placeholder={t("otherUrlPlaceholder")}
                            {...field}
                            className="h-11 font-mono text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="capabilityName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("capabilityName")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("capabilityNamePlaceholder")}
                              {...field}
                              className="h-11"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="capabilityVersion"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("capabilityVersion")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("capabilityVersionPlaceholder")}
                              {...field}
                              className="h-11"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <ExampleOutputsFields
                    form={form as unknown as UseFormReturn<AgentFormFields>}
                    t={t}
                  />
                </div>
              </DialogBody>

              <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOnOpenChange(false)}
                  disabled={isLoading}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" variant="primary" disabled={isLoading}>
                  {isLoading && <Spinner size={16} className="mr-2" />}
                  {t("submit")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={showCloseConfirm}
        onOpenChange={(open) => {
          setShowCloseConfirm(open);
          if (open) {
            closedViaConfirmRef.current = false;
          }
        }}
        onConfirm={() => {
          closedViaConfirmRef.current = true;
          userClosedViaConfirmRef.current = true;
          performClose();
          setShowCloseConfirm(false);
        }}
        title={t("closeConfirmTitle")}
        description={t("closeConfirmDescription")}
        confirmText={t("closeAnyway")}
        cancelText={t("cancel")}
      />
    </>
  );
}
