"use server";

import prisma from "@masumi/database/client";
import { cookies } from "next/headers";

import { recordAgentActivityEvent } from "@/lib/activity-event";
import { completeOnChainRegistration } from "@/lib/agent-registration";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  createPaymentNodeClient,
  paymentNodeConfig,
  type PaymentNodeNetwork,
} from "@/lib/payment-node";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";

const DEFAULT_NETWORK: PaymentNodeNetwork = "Preprod";

async function getNetworkFromCookie(): Promise<PaymentNodeNetwork> {
  const store = await cookies();
  const value = store.get("payment_network")?.value;
  return value === "Mainnet" || value === "Preprod" ? value : DEFAULT_NETWORK;
}

/** Called by the client when POST /api/agents returned WALLET_FUNDING_PENDING.
 *  Poll until status is "registered" or the user gives up. */
export async function completeRegistrationIfReadyAction(
  agentId: string,
): Promise<
  | {
      status: "registered";
      data: Awaited<ReturnType<typeof prisma.agent.findUnique>>;
    }
  | { status: "pending" }
  | { status: "error"; error: string }
> {
  try {
    const { user } = await getAuthenticatedOrThrow();
    const result = await completeOnChainRegistration(agentId, user.id);
    if (result.status === "registered") {
      return { status: "registered", data: result.data };
    }
    if (result.status === "pending") {
      return { status: "pending" };
    }
    return { status: "error", error: result.error };
  } catch (error) {
    console.error("completeRegistrationIfReadyAction:", error);
    return {
      status: "error",
      error:
        error instanceof Error
          ? error.message
          : "Failed to complete registration",
    };
  }
}

export async function getAgentsAction(filters?: {
  verificationStatus?: "PENDING" | "VERIFIED" | "REVOKED" | "EXPIRED" | null;
  unverified?: boolean;
}) {
  try {
    const { user } = await getAuthenticatedOrThrow(undefined, {
      requireEmailVerified: false,
    });
    const network = await getNetworkFromCookie();

    const verificationFilter = filters?.unverified
      ? { verificationStatus: { not: "VERIFIED" as const } }
      : filters?.verificationStatus !== undefined
        ? { verificationStatus: filters.verificationStatus ?? undefined }
        : {};

    const agents = await prisma.agent.findMany({
      where: {
        userId: user.id,
        ...verificationFilter,
        OR: [{ networkIdentifier: network }, { networkIdentifier: null }],
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true as const,
      data: agents,
    };
  } catch (error) {
    console.error("Failed to get agents:", error);
    return {
      success: false as const,
      error: "Failed to get agents",
    };
  }
}

export async function syncAgentRegistrationStatusAction(agentId: string) {
  try {
    const { user } = await getAuthenticatedOrThrow(undefined, {
      requireEmailVerified: false,
    });
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId: user.id },
      include: { agentReference: true },
    });
    if (!agent || !agent.agentReference?.externalId)
      return { success: true as const };

    const userClient = await getPaymentNodeClientForUser(user.id);
    if (!userClient) return { success: true as const };

    const network = (agent.agentReference.networkIdentifier ??
      DEFAULT_NETWORK) as PaymentNodeNetwork;
    const entry = await userClient.getRegistryById({
      id: agent.agentReference.externalId,
      network,
    });
    if (!entry) return { success: true as const };

    const registrationState =
      entry.state as keyof typeof import("@masumi/database/client").RegistrationState;
    const status =
      entry.state === "RegistrationConfirmed"
        ? "ACTIVE"
        : entry.state === "DeregistrationConfirmed"
          ? "DEREGISTERED"
          : agent.agentReference.status;

    const existingMeta =
      (agent.agentReference.metadata as Record<string, unknown> | null) ?? {};
    const metadata = entry.agentIdentifier
      ? { ...existingMeta, agentIdentifier: entry.agentIdentifier }
      : existingMeta;

    const previousState = agent.registrationState;
    await prisma.$transaction([
      prisma.agent.update({
        where: { id: agentId },
        data: {
          registrationState,
          ...(entry.agentIdentifier && {
            agentIdentifier: entry.agentIdentifier,
          }),
        },
      }),
      prisma.agentReference.update({
        where: { agentId },
        data: {
          status,
          metadata,
          ...(entry.state === "RegistrationConfirmed" && {
            registeredAt: new Date(),
          }),
        },
      }),
    ]);
    if (registrationState !== previousState) {
      if (registrationState === "RegistrationConfirmed") {
        await recordAgentActivityEvent(agentId, "RegistrationConfirmed");
      } else if (registrationState === "RegistrationFailed") {
        await recordAgentActivityEvent(agentId, "RegistrationFailed");
      } else if (registrationState === "DeregistrationConfirmed") {
        await recordAgentActivityEvent(agentId, "DeregistrationConfirmed");
      }
    }
    return { success: true as const };
  } catch (error) {
    console.error("Failed to sync agent registration status:", error);
    return { success: false as const, error: "Failed to sync status" };
  }
}

