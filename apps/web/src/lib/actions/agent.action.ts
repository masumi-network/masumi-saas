"use server";

import prisma from "@masumi/database/client";
import { cookies } from "next/headers";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  createPaymentNodeClient,
  paymentNodeConfig,
  type PaymentNodeNetwork,
  type RegisterAgentInput,
} from "@/lib/payment-node";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import { registerAgentFormDataSchema } from "@/lib/schemas/agent";
import { convertZodError } from "@/lib/utils/convert-zod-error";

const DEFAULT_NETWORK: PaymentNodeNetwork = "Preprod";

async function getNetworkFromCookie(): Promise<PaymentNodeNetwork> {
  const store = await cookies();
  const value = store.get("payment_network")?.value;
  return value === "Mainnet" || value === "Preprod" ? value : DEFAULT_NETWORK;
}

export async function registerAgentAction(formData: FormData) {
  try {
    const { user, activeOrganizationId } = await getAuthenticatedOrThrow();

    const validation = registerAgentFormDataSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false as const,
        error: convertZodError(validation.error),
      };
    }

    const {
      name,
      summary,
      description,
      apiUrl,
      tags,
      icon,
      pricingType,
      prices: pricesJson,
      authorName,
      authorEmail,
      organization,
      contactOther,
      termsOfUseUrl,
      privacyPolicyUrl,
      otherUrl,
      capabilityName,
      capabilityVersion,
      exampleOutputs: exampleOutputsJson,
    } = validation.data;

    const tagsArray = tags
      ? tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : [];

    if (tagsArray.length === 0) {
      return {
        success: false as const,
        error: "At least one tag is required for payment node registration",
      };
    }

    // Parse JSON-encoded nested fields
    type PriceEntry = { amount: string; currency: string };
    type ExampleOutput = { name: string; url: string; mimeType: string };

    let parsedPrices: PriceEntry[] = [];
    if (pricesJson) {
      try {
        parsedPrices = JSON.parse(pricesJson) as PriceEntry[];
      } catch {
        // ignore malformed JSON — fall back to free
      }
    }

    let parsedExampleOutputs: ExampleOutput[] = [];
    if (exampleOutputsJson) {
      try {
        parsedExampleOutputs = JSON.parse(
          exampleOutputsJson,
        ) as ExampleOutput[];
      } catch {
        // ignore
      }
    }

    const agentPricing: RegisterAgentInput["AgentPricing"] =
      pricingType === "Fixed" && parsedPrices.length > 0
        ? {
            pricingType: "Fixed",
            Pricing: parsedPrices.map((p) => ({
              unit: p.currency ?? "USD",
              amount: p.amount,
            })),
          }
        : { pricingType: "Free" };

    const userClient = await getPaymentNodeClientForUser(user.id);
    if (!userClient) {
      return {
        success: false as const,
        error: "Payment setup is not ready. Please try again in a moment.",
      };
    }

    let baseUrl: string;
    let adminKey: string;
    let paymentSourceId: string;
    try {
      baseUrl = paymentNodeConfig.getBaseUrl();
      adminKey = paymentNodeConfig.getAdminApiKey();
      paymentSourceId = paymentNodeConfig.getPaymentSourceId();
    } catch (e) {
      console.error("Payment node config missing:", e);
      return {
        success: false as const,
        error: "Payment node is not configured. Please try again later.",
      };
    }

    const adminClient = createPaymentNodeClient(baseUrl, adminKey);
    const network = await getNetworkFromCookie();

    const [sellingWallet, buyingWallet] = await Promise.all([
      adminClient.generateWallet(network),
      adminClient.generateWallet(network),
    ]);

    await adminClient.addWalletsToPaymentSource({
      paymentSourceId,
      AddSellingWallets: [
        {
          walletMnemonic: sellingWallet.walletMnemonic,
          note: `Agent: ${name} (selling)`,
          collectionAddress: null,
        },
      ],
      AddPurchasingWallets: [
        {
          walletMnemonic: buyingWallet.walletMnemonic,
          note: `Agent: ${name} (buying)`,
          collectionAddress: null,
        },
      ],
    });

    const agent = await prisma.agent.create({
      data: {
        name,
        summary: summary?.trim() || null,
        description: description?.trim() || null,
        apiUrl,
        tags: tagsArray,
        icon: icon?.trim() || null,
        userId: user.id,
        organizationId: activeOrganizationId,
        registrationState: "RegistrationRequested",
        verificationStatus: "PENDING",
      },
    });

    await prisma.agentReference.create({
      data: {
        agentId: agent.id,
        sellingWalletVkey: sellingWallet.walletVkey,
        buyingWalletVkey: buyingWallet.walletVkey,
        networkIdentifier: network,
        status: "PENDING",
      },
    });

    let registryEntry;
    try {
      registryEntry = await userClient.registerAgent({
        network,
        sellingWalletVkey: sellingWallet.walletVkey,
        name,
        apiBaseUrl: apiUrl,
        description: description?.trim() ?? "",
        Tags: tagsArray,
        ExampleOutputs: parsedExampleOutputs,
        Capability: {
          name: capabilityName?.trim() || "Masumi",
          version: capabilityVersion?.trim() || "1.0",
        },
        Author: {
          name: authorName?.trim() || user.name || "Unknown",
          contactEmail: authorEmail?.trim() || user.email || undefined,
          contactOther: contactOther?.trim() || undefined,
          organization: organization?.trim() || undefined,
        },
        ...(termsOfUseUrl?.trim() || privacyPolicyUrl?.trim() || otherUrl?.trim()
          ? {
              Legal: {
                terms: termsOfUseUrl?.trim() || undefined,
                privacyPolicy: privacyPolicyUrl?.trim() || undefined,
                other: otherUrl?.trim() || undefined,
              },
            }
          : {}),
        AgentPricing: agentPricing,
      });
    } catch (registrationError) {
      await prisma.agent.delete({ where: { id: agent.id } }).catch(() => {});
      throw registrationError;
    }

    await prisma.agentReference.update({
      where: { agentId: agent.id },
      data: {
        externalId: registryEntry.id,
        ...(registryEntry.agentIdentifier && {
          metadata: { agentIdentifier: registryEntry.agentIdentifier },
        }),
      },
    });

    if (registryEntry.agentIdentifier) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: { agentIdentifier: registryEntry.agentIdentifier },
      });
    }

    const updatedAgent = await prisma.agent.findUniqueOrThrow({
      where: { id: agent.id },
    });

    return {
      success: true as const,
      data: updatedAgent,
    };
  } catch (error) {
    console.error("Failed to register agent:", error);
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : "Failed to register agent",
    };
  }
}

