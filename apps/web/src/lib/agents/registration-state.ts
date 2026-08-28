import type { RegistrationState } from "@masumi/database/client";

import type { RegistryRequestState } from "@/lib/payment-node/schemas";

/** Registry rows awaiting a metadata update (e.g. verification anchors). */
export const REGISTRY_UPDATE_PENDING_STATES = [
  "UpdateRequested",
  "UpdateInitiated",
] as const satisfies readonly RegistrationState[];

/** States polled from payment-node until they reach a terminal value. */
export const REGISTRATION_SYNC_STATES = [
  "RegistrationRequested",
  "RegistrationInitiated",
  "DeregistrationRequested",
  "DeregistrationInitiated",
  ...REGISTRY_UPDATE_PENDING_STATES,
  /**
   * Reconcile against payment-node when SaaS still says registered but the
   * registry row moved into an update lifecycle (e.g. verification anchors).
   */
  "RegistrationConfirmed",
] as const satisfies readonly RegistrationState[];

/** UI pending badge / spinner — registration or registry update in flight. */
export const REGISTRATION_UI_PENDING_STATES = [
  "RegistrationRequested",
  "RegistrationInitiated",
  "UpdateRequested",
  "UpdateInitiated",
  "DeregistrationRequested",
  "DeregistrationInitiated",
] as const satisfies readonly RegistrationState[];

/**
 * Map payment-node registry `state` onto SaaS `RegistrationState`.
 * UpdateConfirmed is terminal on-chain but the agent remains registered.
 */
export function registrationStateFromRegistryEntry(
  state: RegistryRequestState,
): RegistrationState {
  if (state === "UpdateConfirmed") {
    return "RegistrationConfirmed";
  }
  return state as RegistrationState;
}

/**
 * Map payment-node registry state onto SaaS without clobbering an optimistic
 * update lifecycle while the node row still reports RegistrationConfirmed.
 */
export function resolveRegistrationStateAfterSync(params: {
  previousState: RegistrationState;
  registryState: RegistryRequestState;
  updatedAt?: Date;
  now?: number;
}): RegistrationState {
  const mappedState = registrationStateFromRegistryEntry(params.registryState);

  if (
    (REGISTRY_UPDATE_PENDING_STATES as readonly string[]).includes(
      params.previousState,
    ) &&
    params.registryState === "RegistrationConfirmed"
  ) {
    return params.previousState;
  }

  if (
    params.updatedAt &&
    isAbandonedRegistryUpdate({
      registrationState: params.previousState,
      updatedAt: params.updatedAt,
      now: params.now,
    }) &&
    (params.registryState === "UpdateRequested" ||
      params.registryState === "UpdateInitiated")
  ) {
    return "RegistrationConfirmed";
  }

  return mappedState;
}

export function isRegistrationSyncPending(state: string): boolean {
  return (REGISTRATION_SYNC_STATES as readonly string[]).includes(state);
}

export function isRegistrationUiPending(state: string): boolean {
  return (REGISTRATION_UI_PENDING_STATES as readonly string[]).includes(state);
}

export function isRegistrationConfirmedOnNetwork(state: string): boolean {
  return state === "RegistrationConfirmed";
}

export function isRegistryVerificationUpdatePending(state: string): boolean {
  return (REGISTRY_UPDATE_PENDING_STATES as readonly string[]).includes(state);
}

/**
 * How long an agent may sit in `UpdateRequested` before the lock is treated as
 * stale. The registry-update path flips an agent to `UpdateRequested`
 * immediately before the on-chain `updateAgent` call; if the process is killed
 * in that window (e.g. a serverless freeze) the agent would otherwise stay
 * pinned there forever — every recovery path skips `UpdateRequested`, so the
 * anchor is never written and the completion email never sends. A stale lock is
 * safe to re-attempt: the real on-chain update completes well within this
 * window, and the retry re-claims the lock atomically.
 */
export const STALE_UPDATE_REQUESTED_MS = 15 * 60 * 1000;

/**
 * After the edit poll window (120s) plus a short buffer, an in-flight update lock
 * is treated as abandoned: on-chain metadata did not change and SaaS should not
 * keep showing "updating".
 */
export const REGISTRY_UPDATE_ABANDONED_MS = 150_000;

/** True when a registry update lock outlived the edit poll window. */
export function isAbandonedRegistryUpdate(params: {
  registrationState: string;
  updatedAt: Date;
  now?: number;
}): boolean {
  if (
    !(REGISTRY_UPDATE_PENDING_STATES as readonly string[]).includes(
      params.registrationState,
    )
  ) {
    return false;
  }
  const now = params.now ?? Date.now();
  return now - params.updatedAt.getTime() >= REGISTRY_UPDATE_ABANDONED_MS;
}

/** True when an `UpdateRequested` lock is old enough to treat as abandoned. */
export function isUpdateRequestedStale(params: {
  registrationState: string;
  updatedAt: Date;
  now?: number;
}): boolean {
  if (params.registrationState !== "UpdateRequested") {
    return false;
  }
  const now = params.now ?? Date.now();
  return now - params.updatedAt.getTime() >= STALE_UPDATE_REQUESTED_MS;
}

/** Agent is on-chain registered enough to start the verification credential flow. */
export const AGENT_VERIFICATION_ELIGIBLE_STATES = [
  "RegistrationConfirmed",
  "UpdateFailed",
] as const satisfies readonly RegistrationState[];

export function canRequestAgentVerification(state: string): boolean {
  return (AGENT_VERIFICATION_ELIGIBLE_STATES as readonly string[]).includes(
    state,
  );
}

/** Agent has a live registry entry (includes verification anchor updates). */
export const AGENT_LIVE_ON_REGISTRY_STATES = [
  "RegistrationConfirmed",
  "UpdateRequested",
  "UpdateInitiated",
  "UpdateFailed",
] as const satisfies readonly RegistrationState[];

export function isAgentLiveOnRegistry(state: string): boolean {
  return (AGENT_LIVE_ON_REGISTRY_STATES as readonly string[]).includes(state);
}

/** States where deregister is allowed (settled registration only). */
export const AGENT_DEREGISTER_ELIGIBLE_STATES = [
  "RegistrationConfirmed",
  "DeregistrationFailed",
] as const satisfies readonly RegistrationState[];

export function canDeregisterAgent(state: string): boolean {
  return (AGENT_DEREGISTER_ELIGIBLE_STATES as readonly string[]).includes(
    state,
  );
}

/** States where the owner may edit registered agent details on-chain. */
export const AGENT_EDIT_DETAILS_ELIGIBLE_STATES = [
  "RegistrationConfirmed",
  "UpdateFailed",
] as const satisfies readonly RegistrationState[];

export function canEditAgentDetails(params: {
  registrationState: string;
  agentIdentifier: string | null;
  updatedAt?: Date;
  now?: number;
}): boolean {
  if (!params.agentIdentifier) {
    return false;
  }

  if (
    (AGENT_EDIT_DETAILS_ELIGIBLE_STATES as readonly string[]).includes(
      params.registrationState,
    )
  ) {
    return true;
  }

  if (
    params.registrationState === "UpdateRequested" &&
    params.updatedAt &&
    isUpdateRequestedStale({
      registrationState: params.registrationState,
      updatedAt: params.updatedAt,
      now: params.now,
    })
  ) {
    return true;
  }

  return false;
}
