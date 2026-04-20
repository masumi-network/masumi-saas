"use client";

import {
  AlertCircle,
  CheckCircle2,
  Fingerprint,
  Lock,
  Terminal,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AuthorizationRequestCard } from "@/components/oidc/authorization-request-card";
import { OidcPermissionSummary } from "@/components/oidc/oidc-permission-summary";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { OidcGroupedApiPermissionCatalogGroup } from "@/lib/config/oidc-scopes.config";

import { EmailVerificationPanel } from "../../oidc/consent/components/email-verification-panel";

type DeviceApprovalCardProps = {
  initialUserCode?: string | null;
  lookupError?: string | null;
  accountEmail?: string | null;
  accountName?: string | null;
  emailVerified?: boolean;
  switchAccountCallbackUrl?: string | null;
  verificationContinueUrl?: string | null;
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
  titlePrefix: "Authorize",
  descriptionPrefix: "Review the requested access before authorizing",
  codeLabel: "Device code",
  codeHint: "Dashes are optional. The code is not case sensitive.",
  codeLoadedHint: "Code verified. Edit to review a different device request.",
  pendingCodeChange:
    "Review the updated code before approving. The permissions below belong to the previously loaded request.",
  reviewCode: "Verify code",
  reviewingCode: "Loading...",
  codeVerified: "Verified",
  accountLabel: "Authorizing as",
  scopesLabel: "Identity scopes",
  newPermissionsLabel: "New API permissions",
  existingPermissionsLabel: "Granted API permissions",
  defaultScope: "openid",
  denied: "Device request denied.",
  pendingSuffix: "is requesting access to your Masumi account.",
  noRequestLoaded:
    "Enter the device code shown in your terminal to review the request before you authorize it.",
  verifyRequired: "Verify your email before authorizing this device login.",
  backToDashboard: "Back to dashboard",
  approve: "Authorize",
  working: "Working...",
  deny: "Deny",
  switchAccount: "Switch account",
  switching: "Switching...",
  successRedirect: "/device/success",
};

function getDeviceClientLabel(clientLabel: string | null | undefined): string {
  const trimmedClientLabel = clientLabel?.trim();

  if (
    !trimmedClientLabel ||
    trimmedClientLabel.toLowerCase() === "agent messenger cli"
  ) {
    return "Masumi Agent Messenger CLI";
  }

  if (trimmedClientLabel.toLowerCase() === "agent messenger") {
    return "Masumi Agent Messenger";
  }

  return trimmedClientLabel;
}

function getInitial(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const source = name?.trim() || email || "?";
  return source.charAt(0).toUpperCase();
}

