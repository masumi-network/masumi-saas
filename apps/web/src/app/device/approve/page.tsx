import prisma from "@masumi/database/client";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getStoredOidcGrantScopes } from "@/lib/auth/oidc-user-grants";
import { getSession } from "@/lib/auth/utils";
import { getTrustedOidcClients } from "@/lib/config/oidc.config";
import {
  getOidcScopeDisplayItems,
  isOidcApiScope,
  isOidcStandardScope,
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
  const grantedApiScopes = deviceCode.clientId
    ? await getStoredOidcGrantScopes(session.user.id, deviceCode.clientId)
    : [];
  const grantedApiScopeSet = new Set(grantedApiScopes);
  const identityScopeItems = getOidcScopeDisplayItems(
    scopes.filter((scope) => isOidcStandardScope(scope)),
  );
  const newApiScopeItems = getOidcScopeDisplayItems(
    scopes.filter(
      (scope) => isOidcApiScope(scope) && !grantedApiScopeSet.has(scope),
    ),
  );
  const existingApiScopeItems = getOidcScopeDisplayItems(
    scopes.filter(
      (scope) => isOidcApiScope(scope) && grantedApiScopeSet.has(scope),
    ),
  );

  return (
    <DeviceApprovalCard
      userCode={normalizedUserCode}
      accountEmail={session.user.email}
      accountName={session.user.name ?? null}
      switchAccountCallbackUrl={`/device/approve?user_code=${normalizedUserCode}`}
      clientLabel={clientLabel}
      identityScopeItems={identityScopeItems}
      newApiScopeItems={newApiScopeItems}
      existingApiScopeItems={existingApiScopeItems}
    />
  );
}