export async function deregisterAgentAction(agentId: string) {
  try {
    const { user } = await getAuthenticatedOrThrow();
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId: user.id },
      include: { agentReference: true },
    });
    if (!agent) {
      return { success: false as const, error: "Agent not found" };
    }
    const agentIdentifier =
      agent.agentIdentifier ??
      (agent.agentReference?.metadata as { agentIdentifier?: string } | null)
        ?.agentIdentifier;
    if (!agentIdentifier) {
      return {
        success: false as const,
        error: "Agent is not registered on the network",
      };
    }

    const userClient = await getPaymentNodeClientForUser(user.id);
    if (!userClient) {
      return {
        success: false as const,
        error: "Something went wrong. Please try again.",
      };
    }

    const network = (agent.agentReference?.networkIdentifier ??
      (await getNetworkFromCookie())) as PaymentNodeNetwork;
    await userClient.deregisterAgent({ network, agentIdentifier });

    await prisma.agent.update({
      where: { id: agentId },
      data: { registrationState: "DeregistrationRequested" },
    });

    await recordAgentActivityEvent(agentId, "DeregistrationRequested");

    return { success: true as const };
  } catch (error) {
    console.error("Failed to deregister agent:", error);
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : "Failed to deregister agent",
    };
  }
}

export async function getAgentAction(agentId: string) {
  try {
    const { user } = await getAuthenticatedOrThrow(undefined, {
      requireEmailVerified: false,
    });

    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId: user.id,
      },
    });

    if (!agent) {
      return {
        success: false as const,
        error: "Agent not found",
      };
    }

    return {
      success: true as const,
      data: agent,
    };
  } catch (error) {
    console.error("Failed to get agent:", error);
    return {
      success: false as const,
      error: "Failed to get agent",
    };
  }
}

export async function deleteAgentAction(agentId: string) {
  try {
    const { user } = await getAuthenticatedOrThrow();

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId: user.id },
      include: { agentReference: true },
    });

    if (!agent) {
      return {
        success: false as const,
        error: "Agent not found",
      };
    }

    const hasExternalRegistration = Boolean(agent.agentReference?.externalId);

    if (!hasExternalRegistration) {
      // Legacy agent (created via old POST /api/agents): no payment-node entry;
      // allow direct delete so the user can remove it.
      await recordAgentActivityEvent(agentId, "AgentDeleted");
      await prisma.agent.delete({
        where: { id: agentId },
      });
      return {
        success: true as const,
      };
    }

    const liveStates: (typeof agent.registrationState)[] = [
      "RegistrationConfirmed",
      "RegistrationRequested",
      "RegistrationInitiated",
      "DeregistrationRequested",
      "DeregistrationInitiated",
    ];
    const isLegacyConfirmed =
      agent.registrationState === "RegistrationConfirmed" &&
      !agent.agentIdentifier;
    if (liveStates.includes(agent.registrationState) && !isLegacyConfirmed) {
      return {
        success: false as const,
        error:
          "This agent is still active. Please deregister it before deleting.",
      };
    }

    const externalId = agent.agentReference!.externalId;
    if (!externalId) {
      return {
        success: false as const,
        error: "No externalId found for this agent.",
      };
    }
    const baseUrl = paymentNodeConfig.getBaseUrl();
    const adminKey = paymentNodeConfig.getAdminApiKey();
    const adminClient = createPaymentNodeClient(baseUrl, adminKey);
    await adminClient.deleteRegistryEntry(externalId);

    await recordAgentActivityEvent(agentId, "AgentDeleted");
    await prisma.agent.delete({
      where: { id: agentId },
    });

    return {
      success: true as const,
    };
  } catch (error) {
    console.error("Failed to delete agent:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to delete agent",
    };
  }
}

export async function requestAgentVerificationAction(agentId: string) {
  try {
    const { user } = await getAuthenticatedOrThrow();

    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId: user.id,
      },
    });

    if (!agent) {
      return {
        success: false as const,
        error: "Agent not found",
      };
    }

    const userWithKyc = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        kycVerification: true,
      },
    });

    if (!userWithKyc?.kycVerification) {
      return {
        success: false as const,
        error:
          "KYC verification not found. Please complete KYC verification first.",
      };
    }

    if (userWithKyc.kycVerification.status !== "APPROVED") {
      return {
        success: false as const,
        error: `KYC verification is ${userWithKyc.kycVerification.status}. Please complete KYC verification first.`,
      };
    }

    const updatedAgent = await prisma.agent.update({
      where: {
        id: agentId,
      },
      data: {
        verificationStatus: "REVIEW",
        // veridianCredentialId: credentialId, // Uncomment when API is integrated
      },
    });

    return {
      success: true as const,
      data: updatedAgent,
    };
  } catch (error) {
    console.error("Failed to request agent verification:", error);
    return {
      success: false as const,
      error: "Failed to request agent verification",
    };
  }
}
