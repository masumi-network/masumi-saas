import prisma from "@masumi/database/client";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getStoredOidcGrantScopes } from "@/lib/auth/oidc-user-grants";
import { getSession } from "@/lib/auth/utils";
import { getTrustedOidcClients } from "@/lib/config/oidc.config";
import {
  getGroupedOidcApiPermissionItems,
  getOidcScopeDisplayItems,
  isOidcApiScope,
  isOidcStandardScope,
  normalizeScopeList,
} from "@/lib/config/oidc-scopes.config";

import { DeviceApprovalCard } from "./components/device-approval-card";

export const metadata: Metadata = {
  title: "Masumi - Device Login",
  description: "Approve Masumi CLI device authorization",
};

interface DevicePageProps {
  searchParams: Promise<{ user_code?: string }>;
}

type DeviceRequestLookup = {
  clientId: string | null;
  scope: string | null;
  status: string;
  expiresAt: Date;
};

const DEVICE_LOOKUP_ERROR_COPY = {
  invalid: "Invalid device code. Check the code and try again.",
  expired:
    "This device code timed out. Start again from the CLI to get a new code.",
  processed:
    "This device request has already been completed. Start again from the CLI to get a new code.",
} as const;

function normalizeUserCode(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/-/g, "").toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function getDeviceLookupError(
  deviceRequest: DeviceRequestLookup | null,
  now = new Date(),
): string | null {
  if (!deviceRequest) {
    return DEVICE_LOOKUP_ERROR_COPY.invalid;
  }

  if (deviceRequest.expiresAt < now) {
    return DEVICE_LOOKUP_ERROR_COPY.expired;
  }

  if (deviceRequest.status !== "pending") {
    return DEVICE_LOOKUP_ERROR_COPY.processed;
  }

  return null;
}

export default async function DevicePage({ searchParams }: DevicePageProps) {
  const { user_code } = await searchParams;
  const normalizedUserCode = normalizeUserCode(user_code);
  const session = await getSession();
  const emailVerified = session?.user?.emailVerified === true;

  let lookupError: string | null = null;
  let isResolvedRequest = false;
  let clientLabel = "Agent Messenger CLI";
  let identityScopeItems: ReturnType<typeof getOidcScopeDisplayItems> = [];
  let newApiPermissionGroups: ReturnType<
    typeof getGroupedOidcApiPermissionItems
  > = [];
  let existingApiPermissionGroups: ReturnType<
    typeof getGroupedOidcApiPermissionItems
  > = [];

  if (normalizedUserCode) {
    const deviceRequest = await prisma.deviceCode.findUnique({
      where: { userCode: normalizedUserCode },
      select: {
        clientId: true,
        scope: true,
        status: true,
        expiresAt: true,
      },
    });

    lookupError = getDeviceLookupError(deviceRequest);

    if (!lookupError && deviceRequest) {
      if (!session?.user) {
        redirect(
          `/signin?callbackUrl=${encodeURIComponent(`/device?user_code=${normalizedUserCode}`)}`,
        );
      }

      isResolvedRequest = true;
      clientLabel =
        getTrustedOidcClients().find(
          (client) => client.clientId === deviceRequest.clientId,
        )?.name ??
        deviceRequest.clientId ??
        clientLabel;

      const scopes = normalizeScopeList(deviceRequest.scope ?? "openid");
      const grantedApiScopes = deviceRequest.clientId
        ? await getStoredOidcGrantScopes(
            session.user.id,
            deviceRequest.clientId,
          )
        : [];
      const grantedApiScopeSet = new Set(grantedApiScopes);

      identityScopeItems = getOidcScopeDisplayItems(
        scopes.filter((scope) => isOidcStandardScope(scope)),
      );
      newApiPermissionGroups = getGroupedOidcApiPermissionItems(
        scopes.filter(
          (scope) => isOidcApiScope(scope) && !grantedApiScopeSet.has(scope),
        ),
      );
      existingApiPermissionGroups = getGroupedOidcApiPermissionItems(
        scopes.filter(
          (scope) => isOidcApiScope(scope) && grantedApiScopeSet.has(scope),
        ),
      );
    }
  }

  return (
    <DeviceApprovalCard
      initialUserCode={normalizedUserCode ?? user_code ?? null}
      lookupError={lookupError}
      accountEmail={session?.user?.email ?? null}
      accountName={session?.user?.name ?? null}
      emailVerified={emailVerified}
      switchAccountCallbackUrl={
        normalizedUserCode
          ? `/device?user_code=${normalizedUserCode}`
          : "/device"
      }
      verificationContinueUrl={
        normalizedUserCode
          ? `/device?user_code=${normalizedUserCode}`
          : "/device"
      }
      clientLabel={clientLabel}
      isResolvedRequest={isResolvedRequest}
      identityScopeItems={identityScopeItems}
      newApiPermissionGroups={newApiPermissionGroups}
      existingApiPermissionGroups={existingApiPermissionGroups}
    />
  );
}
