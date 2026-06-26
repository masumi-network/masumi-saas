"use client";

import type { ReactNode } from "react";

import {
  type DialogStepDirection,
  dialogStepTransitionClass,
} from "@/lib/dialog-motion";
import { cn } from "@/lib/utils";

export function DialogStepPanel({
  stepKey,
  direction = "forward",
  className,
  children,
}: {
  stepKey: string | number;
  direction?: DialogStepDirection;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      key={stepKey}
      className={cn(dialogStepTransitionClass(direction), className)}
    >
      {children}
    </div>
  );
}
