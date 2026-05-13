"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { switchAccountAction } from "@/lib/actions/auth.action";

interface OidcSwitchAccountButtonProps {
  callbackUrl?: string;
  label: string;
}

export function OidcSwitchAccountButton({
  callbackUrl,
  label,
}: OidcSwitchAccountButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(() => switchAccountAction(formData));
      }}
    >
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <Button
        type="submit"
        variant="ghost"
        className="w-full"
        disabled={isPending}
      >
        {isPending ? <Spinner size={16} className="mr-2" /> : null}
        {label}
      </Button>
    </form>
  );
}
