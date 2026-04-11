import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/utils";

import { DeviceApprovalCard } from "../components/device-approval-card";

export const metadata: Metadata = {
  title: "Masumi - Device Approval",
  description: "Approve Masumi CLI device authorization",
};

interface DeviceApprovalPageProps {
  searchParams: Promise<{ user_code?: string }>;
}

function normalizeUserCode(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/-/g, "").toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export default async function DeviceApprovalPage({
  searchParams,
}: DeviceApprovalPageProps) {
  const { user_code } = await searchParams;
  const normalizedUserCode = normalizeUserCode(user_code);

  if (!normalizedUserCode) {
    redirect("/device");
  }

  const authContext = await getAuthContext();
  if (!authContext.isAuthenticated) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent(`/device/approve?user_code=${normalizedUserCode}`)}`,
    );
  }

  return <DeviceApprovalCard userCode={normalizedUserCode} />;
}
