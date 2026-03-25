"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CurlResponseViewer } from "@/components/developers/testing/curl-response-viewer";
import type { PaidTestingAgent } from "@/components/developers/testing/payment-form-fields";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/ui/code-editor";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import {
  generateSaasPurchaseCurl,
  tryExtractPaymentJsonForPurchase,
} from "@/lib/developers/testing-utils";
import { cn } from "@/lib/utils";
import { extractErrorMessage } from "@/lib/utils/extract-error";

function createTestPurchaseFormSchema(t: (key: string) => string) {
  return z.object({
    blockchainIdentifier: z.string().min(1, t("errors.blockchainIdentifier")),
    sellerVkey: z.string().min(1, t("errors.sellerVkey")),
    inputHash: z
      .string()
      .length(64, t("errors.inputHashLength"))
      .regex(/^[0-9a-fA-F]+$/, t("errors.inputHashHex")),
    agentIdentifier: z.string().min(57, t("errors.agentIdentifier")),
    identifierFromPurchaser: z
      .string()
      .min(14, t("errors.identifierMin"))
      .max(26, t("errors.identifierMax"))
      .regex(/^[0-9a-fA-F]+$/, t("errors.identifierHex")),
    payByTime: z.string().min(1, t("errors.timeRequired")),
    submitResultTime: z.string().min(1, t("errors.timeRequired")),
    unlockTime: z.string().min(1, t("errors.timeRequired")),
    externalDisputeUnlockTime: z.string().min(1, t("errors.timeRequired")),
    metadata: z.string().optional(),
  });
}

export type TestPurchaseFormValues = z.infer<
  ReturnType<typeof createTestPurchaseFormSchema>
>;

interface TestPurchaseDialogProps {
  open: boolean;
  onClose: () => void;
  paidAgents: PaidTestingAgent[];
  isLoadingAgents: boolean;
}

function parsePurchaseSuccessPayload(json: unknown): object | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.data !== undefined && o.data !== null && typeof o.data === "object") {
    return o.data as object;
  }
  return json as object;
}

