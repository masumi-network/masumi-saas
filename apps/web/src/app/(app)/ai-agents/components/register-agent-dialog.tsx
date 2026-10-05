"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";

import { RegisterAgentFormStep } from "./register-agent-form-step";
import { RegisterAgentReviewStep } from "./register-agent-review-step";
import {
  type RegisterAgentDialogProps,
  useRegisterAgentController,
} from "./use-register-agent-controller";

export function RegisterAgentDialog(props: RegisterAgentDialogProps) {
  const { open } = props;
  const controller = useRegisterAgentController(props);
  const {
    t,
    network,
    step,
    reviewValues,
    handleRegistrationDialogOpenChange,
    closeConfirmReason,
    handleCloseConfirmOpenChange,
    handleCloseConfirm,
    networkSwitchConfirmOpen,
    pendingPaymentNetwork,
    handleNetworkSwitchConfirmOpenChange,
    confirmPaymentNetworkChange,
  } = controller;

  return (
    <>
      <Dialog open={open} onOpenChange={handleRegistrationDialogOpenChange}>
        <DialogPortal>
          <DialogOverlay />
          {step === "form" ? (
            <RegisterAgentFormStep controller={controller} />
          ) : reviewValues ? (
            <RegisterAgentReviewStep
              controller={controller}
              reviewValues={reviewValues}
            />
          ) : null}
        </DialogPortal>
      </Dialog>
      <ConfirmDialog
        open={closeConfirmReason !== null}
        onOpenChange={handleCloseConfirmOpenChange}
        onConfirm={handleCloseConfirm}
        title={
          closeConfirmReason === "loading"
            ? t("closeConfirmTitle")
            : t("discardConfirmTitle")
        }
        description={
          closeConfirmReason === "loading"
            ? t("closeConfirmDescription")
            : t("discardConfirmDescription")
        }
        confirmText={
          closeConfirmReason === "loading"
            ? t("closeAnyway")
            : t("discardConfirm")
        }
        cancelText={t("cancel")}
      />
      <ConfirmDialog
        open={networkSwitchConfirmOpen}
        onOpenChange={handleNetworkSwitchConfirmOpenChange}
        onConfirm={confirmPaymentNetworkChange}
        title={t("networkSwitchConfirmTitle")}
        description={
          pendingPaymentNetwork
            ? t("networkSwitchConfirmDescription", {
                from: network,
                to: pendingPaymentNetwork,
              })
            : t("networkSwitchConfirmDescriptionGeneric")
        }
        confirmText={t("networkSwitchConfirm")}
        cancelText={t("cancel")}
      />
    </>
  );
}
