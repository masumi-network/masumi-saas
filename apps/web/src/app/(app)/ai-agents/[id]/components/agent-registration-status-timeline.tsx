"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFormatDate } from "@/hooks/use-format-date";
import {
  buildAgentActivityTimeline,
  type RegistrationTimelineStep,
} from "@/lib/agents/registration-status-timeline";
import { type Agent } from "@/lib/api/agent.client";
import { cn } from "@/lib/utils";

/** Matches masumi.network `register-mint-progress` connector layout. */
const CONNECTOR_GAP_CLASS = "h-2";
const CONNECTOR_RAIL_CLASS = "h-8";
/** Fixed track width — icon + rail share this column (centered). */
const STEP_TRACK_CLASS = "col-start-1 flex w-6 justify-center";

interface AgentRegistrationStatusTimelineProps {
  agent: Pick<
    Agent,
    "registrationState" | "createdAt" | "updatedAt" | "registrationInitiatedAt"
  >;
}

function stepVisualFlags(step: RegistrationTimelineStep) {
  return {
    isComplete: step.status === "complete",
    isActive: step.status === "current",
    isFailed: step.status === "failed",
    isUpcoming: step.status === "upcoming",
  };
}

function StepIndicator({
  index,
  isComplete,
  isActive,
  isFailed,
  isUpcoming,
  isLastStep,
}: {
  index: number;
  isComplete: boolean;
  isActive: boolean;
  isFailed: boolean;
  isUpcoming: boolean;
  isLastStep: boolean;
}) {
  const isFilledTerminal = isComplete && isLastStep;

  return (
    <span
      className={cn(
        "box-border flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold leading-none transition-colors",
        isComplete &&
          !isLastStep &&
          "border-primary bg-background text-primary",
        isFilledTerminal && "border-primary bg-primary text-primary-foreground",
        isActive &&
          "border-primary bg-background text-primary agent-status-progress-pulse",
        isFailed && "border-destructive bg-destructive/15 text-destructive",
        isUpcoming && "border-border bg-background text-muted-foreground",
      )}
    >
      {isComplete ? (
        <Check className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
      ) : (
        index + 1
      )}
    </span>
  );
}

function StepConnectorRail({
  isComplete,
  isActive,
}: {
  isComplete: boolean;
  isActive: boolean;
}) {
  return (
    <div className={cn(STEP_TRACK_CLASS, "flex-col items-center")} aria-hidden>
      <div className={CONNECTOR_GAP_CLASS} />
      <div
        className={cn(
          "agent-status-progress-rail w-px shrink-0",
          CONNECTOR_RAIL_CLASS,
          isComplete && "agent-status-progress-rail--done",
          isActive && "agent-status-progress-rail--active",
        )}
      />
      <div className={CONNECTOR_GAP_CLASS} />
    </div>
  );
}

export function AgentRegistrationStatusTimeline({
  agent,
}: AgentRegistrationStatusTimelineProps) {
  const t = useTranslations("App.Agents.Details.statusTimeline");
  const { formatDateTime, formatRelativeDate } = useFormatDate();
  const { steps } = buildAgentActivityTimeline({
    registrationState: agent.registrationState,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    registrationInitiatedAt: agent.registrationInitiatedAt,
  });

  return (
    <div
      className="w-full text-left"
      role="list"
      aria-label={t("changelogTimelineAria")}
    >
      <ol className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
        {steps.map((step, index) => {
          const { isComplete, isActive, isFailed, isUpcoming } =
            stepVisualFlags(step);
          const isLast = index === steps.length - 1;
          const label = t(`steps.${step.state}`);

          return (
            <li key={step.state} className="contents" role="listitem">
              <div className={cn(STEP_TRACK_CLASS, "self-center")}>
                <StepIndicator
                  index={index}
                  isComplete={isComplete}
                  isActive={isActive}
                  isFailed={isFailed}
                  isUpcoming={isUpcoming}
                  isLastStep={isLast}
                />
              </div>
              <div className="min-w-0 self-center py-0.5">
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium leading-6",
                    (isActive || isComplete) && "text-foreground",
                    isUpcoming && "text-muted-foreground",
                    isFailed && "text-destructive",
                  )}
                >
                  <span>
                    {label}
                    {isFailed ? (
                      <span className="font-normal text-muted-foreground">
                        {t("failedMarker")}
                      </span>
                    ) : null}
                  </span>
                </p>
                {step.occurredAt ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="mt-0.5 block w-fit max-w-full truncate text-left text-xs tabular-nums text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                      >
                        {formatRelativeDate(step.occurredAt)}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start">
                      {formatDateTime(step.occurredAt)}
                    </TooltipContent>
                  </Tooltip>
                ) : isActive ? (
                  <p className="text-xs text-muted-foreground">
                    {t("inProgress")}
                  </p>
                ) : null}
              </div>

              {!isLast ? (
                <>
                  <StepConnectorRail
                    isComplete={isComplete}
                    isActive={isActive}
                  />
                  <div aria-hidden />
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
