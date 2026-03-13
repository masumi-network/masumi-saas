"use client";

import { Check } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";

export type RegistrationProgressStep = 1 | 2 | 3;

interface RegistrationProgressOverlayProps {
  /** Current step: 1 = creating & wallets, 2 = funding wallet, 3 = registering on network */
  currentStep: RegistrationProgressStep;
  /** Step labels (e.g. from useTranslations) */
  steps: [string, string, string];
  className?: string;
}

export function RegistrationProgressOverlay({
  currentStep,
  steps,
  className,
}: RegistrationProgressOverlayProps) {
  const stepList = steps.map((title, index) => ({
    step: (index + 1) as RegistrationProgressStep,
    title,
  }));

  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex flex-col items-center justify-center gap-8 rounded-lg bg-background/95 backdrop-blur-sm p-6",
        className,
      )}
      aria-live="polite"
      aria-busy="true"
    >
      <ol className="flex w-full max-w-sm flex-col gap-6">
        {stepList.map(({ step, title }) => {
          const isActive = step === currentStep;
          const isCompleted = step < currentStep;
          const isUpcoming = step > currentStep;

          return (
            <li
              key={step}
              className={cn(
                "flex items-center gap-4 transition-opacity",
                isUpcoming && "opacity-50",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                  isCompleted &&
                    "border-primary bg-primary text-primary-foreground",
                  isActive &&
                    "border-primary bg-primary text-primary-foreground",
                  isUpcoming &&
                    "border-muted bg-background text-muted-foreground",
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : isActive ? (
                  <Spinner size={20} className="text-primary-foreground" />
                ) : (
                  step
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  isActive && "text-foreground",
                  isCompleted && "text-muted-foreground",
                  isUpcoming && "text-muted-foreground",
                )}
              >
                {title}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