export function DeviceApprovalCard({
  initialUserCode,
  lookupError,
  accountEmail,
  accountName,
  emailVerified,
  switchAccountCallbackUrl,
  verificationContinueUrl,
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
  const requiresEmailVerification =
    Boolean(accountEmail) && emailVerified === false;
  const canSubmitDecision =
    isResolvedRequest &&
    normalizedUserCode.length > 0 &&
    normalizedUserCode === resolvedUserCode;
  const canApprove = canSubmitDecision && !requiresEmailVerification;
  const resolvedClientLabel = getDeviceClientLabel(clientLabel);
  const pendingMessage = `${resolvedClientLabel} ${copy.pendingSuffix}`;

  useEffect(() => {
    setUserCode(initialUserCode ?? "");
    setStatus("idle");
    setActionError(null);
    setIsSubmitting(false);
    setIsCheckingCode(false);
  }, [initialUserCode, lookupError, isResolvedRequest]);

  function resolveActionError(errorDescription: string | undefined): string {
    if (errorDescription === "email_verification_required") {
      return copy.verifyRequired;
    }

    return errorDescription || "Request failed.";
  }

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
        setActionError(resolveActionError(body?.error_description));
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
      icon={<Terminal className="h-6 w-6 text-primary" />}
      title={`${copy.titlePrefix} ${resolvedClientLabel}`}
      description={`${copy.descriptionPrefix} ${resolvedClientLabel}.`}
      footer={
        isResolvedRequest ? (
          <div className="flex w-full flex-col gap-3">
            {status === "denied" ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <XCircle className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-foreground">{copy.denied}</p>
                <Button asChild className="w-full" variant="outline">
                  <Link href="/">{copy.backToDashboard}</Link>
                </Button>
              </div>
            ) : (
              <>
                <p className="text-center text-sm text-muted-foreground">
                  {pendingMessage}
                </p>
                {hasPendingCodeChange ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{copy.pendingCodeChange}</span>
                  </div>
                ) : null}
                {requiresEmailVerification ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{copy.verifyRequired}</span>
                  </div>
                ) : null}
                {actionError ? (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{actionError}</span>
                  </div>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row">
                  {requiresEmailVerification ? null : (
                    <Button
                      className="flex-1"
                      disabled={isSubmitting || !canApprove}
                      type="button"
                      variant="primary"
                      onClick={() => handleDecision("approve")}
                    >
                      {isSubmitting ? copy.working : copy.approve}
                    </Button>
                  )}
                  <Button
                    className="flex-1"
                    disabled={isSubmitting || !canSubmitDecision}
                    type="button"
                    variant="ghost"
                    onClick={() => handleDecision("deny")}
                  >
                    {copy.deny}
                  </Button>
                </div>
                {accountEmail ? (
                  <>
                    <Separator />
                    <Button
                      className="w-full"
                      disabled={isSubmitting || isSwitchingAccount}
                      type="button"
                      variant="ghost"
                      onClick={handleSwitchAccount}
                    >
                      {isSwitchingAccount ? copy.switching : copy.switchAccount}
                    </Button>
                  </>
                ) : null}
              </>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <form
          className="animate-fade-in-up animate-stagger-1 space-y-2"
          onSubmit={handleLookupSubmit}
        >
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium" htmlFor="device-user-code">
              {copy.codeLabel}
            </label>
            {isResolvedRequest && !hasPendingCodeChange && !lookupError ? (
              <Badge variant="secondary" className="animate-fade-in-up">
                {copy.codeVerified}
              </Badge>
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
              className="font-mono tracking-wider"
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
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{lookupError}</span>
            </div>
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
          <div className="animate-fade-in-up animate-stagger-2 flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs font-medium">
                {getInitial(accountName, accountEmail)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {accountName?.trim() || accountEmail}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {accountEmail}
              </p>
            </div>
          </div>
        ) : null}

        {requiresEmailVerification && accountEmail ? (
          <EmailVerificationPanel
            email={accountEmail}
            continueUrl={verificationContinueUrl ?? undefined}
          />
        ) : null}

        {isResolvedRequest ? (
          <>
            <div className="animate-fade-in-up animate-stagger-3 space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Fingerprint className="h-4 w-4 text-muted-foreground" />
                {copy.scopesLabel}
              </p>
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

            {newApiPermissionGroups.length > 0 ? (
              <div className="animate-fade-in-up animate-stagger-4 space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Lock className="h-4 w-4 text-primary" />
                  {copy.newPermissionsLabel}
                </p>
                <OidcPermissionSummary
                  emptyLabel=""
                  groups={newApiPermissionGroups}
                />
              </div>
            ) : null}

            {existingApiPermissionGroups.length > 0 ? (
              <div className="animate-fade-in-up animate-stagger-5 space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  {copy.existingPermissionsLabel}
                </p>
                <OidcPermissionSummary
                  emptyLabel=""
                  groups={existingApiPermissionGroups}
                  surfaceClassName="rounded-lg border p-3"
                />
              </div>
            ) : null}
          </>
        ) : (
          <div className="animate-fade-in-up animate-stagger-2 flex flex-col items-center gap-4 rounded-lg border border-dashed border-muted-foreground/20 px-6 py-10 text-center">
            <div className="rounded-full bg-muted/50 p-3">
              <Terminal className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="max-w-[260px] text-sm text-muted-foreground">
              {copy.noRequestLoaded}
            </p>
          </div>
        )}
      </div>
    </AuthorizationRequestCard>
  );
}
