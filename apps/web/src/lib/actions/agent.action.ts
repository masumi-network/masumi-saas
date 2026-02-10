"use server";

import prisma from "@masumi/database/client";

import { getAuthenticatedHeaders } from "@/lib/auth/utils";
import { registerAgentFormDataSchema } from "@/lib/schemas/agent";
import { convertZodError } from "@/lib/utils/convert-zod-error";

export async function registerAgentAction(formData: FormData) {
  try {
    const { user } = await getAuthenticatedHeaders();

    const validation = registerAgentFormDataSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false as const,
        error: convertZodError(validation.error),
      };
    }

    const { name, description, apiUrl, tags } = validation.data;

    const tagsArray = tags
      ? tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : [];

    const agent = await prisma.agent.create({
      data: {
        name,
        description,
        apiUrl,
        tags: tagsArray,
        userId: user.id,
        verificationStatus: "PENDING",
      },
    });

    return {
      success: true as const,
      data: agent,
    };
  } catch (error) {
    console.error("Failed to register agent:", error);
    return {
      success: false as const,
      error: "Failed to register agent",
    };
  }
}

export async function getAgentsAction(filters?: {
  verificationStatus?: "APPROVED" | "PENDING" | "REJECTED" | "REVIEW" | null;
  unverified?: boolean;
}) {
  try {
    const { user } = await getAuthenticatedHeaders();

    const where: {
      userId: string;
      verificationStatus?:
        | {
            not?: "APPROVED";
            equals?: "APPROVED" | "PENDING" | "REJECTED" | "REVIEW" | null;
          }
        | "APPROVED"
        | "PENDING"
        | "REJECTED"
        | "REVIEW"
        | null;
    } = {
      userId: user.id,
    };

    if (filters?.unverified) {
      where.verificationStatus = {
        not: "APPROVED",
      };
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

export async function getAgentAction(agentId: string) {
  try {
    const { user } = await getAuthenticatedHeaders();

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
    const { user } = await getAuthenticatedHeaders();

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
    const { user } = await getAuthenticatedHeaders();

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
