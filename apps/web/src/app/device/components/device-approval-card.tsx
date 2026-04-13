"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AuthorizationRequestCard } from "@/components/oidc/authorization-request-card";
import { OidcPermissionSummary } from "@/components/oidc/oidc-permission-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OidcGroupedApiPermissionCatalogGroup } from "@/lib/config/oidc-scopes.config";

type DeviceApprovalCardProps = {
  initialUserCode?: string | null;
  lookupError?: string | null;
  accountEmail?: string | null;
  accountName?: string | null;
  switchAccountCallbackUrl?: string | null;
  clientLabel?: string | null;
  isResolvedRequest: boolean;
  identityScopeItems?: Array<{
    scope: string;
    label: string;
    description: string;
    type: "standard" | "api" | "unknown";
  }>;
  newApiPermissionGroups?: OidcGroupedApiPermissionCatalogGroup[];
  existingApiPermissionGroups?: OidcGroupedApiPermissionCatalogGroup[];
};

type ApprovalState = "idle" | "denied";

const copy = {
  protocolBadge: "OIDC",
  title: "Review device access",
  subtitle:
    "Verify the device code, review the requested access, and approve the device login in one place.",
  codeLabel: "Verify device code",
  codeHint: "Dashes are optional. The code is not case sensitive.",
  codeLoadedHint:
    "Code verified. Edit it only if you want to review a different device request.",
  pendingCodeChange:
    "Review the updated code before approving. The permissions below belong to the previously loaded request.",
  reviewCode: "Verify code",
  reviewingCode: "Loading...",
  codeVerified: "Verified",
  accountLabel: "Authorizing as",
  scopesLabel: "Identity scopes",
  newPermissionsLabel: "New API permissions requested",
  newPermissionsDescription:
    "This device login is asking for additional API permissions it did not have before.",
  existingPermissionsLabel: "Already granted API permissions",
  existingPermissionsDescription:
    "These API permissions are already approved for this client.",
  defaultScope: "openid",
  noNewPermissions: "No additional API permissions are being requested.",
  noExistingPermissions: "No API permissions have been granted yet.",
  denied: "Device request denied.",
  pending: "A CLI is requesting access to your Masumi account.",
  noRequestLoaded:
    "Enter a device code to review the request before you approve it.",
  backToDashboard: "Back to dashboard",
  approve: "Approve",
  working: "Working...",
  deny: "Deny",
  switchAccount: "Switch account",
  switching: "Switching...",
  successRedirect: "/device/success",
};

