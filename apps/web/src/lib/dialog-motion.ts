import { cn } from "@/lib/utils";

export type DialogStepDirection = "forward" | "back";

/** Fade-in-up + stagger delay for nested blocks inside a dialog (e.g. form field groups). */
export function dialogStaggerClass(index: number): string {
  const clamped = Math.min(Math.max(index, 1), 8);
  return cn("animate-fade-in-up opacity-0", `animate-stagger-${clamped}`);
}

/** Step panel enter when switching wizard / setup steps. */
export function dialogStepTransitionClass(
  direction: DialogStepDirection = "forward",
): string {
  return direction === "back"
    ? "animate-dialog-step-in-back"
    : "animate-dialog-step-in-forward";
}

export const dialogHeaderEnterClass = "animate-dialog-header-in";
