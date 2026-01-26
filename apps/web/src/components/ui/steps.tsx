import { Check } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils/index";

interface StepsProps {
  currentStep: number;
  steps: Array<{ title: string; description?: string }>;
  className?: string;
}

export function Steps({ currentStep, steps, className }: StepsProps) {
  return (
    <div className={cn("w-full", className)}>
      <ol className="flex items-center w-full">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          const isUpcoming = stepNumber > currentStep;

          return (
            <li
              key={stepNumber}
              className={cn(
                "flex items-center",
                index < steps.length - 1 && "flex-1",
              )}
            >
              <div className="flex items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-semibold transition-colors",
                    isCompleted &&
                      "bg-primary text-primary-foreground border-primary",
                    isActive &&
                      "bg-primary text-primary-foreground border-primary",
                    isUpcoming &&
                      "bg-background text-muted-foreground border-muted",
                  )}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : stepNumber}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4 transition-colors",
                    isCompleted ? "bg-primary" : "bg-muted",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
