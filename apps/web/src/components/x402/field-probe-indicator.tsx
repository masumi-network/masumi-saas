"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type FieldProbeStatus = "idle" | "checking" | "valid" | "invalid";

export function FieldProbeIndicator({
  status,
  checkingLabel,
  validLabel,
  invalidMessage,
}: {
  status: FieldProbeStatus;
  checkingLabel: string;
  validLabel: string;
  invalidMessage?: string;
}) {
  if (status === "idle") return null;

  const tooltipLabel =
    status === "checking"
      ? checkingLabel
      : status === "valid"
        ? validLabel
        : (invalidMessage ?? checkingLabel);

  const icon =
    status === "checking" ? (
      <Spinner
        key="field-probe-checking"
        size={16}
        className="text-muted-foreground"
      />
    ) : status === "valid" ? (
      <CheckCircle2
        key="field-probe-valid"
        className="h-4 w-4 animate-in fade-in zoom-in-90 fill-mode-both text-sky-500 duration-300"
        aria-hidden
      />
    ) : (
      <AlertTriangle
        key="field-probe-invalid"
        className="h-4 w-4 animate-rpc-probe-vibrate text-destructive"
        aria-hidden
      />
    );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="flex size-4 shrink-0 cursor-help items-center justify-center [&_svg]:block"
          aria-live="polite"
          aria-busy={status === "checking"}
        >
          {icon}
          <span className="sr-only">{tooltipLabel}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{tooltipLabel}</TooltipContent>
    </Tooltip>
  );
}
