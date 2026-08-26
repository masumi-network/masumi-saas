import type { createAdminPaymentNodeClient } from "@/lib/payment-node/get-admin-client";
import type { PaymentNodeNetwork } from "@/lib/payment-node/schemas";

export const REGISTRY_UPDATE_POLL_INTERVAL_MS = 3_000;
export const REGISTRY_UPDATE_POLL_TIMEOUT_MS = 120_000;
/** Bail out of polling after this many consecutive fetch failures. */
export const REGISTRY_UPDATE_POLL_MAX_CONSECUTIVE_ERRORS = 5;

const UPDATE_SUCCESS_STATES = new Set([
  "UpdateConfirmed",
  "RegistrationConfirmed",
]);
const UPDATE_FAILURE_STATES = new Set(["UpdateFailed"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type PollRegistryUpdateOptions = {
  /** When true, UpdateConfirmed with unchanged identifier succeeds without on-chain verifications. */
  allowSameIdentifierSuccess?: boolean;
};

export async function pollRegistryUpdate(
  adminClient: ReturnType<typeof createAdminPaymentNodeClient>,
  registryId: string,
  network: PaymentNodeNetwork,
  previousAgentIdentifier: string,
  smartContractAddress: string | undefined,
  options?: PollRegistryUpdateOptions,
): Promise<{ agentIdentifier: string } | { error: string }> {
  const deadline = Date.now() + REGISTRY_UPDATE_POLL_TIMEOUT_MS;
  let consecutiveErrors = 0;

  while (Date.now() < deadline) {
    let entry;
    try {
      entry = await adminClient.getRegistryById({
        id: registryId,
        network,
        filterSmartContractAddress: smartContractAddress,
      });
      consecutiveErrors = 0;
    } catch (error) {
      consecutiveErrors += 1;
      console.error("[Registry] Poll fetch failed (will retry):", {
        registryId,
        network,
        consecutiveErrors,
        error,
      });
      if (consecutiveErrors >= REGISTRY_UPDATE_POLL_MAX_CONSECUTIVE_ERRORS) {
        return {
          error: "Registry update polling failed repeatedly; aborting early",
        };
      }
      await sleep(REGISTRY_UPDATE_POLL_INTERVAL_MS);
      continue;
    }

    if (!entry) {
      return { error: "Registry entry not found while polling update" };
    }

    if (UPDATE_FAILURE_STATES.has(entry.state)) {
      return { error: "Registry update failed on the payment node" };
    }

    if (
      UPDATE_SUCCESS_STATES.has(entry.state) &&
      entry.agentIdentifier &&
      entry.agentIdentifier !== previousAgentIdentifier
    ) {
      return { agentIdentifier: entry.agentIdentifier };
    }

    if (
      entry.state === "UpdateConfirmed" &&
      entry.agentIdentifier &&
      entry.agentIdentifier === previousAgentIdentifier
    ) {
      if (options?.allowSameIdentifierSuccess) {
        return { agentIdentifier: entry.agentIdentifier };
      }

      try {
        const onChain = await adminClient.getRegistryByAgentIdentifier({
          agentIdentifier: entry.agentIdentifier,
          network,
        });
        const verifications = onChain?.Metadata?.verifications;
        if (verifications && verifications.length > 0) {
          return { agentIdentifier: entry.agentIdentifier };
        }
      } catch (error) {
        console.error(
          "[Registry] Poll on-chain metadata fetch failed (will retry):",
          { agentIdentifier: entry.agentIdentifier, network, error },
        );
      }
    }

    await sleep(REGISTRY_UPDATE_POLL_INTERVAL_MS);
  }

  return { error: "Timed out waiting for registry update confirmation" };
}
