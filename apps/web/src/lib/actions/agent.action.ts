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
import { USDM } from "@/lib/payment-node/tokens";
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
      description,
      extendedDescription,
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
        error: "At least one tag is required.",
      };
    }

    type PriceEntry = { amount: string; currency: string };
    type ExampleOutput = { name: string; url: string; mimeType: string };

    let parsedPrices: PriceEntry[] = [];
    if (pricesJson) {
      try {
        parsedPrices = JSON.parse(pricesJson) as PriceEntry[];
      } catch {
        return {
          success: false as const,
          error: "Invalid pricing data. Please re-enter your prices.",
        };
      }
    }

    let parsedExampleOutputs: ExampleOutput[] = [];
    if (exampleOutputsJson) {
      try {
        parsedExampleOutputs = JSON.parse(
          exampleOutputsJson,
        ) as ExampleOutput[];
      } catch {
        return {
          success: false as const,
          error: "Invalid example outputs data. Please re-enter your examples.",
        };
      }
    }

    const userClient = await getPaymentNodeClientForUser(user.id);
    if (!userClient) {
      return {
        success: false as const,
        error: "Something went wrong. Please try again in a moment.",
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
        error: "Something went wrong. Please try again later.",
      };
    }

    const adminClient = createPaymentNodeClient(baseUrl, adminKey);
    const network = await getNetworkFromCookie();
    const token = USDM[network];

    const agentPricing: RegisterAgentInput["AgentPricing"] =
      pricingType === "Fixed" && parsedPrices.length > 0
        ? {
            pricingType: "Fixed",
            Pricing: parsedPrices.map((p) => ({
              unit: token.unit,
              amount: String(
                Math.round(Number(p.amount) * 10 ** token.decimals),
              ),
            })),
          }
        : { pricingType: "Free" };

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

    // TODO(mainnet): On mainnet, show the user the selling wallet address and
    // prompt them to fund it manually instead of using the dispenser.
    if (network === "Preprod") {
      fetch("https://dispenser.masumi.network/submit_transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network: "testnet",
          receiverAddress: sellingWallet.walletAddress,
          lovelaceAmount: 10_000_000, // 10 ADA
          assetAmount: 1_000_000, // 1 tUSDM (required — dispenser errors with assetAmount 0)
          testnet_collateral: false,
        }),
      }).catch((err) => {
        console.warn("[Dispenser] Failed to fund selling wallet:", err);
      });
    }

    const agent = await prisma.agent.create({
      data: {
        name,
        summary: description?.trim() || null,
        description: extendedDescription?.trim() || null,
        apiUrl,
        tags: tagsArray,
        icon: icon?.trim() || null,
        userId: user.id,
        organizationId: activeOrganizationId,
        registrationState: "RegistrationRequested",
        verificationStatus: "PENDING",
        pricing: agentPricing,
        networkIdentifier: network,
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
        ...(termsOfUseUrl?.trim() ||
        privacyPolicyUrl?.trim() ||
        otherUrl?.trim()
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
    } catch (paymentNodeError) {
      await prisma.agent.delete({ where: { id: agent.id } }).catch(() => null);
      throw paymentNodeError;
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
      where: { id: agentId, userId: user.id },
      include: { agentReference: true },
    });

    if (!agent) {
      return {
        success: false as const,
        error: "Agent not found",
      };
    }

    const liveStates: (typeof agent.registrationState)[] = [
      "RegistrationConfirmed",
      "RegistrationRequested",
      "RegistrationInitiated",
      "DeregistrationRequested",
      "DeregistrationInitiated",
      "DeregistrationFailed",
    ];
    if (liveStates.includes(agent.registrationState)) {
      return {
        success: false as const,
        error:
          "This agent is still active. Please deregister it before deleting.",
      };
    }

    if (!agent.agentReference?.externalId) {
      return {
        success: false as const,
        error: "No externalId found for this agent.",
      };
    }

    const baseUrl = paymentNodeConfig.getBaseUrl();
    const adminKey = paymentNodeConfig.getAdminApiKey();
    const adminClient = createPaymentNodeClient(baseUrl, adminKey);
    await adminClient.deleteRegistryEntry(agent.agentReference.externalId);

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
