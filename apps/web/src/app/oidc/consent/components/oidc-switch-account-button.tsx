"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { signOut } from "@/lib/auth/auth.client";
import { buildSwitchAccountSignInHref } from "@/lib/auth/switch-account";

interface OidcSwitchAccountButtonProps {
  callbackUrl?: string;
  label: string;
}

const SWITCH_ACCOUNT_ERROR = "Failed to switch account. Please try again.";

export function OidcSwitchAccountButton({
  callbackUrl,
  label,
}: OidcSwitchAccountButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const signInHref = buildSwitchAccountSignInHref(callbackUrl);

  async function handleClick() {
    setIsLoading(true);

    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.assign(signInHref);
          },
          onError: () => {
            toast.error(SWITCH_ACCOUNT_ERROR);
          },
        },
      });
    } catch (error) {
      console.error("[oidc switch account] failed", {
        callbackUrl,
        error,
      });
      toast.error(SWITCH_ACCOUNT_ERROR);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full"
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? <Spinner size={16} className="mr-2" /> : null}
      {label}
    </Button>
  );
}
