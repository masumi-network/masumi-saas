"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DeviceApprovalCardProps = {
  userCode: string;
};

type ApprovalState = "idle" | "approved" | "denied";

const copy = {
  title: "Device Authorization",
  codeLabel: "Code:",
  approved: "Device approved. You can return to your CLI.",
  denied: "Device request denied.",
  pending: "A CLI is requesting access to your Masumi account.",
  backToDashboard: "Back to dashboard",
  approve: "Approve",
  working: "Working...",
  deny: "Deny",
};

export function DeviceApprovalCard({ userCode }: DeviceApprovalCardProps) {
  const [status, setStatus] = useState<ApprovalState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      setStatus(action === "approve" ? "approved" : "denied");
    } catch {
      setError("Failed to submit your decision. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-3">
          <CardTitle className="text-3xl font-light tracking-tight">
            {copy.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {copy.codeLabel}{" "}
            <span className="font-mono text-foreground">{userCode}</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
