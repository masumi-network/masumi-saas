"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogContentPanel,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { dialogHeaderEnterClass } from "@/lib/dialog-motion";
import { cn } from "@/lib/utils";

import { MainnetCreditsRequiredNotice } from "./mainnet-credits-required-notice";
import type { RegisterAgentFormType } from "./register-agent-form-model";
import { RegisterAgentReviewSection } from "./register-agent-review-section";
import type { RegisterAgentController } from "./use-register-agent-controller";

export function RegisterAgentReviewStep({
  controller,
  reviewValues,
}: {
  controller: RegisterAgentController;
  reviewValues: RegisterAgentFormType;
}) {
  const {
    t,
    tags,
    network,
    selectedX402Caip2,
    x402Http: { x402ProbeRow },
    x402Options,
    isLoading,
    mainnetCreditsGate,
    handleBackFromReview,
    handleConfirmRegistration,
  } = controller;

  return (
    <DialogContentPanel
      key="register-agent-review"
      className="sm:max-w-2xl max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0"
      closeButtonClassName="top-8 right-4 -translate-y-1/2"
    >
      <div
        className={cn(
          "shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12",
          dialogHeaderEnterClass,
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {t("reviewTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            {t("reviewDescription")}
          </DialogDescription>
        </DialogHeader>
      </div>

      <DialogBody className="space-y-8">
        <MainnetCreditsRequiredNotice />
        <RegisterAgentReviewSection
          values={reviewValues}
          tags={tags}
          cardanoNetwork={network}
          evmCaip2Network={selectedX402Caip2}
          x402ProbeRow={x402ProbeRow}
          x402Options={x402Options}
          t={{
            reviewSectionAgent: t("reviewSectionAgent"),
            reviewSectionPayment: t("reviewSectionPayment"),
            registrationKind: t("registrationKind"),
            reviewRegistrationKindStandard: t("registrationKindStandardTitle"),
            reviewRegistrationKindX402: t("registrationKindX402Title"),
            reviewCardanoNetwork: t("reviewCardanoNetwork"),
            reviewX402EvmNetwork: t("reviewX402EvmNetwork"),
            name: t("name"),
            description: t("description"),
            x402ResourceUrl: t("x402ResourceUrl"),
            apiUrl: t("apiUrl"),
            runtimeProvider: t("runtimeProvider"),
            runtimeDirectTitle: t("runtimeDirectTitle"),
            runtimeLangdockTitle: t("runtimeLangdockTitle"),
            langdockAgentId: t("langdockAgentId"),
            tags: t("tags"),
            pricingModel: t("pricingModel"),
            pricingFreeTitle: t("pricingFreeTitle"),
            pricingDynamicTitle: t("pricingDynamicTitle"),
            payoutAddress: t("payoutAddress"),
            x402Title: t("x402Title"),
          }}
        />
      </DialogBody>

      <DialogFooter className="shrink-0 w-full justify-between border-t bg-background px-6 py-4">
        <div className="flex shrink-0">
          <Button
            type="button"
            variant="outline"
            className="group gap-2"
            onClick={handleBackFromReview}
            disabled={isLoading}
          >
            <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
              <ArrowLeft
                aria-hidden
                className="h-4 w-4 transition-all duration-200 ease-out motion-reduce:transition-none opacity-100 group-hover:-translate-x-0.5 group-active:-translate-x-1 motion-reduce:group-hover:translate-x-0 motion-reduce:group-active:translate-x-0"
              />
            </span>
            {t("reviewBack")}
          </Button>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={
              isLoading ||
              !reviewValues ||
              mainnetCreditsGate.isBlocked ||
              mainnetCreditsGate.isPending
            }
            className="group gap-2"
            onClick={handleConfirmRegistration}
          >
            {isLoading ? t("confirmSubmitting") : t("confirmRegistration")}
            <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
              <ArrowRight
                aria-hidden
                className={cn(
                  "h-4 w-4 transition-all duration-200 ease-out motion-reduce:transition-none",
                  isLoading
                    ? "scale-75 opacity-0"
                    : "opacity-100 group-hover:translate-x-0.5 group-active:translate-x-1 motion-reduce:group-hover:translate-x-0 motion-reduce:group-active:translate-x-0",
                )}
              />
              <Spinner
                size={16}
                className={cn(
                  "absolute transition-all duration-200 ease-out motion-reduce:transition-none",
                  isLoading ? "scale-100 opacity-100" : "scale-75 opacity-0",
                )}
              />
            </span>
          </Button>
        </div>
      </DialogFooter>
    </DialogContentPanel>
  );
}
