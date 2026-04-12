import prisma from "@masumi/database/client";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/utils";
import { getTrustedOidcClients } from "@/lib/config/oidc.config";
import {
  getOidcScopeDisplayItems,
  normalizeScopeList,
} from "@/lib/config/oidc-scopes.config";

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

  const session = await getSession();
  if (!session?.user) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent(`/device/approve?user_code=${normalizedUserCode}`)}`,
    );
  }

  const deviceCode = await prisma.deviceCode.findUnique({
    where: { userCode: normalizedUserCode },
    select: {
      clientId: true,
      scope: true,
    },
  });

  if (!deviceCode) {
    redirect("/device");
  }

  const clientLabel =
    getTrustedOidcClients().find(
      (client) => client.clientId === deviceCode.clientId,
    )?.name ??
    deviceCode.clientId ??
    "Masumi client";
  const scopes = normalizeScopeList(deviceCode.scope ?? "openid");
  const scopeItems = getOidcScopeDisplayItems(scopes);

  return (
    <DeviceApprovalCard
      userCode={normalizedUserCode}
      accountEmail={session.user.email}
      accountName={session.user.name ?? null}
      switchAccountCallbackUrl={`/device/approve?user_code=${normalizedUserCode}`}
      clientLabel={clientLabel}
      scopes={scopes}
      scopeItems={scopeItems}
    />
  );
}
