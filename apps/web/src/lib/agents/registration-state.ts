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

export function isRegistrationSyncPending(state: string): boolean {
  return (REGISTRATION_SYNC_STATES as readonly string[]).includes(state);
}

export function isRegistrationUiPending(state: string): boolean {
  return (REGISTRATION_UI_PENDING_STATES as readonly string[]).includes(state);
}

export function isRegistrationConfirmedOnNetwork(state: string): boolean {
  return state === "RegistrationConfirmed";
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