export function DeviceApprovalCard({
  initialUserCode,
  lookupError,
  accountEmail,
  accountName,
  switchAccountCallbackUrl,
  clientLabel,
  isResolvedRequest,
  identityScopeItems = [],
  newApiPermissionGroups = [],
  existingApiPermissionGroups = [],
}: DeviceApprovalCardProps) {
  const router = useRouter();
  const [userCode, setUserCode] = useState(initialUserCode ?? "");
  const [status, setStatus] = useState<ApprovalState>("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);

  const normalizedUserCode = useMemo(
    () => userCode.trim().replace(/-/g, "").toUpperCase(),
    [userCode],
  );
  const resolvedUserCode = useMemo(
    () => (initialUserCode ?? "").trim().replace(/-/g, "").toUpperCase(),
    [initialUserCode],
  );
  const hasPendingCodeChange =
    isResolvedRequest && normalizedUserCode !== resolvedUserCode;
  const shouldShowCodeLookupButton =
    normalizedUserCode.length > 0 &&
    (!isResolvedRequest || normalizedUserCode !== resolvedUserCode);
  const canSubmitDecision =
    isResolvedRequest &&
    normalizedUserCode.length > 0 &&
    normalizedUserCode === resolvedUserCode;
  const resolvedClientLabel = clientLabel?.trim() || "Masumi CLI";

  useEffect(() => {
    setUserCode(initialUserCode ?? "");
    setStatus("idle");
    setActionError(null);
    setIsSubmitting(false);
    setIsCheckingCode(false);
  }, [initialUserCode, lookupError, isResolvedRequest]);

  function handleLookupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalizedUserCode) return;

    setActionError(null);
    setIsCheckingCode(true);
    router.push(`/device?user_code=${encodeURIComponent(normalizedUserCode)}`);
  }

  async function handleDecision(action: "approve" | "deny") {
    if (!resolvedUserCode || !canSubmitDecision) {
      return;
    }

    setActionError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/auth/device/${action}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userCode: resolvedUserCode }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error_description?: string;
        } | null;
        setActionError(body?.error_description || "Request failed.");
        return;
      }

      if (action === "approve") {
        window.location.assign(copy.successRedirect);
        return;
      }

      setStatus("denied");
    } catch {
      setActionError("Failed to submit your decision. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSwitchAccount() {
    setActionError(null);
    setIsSwitchingAccount(true);

    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });
    } catch (switchError) {
      console.error(
        "[device auth] Failed to sign out before switching account",
        switchError,
      );
    } finally {
      window.location.assign(
        `/signin?callbackUrl=${encodeURIComponent(switchAccountCallbackUrl ?? "/device")}`,
      );
    }
  }

  return (
    <AuthorizationRequestCard
      protocolBadge={copy.protocolBadge}
      clientLabel={resolvedClientLabel}
      title={copy.title}
      description={
        <>
          {resolvedClientLabel} {copy.subtitle}
        </>
      }
      footer={
        isResolvedRequest ? (
          <div className="flex w-full flex-col gap-3">
            {status === "denied" ? (
              <>
                <p className="text-sm text-foreground">{copy.denied}</p>
                <Button asChild className="w-full" variant="outline">
                  <Link href="/">{copy.backToDashboard}</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{copy.pending}</p>
                {hasPendingCodeChange ? (
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    {copy.pendingCodeChange}
                  </p>
                ) : null}
                {actionError ? (
                  <p className="text-sm text-destructive">{actionError}</p>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="flex-1"
                    disabled={isSubmitting || !canSubmitDecision}
                    type="button"
                    variant="primary"
                    onClick={() => handleDecision("approve")}
                  >
                    {isSubmitting ? copy.working : copy.approve}
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={isSubmitting || !canSubmitDecision}
                    type="button"
                    variant="outline"
                    onClick={() => handleDecision("deny")}
                  >
                    {copy.deny}
                  </Button>
                </div>
                {accountEmail ? (
                  <Button
                    className="w-full"
                    disabled={isSubmitting || isSwitchingAccount}
                    type="button"
                    variant="ghost"
                    onClick={handleSwitchAccount}
                  >
                    {isSwitchingAccount ? copy.switching : copy.switchAccount}
                  </Button>
                ) : null}
              </>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <form
          className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-4"
          onSubmit={handleLookupSubmit}
        >
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium" htmlFor="device-user-code">
              {copy.codeLabel}
            </label>
            {isResolvedRequest && !hasPendingCodeChange && !lookupError ? (
              <Badge variant="secondary">{copy.codeVerified}</Badge>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="device-user-code"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              disabled={isSubmitting || isCheckingCode}
              inputMode="text"
              maxLength={12}
              placeholder="ABCD1234"
              spellCheck={false}
              value={userCode}
              onChange={(event) => setUserCode(event.target.value)}
            />
            {shouldShowCodeLookupButton ? (
              <Button
                disabled={isCheckingCode || normalizedUserCode.length === 0}
                type="submit"
                variant="outline"
              >
                {isCheckingCode ? copy.reviewingCode : copy.reviewCode}
              </Button>
            ) : null}
          </div>
          {lookupError ? (
            <p className="text-sm text-destructive">{lookupError}</p>
          ) : hasPendingCodeChange ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {normalizedUserCode.length === 0
                ? copy.noRequestLoaded
                : copy.pendingCodeChange}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isResolvedRequest ? copy.codeLoadedHint : copy.codeHint}
            </p>
          )}
        </form>
        {accountEmail ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{copy.accountLabel}</p>
            <p className="text-sm text-foreground">
              {accountName?.trim() || accountEmail}
            </p>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {accountEmail}
            </p>
          </div>
        ) : null}
        {isResolvedRequest ? (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium">{copy.scopesLabel}</p>
              <div className="flex flex-wrap gap-2">
                {identityScopeItems.length === 0 ? (
                  <Badge variant="outline">{copy.defaultScope}</Badge>
                ) : (
                  identityScopeItems.map((scopeItem) => (
                    <Badge key={scopeItem.scope} variant="outline">
                      {scopeItem.label}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-medium">{copy.newPermissionsLabel}</p>
              <p className="text-sm text-muted-foreground">
                {copy.newPermissionsDescription}
              </p>
              <OidcPermissionSummary
                emptyLabel={copy.noNewPermissions}
                groups={newApiPermissionGroups}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {copy.existingPermissionsLabel}
              </p>
              <p className="text-sm text-muted-foreground">
                {copy.existingPermissionsDescription}
              </p>
              <OidcPermissionSummary
                emptyLabel={copy.noExistingPermissions}
                groups={existingApiPermissionGroups}
                surfaceClassName="rounded-lg border p-3"
              />
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
            {copy.noRequestLoaded}
          </div>
        )}
      </div>
    </AuthorizationRequestCard>
  );
}
