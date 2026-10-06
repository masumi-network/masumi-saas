import type { RegistrationState } from "@masumi/database/client";

export type RegistrationTimelinePhase =
  | "registration"
  | "update"
  | "deregistration";

export type RegistrationTimelineStepStatus =
  | "complete"
  | "current"
  | "upcoming"
  | "failed";

export interface RegistrationTimelineStep {
  /** RegistrationState value used for i18n keys under statusTimeline.steps */
  state: RegistrationState | "UpdateConfirmed";
  status: RegistrationTimelineStepStatus;
  /** ISO timestamp when known; omitted for middle steps without stored history */
  occurredAt: string | null;
}

const REGISTRATION_FLOW = [
  "RegistrationRequested",
  "RegistrationConfirmed",
] as const satisfies readonly RegistrationState[];

const UPDATE_FLOW = [
  "UpdateRequested",
  "UpdateConfirmed",
] as const satisfies readonly (RegistrationState | "UpdateConfirmed")[];

const DEREGISTRATION_FLOW = [
  "DeregistrationRequested",
  "DeregistrationConfirmed",
] as const satisfies readonly RegistrationState[];

/** DB states with no dedicated timeline row — shown as in progress on the confirm step. */
const AWAITING_CONFIRMATION_STATES = new Set<string>([
  "RegistrationInitiated",
  "UpdateInitiated",
  "DeregistrationInitiated",
]);

type FlowState =
  | (typeof REGISTRATION_FLOW)[number]
  | (typeof UPDATE_FLOW)[number]
  | (typeof DEREGISTRATION_FLOW)[number];

const FAILED_AT: Partial<
  Record<RegistrationState, { phase: RegistrationTimelinePhase; at: FlowState }>
> = {
  RegistrationFailed: { phase: "registration", at: "RegistrationRequested" },
  UpdateFailed: { phase: "update", at: "UpdateRequested" },
  DeregistrationFailed: {
    phase: "deregistration",
    at: "DeregistrationRequested",
  },
};

function resolveTimelinePhase(
  registrationState: string,
): RegistrationTimelinePhase {
  if (
    registrationState.startsWith("Deregistration") ||
    registrationState === "DeregistrationFailed"
  ) {
    return "deregistration";
  }
  if (
    registrationState.startsWith("Update") ||
    registrationState === "UpdateFailed"
  ) {
    return "update";
  }
  return "registration";
}

function flowForPhase(phase: RegistrationTimelinePhase): readonly FlowState[] {
  switch (phase) {
    case "update":
      return UPDATE_FLOW;
    case "deregistration":
      return DEREGISTRATION_FLOW;
    default:
      return REGISTRATION_FLOW;
  }
}

function activeIndexInFlow(
  registrationState: string,
  flow: readonly FlowState[],
): number {
  const direct = flow.indexOf(registrationState as FlowState);
  if (direct >= 0) {
    return direct;
  }
  if (registrationState === "RegistrationConfirmed") {
    const confirmedIndex = flow.indexOf("RegistrationConfirmed");
    if (confirmedIndex >= 0) {
      return confirmedIndex;
    }
    return flow.length - 1;
  }
  if (registrationState === "UpdateConfirmed") {
    return flow.indexOf("UpdateConfirmed");
  }
  if (AWAITING_CONFIRMATION_STATES.has(registrationState)) {
    return flow.length - 1;
  }
  const failure = FAILED_AT[registrationState as RegistrationState];
  if (failure) {
    return flow.indexOf(failure.at);
  }
  return 0;
}

function stepStatus(
  index: number,
  activeIndex: number,
  isFailedPhase: boolean,
  failIndex: number,
  flowLength: number,
  registrationState: string,
): RegistrationTimelineStepStatus {
  if (isFailedPhase && index === failIndex) {
    return "failed";
  }
  if (isFailedPhase && index > failIndex) {
    return "upcoming";
  }
  if (index < activeIndex) {
    return "complete";
  }
  if (index > activeIndex) {
    return "upcoming";
  }
  if (AWAITING_CONFIRMATION_STATES.has(registrationState)) {
    return "current";
  }
  if (activeIndex === flowLength - 1) {
    return "complete";
  }
  return "current";
}

function occurredAtForStep(
  index: number,
  status: RegistrationTimelineStepStatus,
  flowLength: number,
  createdAt: string,
  updatedAt: string,
  stepState: FlowState,
  registrationInitiatedAt: string | null | undefined,
): string | null {
  if (status === "upcoming") {
    return null;
  }
  if (status === "current" || status === "failed") {
    if (stepState === "RegistrationConfirmed" && registrationInitiatedAt) {
      return registrationInitiatedAt;
    }
    return updatedAt;
  }
  if (index === 0 && status === "complete") {
    return createdAt;
  }
  if (index === flowLength - 1 && status === "complete") {
    return updatedAt;
  }
  return null;
}

export function buildRegistrationStatusTimeline(params: {
  registrationState: string;
  createdAt: string;
  updatedAt: string;
  registrationInitiatedAt?: string | null;
}): {
  phase: RegistrationTimelinePhase;
  steps: RegistrationTimelineStep[];
} {
  const failure = FAILED_AT[params.registrationState as RegistrationState];
  const phase =
    failure?.phase ?? resolveTimelinePhase(params.registrationState);
  const flow = flowForPhase(phase);
  const activeIndex = activeIndexInFlow(params.registrationState, flow);
  const failIndex = failure ? flow.indexOf(failure.at) : -1;
  const isFailedPhase = Boolean(failure);

  const steps: RegistrationTimelineStep[] = flow.map((state, index) => {
    const status = stepStatus(
      index,
      activeIndex,
      isFailedPhase,
      failIndex,
      flow.length,
      params.registrationState,
    );
    return {
      state,
      status,
      occurredAt: occurredAtForStep(
        index,
        status,
        flow.length,
        params.createdAt,
        params.updatedAt,
        state,
        params.registrationInitiatedAt,
      ),
    };
  });

  return { phase, steps };
}

function isRegistrationPhaseState(state: string): boolean {
  return state.startsWith("Registration");
}

function isUpdatePhaseState(state: string): boolean {
  return state.startsWith("Update");
}

function isDeregistrationPhaseState(state: string): boolean {
  return state.startsWith("Deregistration");
}

function registrationSectionState(actual: string): string {
  if (isRegistrationPhaseState(actual)) {
    return actual;
  }
  return "RegistrationConfirmed";
}

/** Registration changelog plus follow-on update/deregistration steps (single Activity list). */
export function buildAgentActivityTimeline(
  params: Parameters<typeof buildRegistrationStatusTimeline>[0],
): { steps: RegistrationTimelineStep[] } {
  const steps: RegistrationTimelineStep[] = [
    ...buildRegistrationStatusTimeline({
      ...params,
      registrationState: registrationSectionState(params.registrationState),
    }).steps,
  ];

  if (isUpdatePhaseState(params.registrationState)) {
    steps.push(...buildRegistrationStatusTimeline(params).steps);
  } else if (isDeregistrationPhaseState(params.registrationState)) {
    steps.push(...buildRegistrationStatusTimeline(params).steps);
  }

  return { steps };
}
