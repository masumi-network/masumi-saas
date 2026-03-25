"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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
  generateSaasPurchaseCurl,
} from "@/lib/developers/testing-utils";
import { extractErrorMessage } from "@/lib/utils/extract-error";

interface FullPaymentCycleDialogProps {
  open: boolean;
  onClose: () => void;
  paidAgents: PaidTestingAgent[];
  isLoadingAgents: boolean;
}

function parseNodeDataPayload(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.data !== undefined && o.data !== null && typeof o.data === "object") {
    return o.data as Record<string, unknown>;
  }
  return o;
}

function buildPurchaseBodyFromPayment(
  payment: Record<string, unknown>,
  form: PaymentFormValues,
  network: "Preprod" | "Mainnet",
): object | null {
  const scw = payment.SmartContractWallet as
    | { walletVkey?: string }
    | null
    | undefined;
  const sellerVkey = scw?.walletVkey ?? "";
  if (!sellerVkey) return null;
  const payByTime = payment.payByTime;
  if (payByTime == null || payByTime === "") return null;

  return {
    blockchainIdentifier: String(payment.blockchainIdentifier ?? ""),
    network,
    inputHash: form.inputHash,
    sellerVkey,
    agentIdentifier: form.agentIdentifier,
    identifierFromPurchaser: form.identifierFromPurchaser,
    payByTime: String(payByTime),
    submitResultTime: String(payment.submitResultTime ?? ""),
    unlockTime: String(payment.unlockTime ?? ""),
    externalDisputeUnlockTime: String(payment.externalDisputeUnlockTime ?? ""),
    ...(form.metadata?.trim() ? { metadata: form.metadata.trim() } : {}),
  };
}

