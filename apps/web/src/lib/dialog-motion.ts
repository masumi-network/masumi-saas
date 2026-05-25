import { cn } from "@/lib/utils";

/** Fade-in-up + stagger delay for nested blocks inside a dialog (e.g. form field groups). */
export function dialogStaggerClass(index: number): string {
  const clamped = Math.min(Math.max(index, 1), 8);
  return cn("animate-fade-in-up opacity-0", `animate-stagger-${clamped}`);
}
