"use client";

import { CircleHelp, RefreshCw } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import adaIcon from "@/assets/ada.png";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { validateCardanoAddress } from "@/lib/cardano/validate-cardano-address";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { zodResolver } from "@/lib/form-zod-resolver";
import { formatDashboardEarningsTotal } from "@/lib/payment-node/format";

/**
 * Withdraw UX: Preprod implements payment method (wallet only) + withdrawal details.
 * Mainnet: add Bridge.xyz bank payout option and conditional fields (see product spec).
 */
const USD_PREFIX = "$";

const PREPROD_PAYMENT_METHOD_WALLET = "wallet" as const;

/** Receiving-wallet chain; Preprod UI only lists Cardano Preprod for now. */
const WITHDRAW_WALLET_CHAIN_CARDANO_PREPROD = "cardano-preprod" as const;

function CardanoPreprodSelectLabel({ text }: { text: string }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2">
      <Image
        src={adaIcon}
        alt=""
        width={16}
        height={16}
        className="size-4 shrink-0 object-contain"
      />
      <span className="min-w-0 truncate">{text}</span>
    </span>
  );
}

type WithdrawFormValues = {
  amountUsd: number | undefined;
  paymentMethod: typeof PREPROD_PAYMENT_METHOD_WALLET;
  walletChain: typeof WITHDRAW_WALLET_CHAIN_CARDANO_PREPROD;
  walletAddress: string;
};

type EarningsWithdrawDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function createWithdrawFormSchema(
  messages: {
    amountRequired: string;
    amountInvalid: string;
    amountExceedsAvailable: (maxFormatted: string) => string;
    walletAddressRequired: string;
    walletAddressInvalidForNetwork: string;
  },
  availableUsd: number,
) {
  return z
    .object({
      paymentMethod: z.literal(PREPROD_PAYMENT_METHOD_WALLET),
      walletChain: z.literal(WITHDRAW_WALLET_CHAIN_CARDANO_PREPROD),
      amountUsd: z
        .union([z.undefined(), z.number()])
        .superRefine((val, ctx) => {
          if (val === undefined || Number.isNaN(val)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: messages.amountRequired,
            });
            return;
          }
          if (val <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: messages.amountInvalid,
            });
            return;
          }
          if (Math.abs(val * 100 - Math.round(val * 100)) > 1e-8) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: messages.amountInvalid,
            });
          }
        }),
      walletAddress: z.string().trim().min(1, messages.walletAddressRequired),
    })
    .superRefine((data, ctx) => {
      const val = data.amountUsd;
      if (val !== undefined && !Number.isNaN(val) && val > 0) {
        const available = Math.max(0, availableUsd);
        const valCents = Math.round(val * 100);
        const maxCents = Math.round(available * 100);
        if (valCents > maxCents) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: messages.amountExceedsAvailable(
              formatDashboardEarningsTotal(available, "USD"),
            ),
            path: ["amountUsd"],
          });
        }
      }

      if (data.walletChain !== WITHDRAW_WALLET_CHAIN_CARDANO_PREPROD) {
        return;
      }
      const trimmed = data.walletAddress.trim();
      if (trimmed.length === 0) {
        return;
      }
      const { isValid } = validateCardanoAddress(trimmed, "Preprod");
      if (!isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: messages.walletAddressInvalidForNetwork,
          path: ["walletAddress"],
        });
      }
    });
}