export async function getAgentsAction(filters?: {
  verificationStatus?: "PENDING" | "VERIFIED" | "REVOKED" | "EXPIRED" | null;
  unverified?: boolean;
}) {
  try {
    const { user } = await getAuthenticatedOrThrow();

    const where: {
      userId: string;
      verificationStatus?:
        | { not: "VERIFIED" }
        | "PENDING"
        | "VERIFIED"
        | "REVOKED"
        | "EXPIRED"
        | null;
    } = {
      userId: user.id,
    };

    if (filters?.unverified) {
      where.verificationStatus = { not: "VERIFIED" };
    } else if (filters?.verificationStatus !== undefined) {
      where.verificationStatus = filters.verificationStatus;
    }

    const agents = await prisma.agent.findMany({
      where,
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

/** Sync this agent's registration status from the payment node (polling). */
export async function syncAgentRegistrationStatusAction(agentId: string) {
  try {
    const { user } = await getAuthenticatedOrThrow();
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
    return { success: true as const };
  } catch (error) {
    console.error("Failed to sync agent registration status:", error);
    return { success: false as const, error: "Failed to sync status" };
  }
}

/** Deregister agent on the payment node and update local status. */
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
      return { success: false as const, error: "Payment setup is not ready." };
    }

    const network = (agent.agentReference?.networkIdentifier ??
      (await getNetworkFromCookie())) as PaymentNodeNetwork;
    await userClient.deregisterAgent({ network, agentIdentifier });

    await prisma.agentReference.updateMany({
      where: { agentId },
      data: { status: "DEREGISTERED" },
    });
    await prisma.agent.update({
      where: { id: agentId },
      data: { registrationState: "DeregistrationRequested" },
    });

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

    await prisma.agent.delete({
      where: {
        id: agentId,
      },
    });

    return {
      success: true as const,
    };
  } catch (error) {
    console.error("Failed to delete agent:", error);
    return {
      success: false as const,
      error: "Failed to delete agent",
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
