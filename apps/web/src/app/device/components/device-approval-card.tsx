"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DeviceApprovalCardProps = {
  userCode: string;
  accountEmail: string;
  accountName: string | null;
  switchAccountCallbackUrl: string;
  clientLabel: string;
  identityScopeItems: Array<{
    scope: string;
    label: string;
    description: string;
    type: "standard" | "api" | "unknown";
  }>;
  newApiScopeItems: Array<{
    scope: string;
    label: string;
    description: string;
    type: "standard" | "api" | "unknown";
  }>;
  existingApiScopeItems: Array<{
    scope: string;
    label: string;
    description: string;
    type: "standard" | "api" | "unknown";
  }>;
};

type ApprovalState = "idle" | "approved" | "denied";

const copy = {
  protocolBadge: "OIDC",
  title: "Device Authorization",
  subtitle:
    "wants to use your Masumi account through the device authorization flow.",
  codeLabel: "Code:",
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
  approved: "Device approved. You can return to your CLI.",
  denied: "Device request denied.",
  pending: "A CLI is requesting access to your Masumi account.",
  backToDashboard: "Back to dashboard",
  approve: "Approve",
  working: "Working...",
  deny: "Deny",
  switchAccount: "Switch account",
  switching: "Switching...",
  successRedirect: "/device/success",
};

export function DeviceApprovalCard({
  userCode,
  accountEmail,
  accountName,
  switchAccountCallbackUrl,
  clientLabel,
  identityScopeItems,
  newApiScopeItems,
  existingApiScopeItems,
}: DeviceApprovalCardProps) {
  const [status, setStatus] = useState<ApprovalState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);

  async function handleDecision(action: "approve" | "deny") {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/auth/device/${action}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userCode }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error_description?: string;
        } | null;
        setError(body?.error_description || "Request failed.");
        return;
      }

      if (action === "approve") {
        window.location.assign(copy.successRedirect);
        return;
      }

      setStatus("denied");
    } catch {
      setError("Failed to submit your decision. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSwitchAccount() {
    setError(null);
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
        `/signin?callbackUrl=${encodeURIComponent(switchAccountCallbackUrl)}`,
      );
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{copy.protocolBadge}</Badge>
            <Badge variant="outline">{clientLabel}</Badge>
          </div>
          <CardTitle className="text-3xl font-light tracking-tight">
            {copy.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {clientLabel} {copy.subtitle}
          </p>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {copy.codeLabel}{" "}
              <span className="font-mono text-foreground">{userCode}</span>
            </p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {copy.accountLabel}
            </p>
            <p className="text-sm text-foreground">
              {accountName?.trim() || accountEmail}
            </p>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {accountEmail}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
            {newApiScopeItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {copy.noNewPermissions}
              </p>
            ) : (
              <div className="space-y-2">
                {newApiScopeItems.map((scopeItem) => (
                  <div
                    key={scopeItem.scope}
                    className="rounded-lg border bg-background p-3"
                  >
                    <div className="text-sm font-medium">{scopeItem.label}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {scopeItem.scope}
                    </div>
                    {scopeItem.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {scopeItem.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {copy.existingPermissionsLabel}
            </p>
            <p className="text-sm text-muted-foreground">
              {copy.existingPermissionsDescription}
            </p>
            {existingApiScopeItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {copy.noExistingPermissions}
              </p>
            ) : (
              <div className="space-y-2">
                {existingApiScopeItems.map((scopeItem) => (
                  <div key={scopeItem.scope} className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{scopeItem.label}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {scopeItem.scope}
                    </div>
                    {scopeItem.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {scopeItem.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          {status === "approved" ? (
            <>
              <p className="text-sm text-foreground">{copy.approved}</p>
              <Button asChild className="w-full" variant="primary">
                <Link href="/">{copy.backToDashboard}</Link>
              </Button>
            </>
          ) : status === "denied" ? (
            <>
              <p className="text-sm text-foreground">{copy.denied}</p>
              <Button asChild className="w-full" variant="outline">
                <Link href="/">{copy.backToDashboard}</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{copy.pending}</p>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="flex-1"
                  disabled={isSubmitting}
                  type="button"
                  variant="primary"
                  onClick={() => handleDecision("approve")}
                >
                  {isSubmitting ? copy.working : copy.approve}
                </Button>
                <Button
                  className="flex-1"
                  disabled={isSubmitting}
                  type="button"
                  variant="outline"
                  onClick={() => handleDecision("deny")}
                >
                  {copy.deny}
                </Button>
              </div>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