export function FullPaymentCycleDialog({
  open,
  onClose,
  paidAgents,
  isLoadingAgents,
}: FullPaymentCycleDialogProps) {
  const t = useTranslations("Developers.testing.fullCycleDialog");
  const tForm = useTranslations("Developers.testing.form");
  const { network } = usePaymentNetwork();

  const [step, setStep] = useState<1 | 2>(1);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [isLoadingPurchase, setIsLoadingPurchase] = useState(false);

  const [paymentCurl, setPaymentCurl] = useState("");
  const [purchaseCurl, setPurchaseCurl] = useState("");
  const [paymentResponse, setPaymentResponse] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [purchaseResponse, setPurchaseResponse] = useState<object | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

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
      setStep(1);
      setPaymentResponse(null);
      setPurchaseResponse(null);
      setPaymentError(null);
      setPurchaseError(null);
      setPaymentCurl("");
      setPurchaseCurl("");
    }
  }, [open, setValue, resetInputData]);

  const handleClose = useCallback(() => {
    reset();
    resetInputData(false);
    setStep(1);
    setPaymentResponse(null);
    setPurchaseResponse(null);
    setPaymentError(null);
    setPurchaseError(null);
    setPaymentCurl("");
    setPurchaseCurl("");
    onClose();
  }, [onClose, reset, resetInputData]);

  const createPurchaseAfterPayment = useCallback(
    async (
      payment: Record<string, unknown>,
      formData: PaymentFormValues,
    ): Promise<void> => {
      try {
        setIsLoadingPurchase(true);
        setPurchaseError(null);
        setStep(2);

        const body = buildPurchaseBodyFromPayment(payment, formData, network);
        if (!body) {
          throw new Error(t("errors.missingSellerOrTimes"));
        }

        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        setPurchaseCurl(generateSaasPurchaseCurl(origin, body));

        const res = await fetch("/api/v1/purchase", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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
              t("errors.purchaseRequestFailed", { status: res.status }),
            ),
          );
        }

        const payload = parseNodeDataPayload(json);
        if (!payload) {
          throw new Error(t("errors.emptyPurchaseResponse"));
        }

        setPurchaseResponse(payload);
        toast.success(t("successPurchaseToast"));
      } catch (err: unknown) {
        const message = extractErrorMessage(err, t("errors.purchaseGeneric"));
        setPurchaseError(message);
        toast.error(message);
      } finally {
        setIsLoadingPurchase(false);
      }
    },
    [network, t],
  );

  const onSubmitPayment = useCallback(
    async (data: PaymentFormValues) => {
      try {
        setIsLoadingPayment(true);
        setPaymentError(null);

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
        setPaymentCurl(generateSaasPaymentCurl(origin, requestBody));

        const res = await fetch("/api/v1/payment", {
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
              t("errors.paymentRequestFailed", { status: res.status }),
            ),
          );
        }

        const payload = parseNodeDataPayload(json);
        if (!payload) {
          throw new Error(t("errors.emptyPaymentResponse"));
        }

        setPaymentResponse(payload);
        toast.success(t("successPaymentToast"));

        setTimeout(() => {
          void createPurchaseAfterPayment(payload, data);
        }, 400);
      } catch (err: unknown) {
        const message = extractErrorMessage(err, t("errors.paymentGeneric"));
        setPaymentError(message);
        toast.error(message);
      } finally {
        setIsLoadingPayment(false);
      }
    },
    [createPurchaseAfterPayment, network, t],
  );

  const showResults = paymentResponse !== null || paymentError !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0"
        closeButtonClassName="top-8 right-4 -translate-y-1/2"
      >
        <div className="shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("title")}
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">{t("intro")}</p>
          </DialogHeader>
        </div>

        <div className="flex items-center gap-3 border-b px-6 py-3 shrink-0 bg-background">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                paymentResponse
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {paymentResponse ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              ) : (
                "1"
              )}
            </div>
            <span className="text-sm font-medium truncate">
              {t("stepPayment")}
            </span>
            {paymentResponse ? (
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {t("done")}
              </Badge>
            ) : null}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                purchaseResponse
                  ? "bg-primary text-primary-foreground"
                  : step >= 2
                    ? "bg-primary/80 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {purchaseResponse ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              ) : (
                "2"
              )}
            </div>
            <span className="text-sm font-medium truncate">
              {t("stepPurchase")}
            </span>
            {purchaseResponse ? (
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {t("done")}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-6">
          {!showResults && (
            <form
              onSubmit={handleSubmit(onSubmitPayment)}
              className="space-y-6"
            >
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
              <Separator />
              <DialogFooter className="p-0 sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isLoadingPayment}
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    isLoadingPayment ||
                    isLoadingAgents ||
                    paidAgents.length === 0
                  }
                >
                  {isLoadingPayment ? (
                    <>
                      <Spinner size={16} className="mr-2" />
                      {t("creatingPayment")}
                    </>
                  ) : (
                    t("start")
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}

          {showResults && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  {paymentResponse ? (
                    <CheckCircle2
                      className="h-4 w-4 text-green-600 shrink-0"
                      aria-hidden
                    />
                  ) : null}
                  {t("paymentSectionTitle")}
                </h3>
                <CurlResponseViewer
                  curlCommand={paymentCurl}
                  response={paymentResponse}
                  error={paymentError}
                />
              </div>

              {isLoadingPurchase && (
                <div className="flex items-center justify-center gap-3 py-4 text-sm text-muted-foreground">
                  <Spinner className="h-5 w-5" />
                  {t("creatingPurchase")}
                </div>
              )}

              {(purchaseResponse !== null || purchaseError !== null) && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    {purchaseResponse ? (
                      <CheckCircle2
                        className="h-4 w-4 text-green-600 shrink-0"
                        aria-hidden
                      />
                    ) : null}
                    {purchaseResponse
                      ? t("purchaseSuccessTitle")
                      : t("purchaseFailedTitle")}
                  </h3>
                  <CurlResponseViewer
                    curlCommand={purchaseCurl}
                    response={purchaseResponse}
                    error={purchaseError}
                  />
                </div>
              )}

              <div className="flex justify-end pt-2 border-t">
                <Button type="button" variant="outline" onClick={handleClose}>
                  {t("close")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