export function TestPurchaseDialog({
  open,
  onClose,
  paidAgents,
  isLoadingAgents,
}: TestPurchaseDialogProps) {
  const t = useTranslations("Developers.testing.purchaseDialog");
  const tForm = useTranslations("Developers.testing.form");
  const { network } = usePaymentNetwork();
  const [isLoading, setIsLoading] = useState(false);
  const [curlCommand, setCurlCommand] = useState("");
  const [response, setResponse] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteRaw, setPasteRaw] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const schema = useMemo(() => createTestPurchaseFormSchema((k) => t(k)), [t]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TestPurchaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      blockchainIdentifier: "",
      sellerVkey: "",
      inputHash: "",
      agentIdentifier: "",
      identifierFromPurchaser: "",
      payByTime: "",
      submitResultTime: "",
      unlockTime: "",
      externalDisputeUnlockTime: "",
      metadata: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset();
      setPasteRaw("");
      setPasteError(null);
      setResponse(null);
      setError(null);
      setCurlCommand("");
    }
  }, [open, reset]);

  const watchedAgentId = watch("agentIdentifier");
  const agentsForSelect = useMemo((): PaidTestingAgent[] => {
    if (
      watchedAgentId &&
      !paidAgents.some((a) => a.agentIdentifier === watchedAgentId)
    ) {
      return [
        ...paidAgents,
        {
          id: "__from_paste__",
          name: t("agentFromPaste"),
          agentIdentifier: watchedAgentId,
        },
      ];
    }
    return paidAgents;
  }, [paidAgents, t, watchedAgentId]);

  const handleClose = useCallback(() => {
    reset();
    setPasteRaw("");
    setPasteError(null);
    setResponse(null);
    setError(null);
    setCurlCommand("");
    onClose();
  }, [onClose, reset]);

  const applyPaste = useCallback(() => {
    const trimmed = pasteRaw.trim();
    if (!trimmed) {
      setPasteError(null);
      return;
    }
    const fields = tryExtractPaymentJsonForPurchase(trimmed);
    if (!fields) {
      setPasteError(t("pasteError"));
      return;
    }
    setPasteError(null);
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined && val !== "") {
        setValue(key as keyof TestPurchaseFormValues, val, {
          shouldValidate: true,
        });
      }
    }
    toast.success(t("pasteSuccess"));
  }, [pasteRaw, setValue, t]);

  const onSubmit = useCallback(
    async (data: TestPurchaseFormValues) => {
      try {
        setIsLoading(true);
        setError(null);

        const requestBody = {
          blockchainIdentifier: data.blockchainIdentifier,
          network,
          inputHash: data.inputHash,
          sellerVkey: data.sellerVkey,
          agentIdentifier: data.agentIdentifier,
          identifierFromPurchaser: data.identifierFromPurchaser,
          payByTime: data.payByTime,
          submitResultTime: data.submitResultTime,
          unlockTime: data.unlockTime,
          externalDisputeUnlockTime: data.externalDisputeUnlockTime,
          ...(data.metadata?.trim() ? { metadata: data.metadata.trim() } : {}),
        };

        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        setCurlCommand(generateSaasPurchaseCurl(origin, requestBody));

        const res = await fetch("/api/v1/purchase", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const text = await res.text();
        let json: unknown;
        try {
          json = JSON.parse(text) as unknown;
        } catch {
          json = null;
        }

        if (!res.ok) {
          throw new Error(
            extractErrorMessage(
              json ?? text,
              t("errors.requestFailed", { status: res.status }),
            ),
          );
        }

        const payload = parsePurchaseSuccessPayload(json);
        if (!payload) {
          throw new Error(t("errors.emptyResponse"));
        }

        setResponse(payload);
        toast.success(t("successToast"));
      } catch (err: unknown) {
        const errorMessage = extractErrorMessage(err, t("errors.generic"));
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [network, t],
  );

  const hasResultUi = Boolean(
    (curlCommand && curlCommand.length > 0) ||
    response !== null ||
    (error && error.length > 0),
  );
  const created = response !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0"
        closeButtonClassName="top-8 right-4 -translate-y-1/2"
      >
        <form
          className="flex flex-1 flex-col min-h-0 overflow-hidden"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {t("title")}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
            <p className="text-sm text-muted-foreground">{t("description")}</p>

            <div className="space-y-2">
              <Label>{t("pasteLabel")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("pastePlaceholder")}
              </p>
              <div
                className={cn(
                  "overflow-hidden rounded-md border bg-background",
                  pasteError ? "border-destructive" : "border-border",
                )}
              >
                <CodeEditor
                  value={pasteRaw}
                  onChange={(v) => {
                    setPasteRaw(v);
                    setPasteError(null);
                  }}
                  language="json"
                  height={220}
                  className="[&_.monaco-editor]:rounded-none"
                />
              </div>
              {pasteError ? (
                <p className="text-sm text-destructive" role="alert">
                  {pasteError}
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={applyPaste}
              >
                {t("applyPaste")}
              </Button>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="blockchainIdentifier">
                  {t("blockchainIdentifierLabel")}{" "}
                  <span className="text-destructive">{tForm("required")}</span>
                </Label>
                <Input
                  id="blockchainIdentifier"
                  {...register("blockchainIdentifier")}
                  className="font-mono text-xs"
                />
                {errors.blockchainIdentifier ? (
                  <p className="text-sm text-destructive">
                    {errors.blockchainIdentifier.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sellerVkey">
                  {t("sellerVkeyLabel")}{" "}
                  <span className="text-destructive">{tForm("required")}</span>
                </Label>
                <Input
                  id="sellerVkey"
                  {...register("sellerVkey")}
                  className="font-mono text-xs"
                />
                {errors.sellerVkey ? (
                  <p className="text-sm text-destructive">
                    {errors.sellerVkey.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>
                  {tForm("agentLabel")}{" "}
                  <span className="text-destructive">{tForm("required")}</span>
                </Label>
                <Controller
                  control={control}
                  name="agentIdentifier"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        disabled={
                          isLoadingAgents ||
                          (paidAgents.length === 0 &&
                            !(field.value ?? "").trim())
                        }
                        className={`h-11 font-mono text-xs transition-colors ${errors.agentIdentifier ? "border-destructive" : ""}`}
                      >
                        <SelectValue
                          placeholder={
                            isLoadingAgents
                              ? tForm("loadingAgents")
                              : paidAgents.length === 0
                                ? tForm("noPaidAgents")
                                : tForm("selectAgent")
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {agentsForSelect.map((agent) => (
                          <SelectItem
                            key={agent.id}
                            value={agent.agentIdentifier}
                            className="font-mono text-xs"
                          >
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.agentIdentifier ? (
                  <p className="text-sm text-destructive">
                    {errors.agentIdentifier.message}
                  </p>
                ) : null}
                {paidAgents.length === 0 && !isLoadingAgents ? (
                  <p className="text-xs text-muted-foreground">
                    {tForm("freeAgentsHint")}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="purchase-input-hash">
                  {tForm("inputHashLabel")}{" "}
                  <span className="text-destructive">{tForm("required")}</span>
                </Label>
                <Input
                  id="purchase-input-hash"
                  {...register("inputHash")}
                  className="font-mono text-xs"
                />
                {errors.inputHash ? (
                  <p className="text-sm text-destructive">
                    {errors.inputHash.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="purchase-purchaser-id">
                  {tForm("purchaserIdLabel")}{" "}
                  <span className="text-destructive">{tForm("required")}</span>
                </Label>
                <Input
                  id="purchase-purchaser-id"
                  {...register("identifierFromPurchaser")}
                  className="font-mono text-xs"
                />
                {errors.identifierFromPurchaser ? (
                  <p className="text-sm text-destructive">
                    {errors.identifierFromPurchaser.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="payByTime">
                  {t("payByTimeLabel")}{" "}
                  <span className="text-destructive">{tForm("required")}</span>
                </Label>
                <Input id="payByTime" {...register("payByTime")} />
                {errors.payByTime ? (
                  <p className="text-sm text-destructive">
                    {errors.payByTime.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="submitResultTime">
                  {t("submitResultTimeLabel")}{" "}
                  <span className="text-destructive">{tForm("required")}</span>
                </Label>
                <Input
                  id="submitResultTime"
                  {...register("submitResultTime")}
                />
                {errors.submitResultTime ? (
                  <p className="text-sm text-destructive">
                    {errors.submitResultTime.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="unlockTime">
                  {t("unlockTimeLabel")}{" "}
                  <span className="text-destructive">{tForm("required")}</span>
                </Label>
                <Input id="unlockTime" {...register("unlockTime")} />
                {errors.unlockTime ? (
                  <p className="text-sm text-destructive">
                    {errors.unlockTime.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="externalDisputeUnlockTime">
                  {t("externalDisputeUnlockTimeLabel")}{" "}
                  <span className="text-destructive">{tForm("required")}</span>
                </Label>
                <Input
                  id="externalDisputeUnlockTime"
                  {...register("externalDisputeUnlockTime")}
                />
                {errors.externalDisputeUnlockTime ? (
                  <p className="text-sm text-destructive">
                    {errors.externalDisputeUnlockTime.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="purchase-metadata">
                  {tForm("metadataLabel")}
                </Label>
                <Input id="purchase-metadata" {...register("metadata")} />
              </div>
            </div>

            {hasResultUi && (
              <div
                className="space-y-4 pt-2"
                role={created ? "region" : undefined}
                aria-label={created ? t("createdSectionTitle") : undefined}
              >
                {created && (
                  <div className="flex items-center gap-3">
                    <Separator className="flex-1 shrink" />
                    <span className="shrink-0 text-base font-medium text-foreground">
                      {t("createdSectionTitle")}
                    </span>
                    <Separator className="flex-1 shrink" />
                  </div>
                )}
                <CurlResponseViewer
                  curlCommand={curlCommand}
                  response={response}
                  error={error}
                />
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={
                isLoading ||
                isLoadingAgents ||
                (paidAgents.length === 0 && !(watchedAgentId ?? "").trim())
              }
            >
              {isLoading ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  {t("creating")}
                </>
              ) : (
                t("submit")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