export function EarningsWithdrawDialog({
  open,
  onOpenChange,
}: EarningsWithdrawDialogProps) {
  const t = useTranslations("App.Withdraw");
  const tDialog = useTranslations("Components.Dialog");
  const { network } = usePaymentNetwork();

  const isPreprod = network === "Preprod";

  // TODO(masumi-saas): Replace with withdrawable balance for `network` from payment node / backend API.
  const availableToWithdrawUsd = 0;

  const withdrawFormSchema = useMemo(
    () =>
      createWithdrawFormSchema(
        {
          amountRequired: t("amountRequired"),
          amountInvalid: t("amountInvalid"),
          amountExceedsAvailable: (maxFormatted) =>
            t("amountExceedsAvailable", { max: maxFormatted }),
          walletAddressRequired: t("walletAddressRequired"),
          walletAddressInvalidForNetwork: t("walletAddressInvalidForNetwork", {
            network: t("chainCardanoPreprod"),
          }),
        },
        availableToWithdrawUsd,
      ),
    [t, availableToWithdrawUsd],
  );

  const withdrawResolver = useMemo(
    () => zodResolver(withdrawFormSchema) as Resolver<WithdrawFormValues>,
    [withdrawFormSchema],
  );

  const form = useForm<WithdrawFormValues>({
    resolver: withdrawResolver,
    defaultValues: {
      amountUsd: undefined,
      paymentMethod: PREPROD_PAYMENT_METHOD_WALLET,
      walletChain: WITHDRAW_WALLET_CHAIN_CARDANO_PREPROD,
      walletAddress: "",
    },
  });

  const { isDirty } = form.formState;
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  const paymentMethodWatched = useWatch({
    control: form.control,
    name: "paymentMethod",
    defaultValue: PREPROD_PAYMENT_METHOD_WALLET,
  });
  const isWalletPayout =
    (paymentMethodWatched ?? PREPROD_PAYMENT_METHOD_WALLET) ===
    PREPROD_PAYMENT_METHOD_WALLET;

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      form.reset({
        amountUsd: undefined,
        paymentMethod: PREPROD_PAYMENT_METHOD_WALLET,
        walletChain: WITHDRAW_WALLET_CHAIN_CARDANO_PREPROD,
        walletAddress: "",
      });
    }
    wasOpenRef.current = open;
  }, [open, form]);

  useEffect(() => {
    if (!open || !isPreprod) {
      return;
    }
    const pm = form.getValues("paymentMethod");
    if (pm !== PREPROD_PAYMENT_METHOD_WALLET) {
      form.setValue("paymentMethod", PREPROD_PAYMENT_METHOD_WALLET, {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
    const chain = form.getValues("walletChain");
    if (chain !== WITHDRAW_WALLET_CHAIN_CARDANO_PREPROD) {
      form.setValue("walletChain", WITHDRAW_WALLET_CHAIN_CARDANO_PREPROD, {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [open, isPreprod, form]);

  const resetWithdrawForm = useCallback(() => {
    form.reset({
      amountUsd: undefined,
      paymentMethod: PREPROD_PAYMENT_METHOD_WALLET,
      walletChain: WITHDRAW_WALLET_CHAIN_CARDANO_PREPROD,
      walletAddress: "",
    });
  }, [form]);

  const handleDialogOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        onOpenChange(true);
        return;
      }
      if (isDirty) {
        setCloseConfirmOpen(true);
        return;
      }
      resetWithdrawForm();
      onOpenChange(false);
    },
    [isDirty, onOpenChange, resetWithdrawForm],
  );

  const handleConfirmDiscardClose = useCallback(() => {
    setCloseConfirmOpen(false);
    resetWithdrawForm();
    onOpenChange(false);
  }, [onOpenChange, resetWithdrawForm]);

  const handleCancelCloseConfirm = useCallback(() => {
    setCloseConfirmOpen(false);
  }, []);

  const applyMaxWithdrawAmount = useCallback(() => {
    form.setValue("amountUsd", availableToWithdrawUsd, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [availableToWithdrawUsd, form]);

  const handleRefreshBalance = useCallback(() => {
    // TODO(masumi-saas): Refetch withdrawable balance for `network` and update UI state.
  }, []);

  const onWithdrawSubmit = useCallback(
    (_values: WithdrawFormValues) => {
      toast.info(t("preprodWithdrawUnsupported"));
    },
    [t],
  );

  return (
    <Fragment>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          className="sm:max-w-md max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0"
          closeButtonClassName="top-8 right-4 -translate-y-1/2"
          isPushedBack={closeConfirmOpen}
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
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              onSubmit={form.handleSubmit(onWithdrawSubmit)}
            >
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                {!isPreprod && (
                  <div className="flex w-full min-w-0 items-start justify-between gap-3">
                    <DialogDescription className="text-muted-foreground flex-1 text-sm">
                      {t("description")}
                    </DialogDescription>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="border-border h-8 w-8 shrink-0"
                      aria-label={t("refreshBalanceAria")}
                      onClick={handleRefreshBalance}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {isPreprod ? (
                  <div className="space-y-4">
                    <div className="flex w-full min-w-0 items-center justify-between gap-3">
                      <h3 className="text-base font-semibold tracking-tight">
                        {t("withdrawalAmountTitle")}
                      </h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="border-border h-8 w-8 shrink-0"
                        aria-label={t("refreshBalanceAria")}
                        onClick={handleRefreshBalance}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3 sm:p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                        <span className="text-muted-foreground text-sm font-medium">
                          {t("availableBalanceLabel")}
                        </span>
                        <span className="font-mono text-lg font-semibold tabular-nums tracking-tight sm:text-right">
                          {formatDashboardEarningsTotal(
                            availableToWithdrawUsd,
                            "USD",
                          )}
                        </span>
                      </div>
                      <Separator />
                      <FormField
                        control={form.control}
                        name="amountUsd"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between gap-2">
                              <FormLabel
                                htmlFor="earnings-withdraw-amount"
                                className="text-sm font-medium leading-none"
                              >
                                {t("amountLabel")}
                              </FormLabel>
                              <Button
                                type="button"
                                variant="link"
                                className="text-primary h-auto shrink-0 px-0 py-0 text-xs font-semibold"
                                onClick={applyMaxWithdrawAmount}
                              >
                                {t("maxAmount")}
                              </Button>
                            </div>
                            <FormControl>
                              <div className="relative">
                                <span
                                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium"
                                  aria-hidden
                                >
                                  {USD_PREFIX}
                                </span>
                                <Input
                                  id="earnings-withdraw-amount"
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  min="0"
                                  autoComplete="off"
                                  placeholder={t("amountPlaceholder")}
                                  className="pl-7 font-mono text-sm tabular-nums"
                                  value={
                                    field.value !== undefined &&
                                    !Number.isNaN(field.value)
                                      ? field.value
                                      : ""
                                  }
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === "") {
                                      field.onChange(undefined);
                                      return;
                                    }
                                    const n = Number.parseFloat(raw);
                                    field.onChange(
                                      Number.isNaN(n) ? Number.NaN : n,
                                    );
                                  }}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <h3 className="text-base font-semibold tracking-tight">
                      {t("withdrawalDetailsTitle")}
                    </h3>
                    <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-3 sm:p-4">
                      <FormField
                        control={form.control}
                        name="paymentMethod"
                        render={({ field }) => {
                          const methodValue =
                            field.value ?? PREPROD_PAYMENT_METHOD_WALLET;
                          return (
                            <FormItem>
                              <FormLabel>{t("paymentMethodLabel")}</FormLabel>
                              <Select
                                value={methodValue}
                                onValueChange={(v) => {
                                  field.onChange(v);
                                }}
                                onOpenChange={(open) => {
                                  if (!open) {
                                    field.onBlur();
                                  }
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue
                                      placeholder={t("paymentMethodWallet")}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent align="start">
                                  <SelectItem
                                    value={PREPROD_PAYMENT_METHOD_WALLET}
                                  >
                                    {t("paymentMethodWallet")}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                      <Separator />
                      {isWalletPayout ? (
                        <>
                          <FormField
                            control={form.control}
                            name="walletChain"
                            render={({ field }) => {
                              const chainValue =
                                field.value ??
                                WITHDRAW_WALLET_CHAIN_CARDANO_PREPROD;
                              return (
                                <FormItem>
                                  <div className="flex items-center gap-2">
                                    <FormLabel className="mb-0">
                                      {t("walletNetworkLabel")}
                                    </FormLabel>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className="text-muted-foreground hover:text-foreground inline-flex cursor-help rounded-sm border-0 bg-transparent p-0"
                                          aria-label={t("walletNetworkTooltip")}
                                        >
                                          <CircleHelp
                                            className="h-4 w-4 shrink-0"
                                            aria-hidden
                                          />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {t("walletNetworkTooltip")}
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                  <Select
                                    value={chainValue}
                                    onValueChange={(v) => {
                                      field.onChange(v);
                                    }}
                                    onOpenChange={(open) => {
                                      if (!open) {
                                        field.onBlur();
                                      }
                                    }}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="w-full">
                                        <SelectValue
                                          placeholder={
                                            <CardanoPreprodSelectLabel
                                              text={t("chainCardanoPreprod")}
                                            />
                                          }
                                        />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent align="start">
                                      <SelectItem
                                        value={
                                          WITHDRAW_WALLET_CHAIN_CARDANO_PREPROD
                                        }
                                        textValue={t("chainCardanoPreprod")}
                                      >
                                        <CardanoPreprodSelectLabel
                                          text={t("chainCardanoPreprod")}
                                        />
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                          <Separator />
                        </>
                      ) : null}
                      <FormField
                        control={form.control}
                        name="walletAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel htmlFor="earnings-withdraw-wallet-address">
                              {t("walletAddressLabel")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                id="earnings-withdraw-wallet-address"
                                autoComplete="off"
                                placeholder={t("walletAddressPlaceholder")}
                                className="font-mono text-sm"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground rounded-md border border-dashed p-4 py-12 text-center text-sm">
                    {t("comingSoon")}
                  </p>
                )}
              </div>
              <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                >
                  {tDialog("close")}
                </Button>
                {isPreprod && (
                  <Button type="submit" variant="primary">
                    {t("submitWithdraw")}
                  </Button>
                )}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <Dialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <DialogContent
          className="z-[60] flex max-h-[90vh] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
          closeButtonClassName="top-8 right-4 -translate-y-1/2"
          hideOverlay
          showCloseButton
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="bg-masumi-gradient shrink-0 border-b px-6 py-5 pr-12">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {t("closeConfirmTitle")}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <DialogDescription className="text-muted-foreground text-sm">
              {t("closeConfirmDescription")}
            </DialogDescription>
          </div>
          <DialogFooter className="bg-background shrink-0 gap-2 border-t px-6 py-4 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelCloseConfirm}
            >
              {t("closeConfirmKeepEditing")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDiscardClose}
            >
              {t("closeConfirmDiscard")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
}
