"use client";

import { useState } from "react";

import { NetworkRegisterHeader } from "./network-register-header";
import { NetworkRegisterKycFlow } from "./network-register-kyc-flow";
import { NetworkRegisterShell } from "./network-register-shell";

type NetworkRegisterVerifyViewProps = {
  draftId: string;
  kycStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
  rejectionReason?: string | null;
  title: string;
  description: string;
};

export function NetworkRegisterVerifyView({
  draftId,
  kycStatus,
  rejectionReason,
  title,
  description,
}: NetworkRegisterVerifyViewProps) {
  const [wide, setWide] = useState(false);

  return (
    <NetworkRegisterShell wide={wide}>
      <div className="space-y-6 rounded-2xl border border-border bg-card p-6 pb-4 shadow-sm sm:p-8 sm:pb-6">
        <NetworkRegisterHeader title={title} description={description} />

        <NetworkRegisterKycFlow
          draftId={draftId}
          kycStatus={kycStatus}
          rejectionReason={rejectionReason}
          onLayoutWideChange={setWide}
        />
      </div>
    </NetworkRegisterShell>
  );
}
