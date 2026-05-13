"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { CurlResponseViewer } from "@/components/developers/testing/curl-response-viewer";
import {
  createPaymentFormSchema,
  type PaidTestingAgent,
  PaymentFormFields,
  type PaymentFormValues,
  useInputDataHash,
} from "@/components/developers/testing/payment-form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import {
  calculateDefaultTimes,
  generateRandomHex,
  generateSaasPaymentCurl,
} from "@/lib/developers/testing-utils";
import { extractErrorMessage } from "@/lib/utils/extract-error";

interface TestPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  paidAgents: PaidTestingAgent[];
  isLoadingAgents: boolean;
}

function parsePaymentSuccessPayload(json: unknown): object | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.data !== undefined && o.data !== null && typeof o.data === "object") {
    return o.data as object;
  }
  return json as object;
}

export function TestPaymentDialog({
  open,
  onClose,
  paidAgents,
  isLoadingAgents,
}: TestPaymentDialogProps) {
  const t = useTranslations("Developers.testing.dialog");
  const tForm = useTranslations("Developers.testing.form");
  const { network } = usePaymentNetwork();
  const [isLoading, setIsLoading] = useState(false);
  const [curlCommand, setCurlCommand] = useState("");
  const [response, setResponse] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);

  const schema = useMemo(
    () => createPaymentFormSchema((k) => tForm(k)),
    [tForm],
  );

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      agentIdentifier: "",
      inputHash: "",
      identifierFromPurchaser: "",
      metadata: "",
    },
  });

  const { inputData, setInputData, inputDataError, resetInputData } =
    useInputDataHash(setValue, watch);

  useEffect(() => {
    if (open) {
      resetInputData();
      setValue("identifierFromPurchaser", generateRandomHex(16));
      setResponse(null);
      setError(null);
      setCurlCommand("");
    }
  }, [open, setValue, resetInputData]);

  const handleClose = useCallback(() => {
    reset();
    resetInputData(false);
    setResponse(null);
    setError(null);
    setCurlCommand("");
    onClose();
  }, [onClose, reset, resetInputData]);

  const onSubmit = useCallback(
    async (data: PaymentFormValues) => {
      try {
        setIsLoading(true);
        setError(null);

        const times = calculateDefaultTimes();
        const requestBody = {
          network,
          agentIdentifier: data.agentIdentifier,
          inputHash: data.inputHash,
          identifierFromPurchaser: data.identifierFromPurchaser,
          payByTime: times.payByTime.toISOString(),
          submitResultTime: times.submitResultTime.toISOString(),
          unlockTime: times.unlockTime.toISOString(),
          externalDisputeUnlockTime:
            times.externalDisputeUnlockTime.toISOString(),
          ...(data.metadata?.trim() ? { metadata: data.metadata.trim() } : {}),
        };

        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        setCurlCommand(generateSaasPaymentCurl(origin, requestBody));

        const res = await fetch("/pay/api/v1/payment", {
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

        const payload = parsePaymentSuccessPayload(json);
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

  const hasPaymentResultUi = Boolean(
    (curlCommand && curlCommand.length > 0) ||
    response !== null ||
    (error && error.length > 0),
  );
  const paymentCreatedSuccessfully = response !== null;

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
            <PaymentFormFields
              register={register}
              setValue={setValue}
              control={control}
              errors={errors}
              paidAgents={paidAgents}
              isLoadingAgents={isLoadingAgents}
              inputData={inputData}
              setInputData={setInputData}
              inputDataError={inputDataError}
            />

            {hasPaymentResultUi && (
              <div
                className="space-y-4 pt-2"
                role={paymentCreatedSuccessfully ? "region" : undefined}
                aria-label={
                  paymentCreatedSuccessfully
                    ? t("createdPaymentSectionTitle")
                    : undefined
                }
              >
                {paymentCreatedSuccessfully && (
                  <div className="flex items-center gap-3">
                    <Separator className="flex-1 shrink" />
                    <span className="shrink-0 text-base font-medium text-foreground">
                      {t("createdPaymentSectionTitle")}
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
              disabled={isLoading || isLoadingAgents || paidAgents.length === 0}
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
