import { randomUUID } from "node:crypto";

import prisma from "@masumi/database/client";
import {
  buildEvmExactFixedPaymentSource,
  DEFAULT_EVM_REGISTRY_EXTRA,
  type SupportedPaymentSource,
} from "@masumi/payment-source-x402/payment-source";

import {
  buildAgentPricing,
  completeOnChainRegistration,
  startAgentRegistration,
  validateAgentRegistrationPaymentSourcesPreflight,
} from "@/lib/agent-registration";
import { isKycVerificationEnabled } from "@/lib/config/verification.config";
import { consumeCreditIfRequired } from "@/lib/credits/service";
import { getKycStatusForUser } from "@/lib/network-registration/kyc-status";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { validatePayoutAddressForNetwork } from "@/lib/payment-node/payout-address";
import { assertAllowedAgentApiUrl } from "@/lib/security/outbound-url";
import { z } from "@/lib/zod-openapi";

const DRAFT_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const COMPLETE_POLL_ATTEMPTS = 4;
const COMPLETE_POLL_DELAY_MS = 4_000;

type DraftStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED";

const USDC_BY_NETWORK: Record<string, string> = {
  "eip155:1": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "eip155:84532": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

export const networkRegisterBodySchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  termsAccepted: z.literal(true),
  agent: z.object({
    name: z.string().min(1).max(250),
    description: z.string().max(250).optional().or(z.literal("")),
    apiUrl: z.string().url(),
    tags: z.string().min(1),
  }),
  payment: z.object({
    network: z
      .string()
      .regex(/^eip155:\d+$/)
      .default("eip155:8453"),
    asset: z.string().min(1),
    amount: z.string().min(1),
    decimals: z.coerce.number().int().min(0).max(255).default(6),
    payTo: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "payTo must be an EVM address"),
    resource: z.string().url().max(500).optional().or(z.literal("")),
  }),
  mint: z.object({
    kyc: z.enum(["skip", "kyc"]),
    destination: z.enum(["managed", "browser", "paper", "existing"]),
    /** Cardano receive address for paper/existing (and optional payout). */
    cardanoAddress: z.string().max(250).optional().or(z.literal("")),
  }),
  cardanoNetwork: z.enum(["Preprod", "Mainnet"]).default("Preprod"),
});

export type NetworkRegisterBody = z.infer<typeof networkRegisterBodySchema>;

export type NetworkRegistrationPayload = {
  agent: NetworkRegisterBody["agent"];
  payment: NetworkRegisterBody["payment"];
  mint: NetworkRegisterBody["mint"];
  cardanoNetwork: PaymentNodeNetwork;
  effectiveDestination: "managed" | "browser" | "paper" | "existing";
  notes: string[];
};

function resolveAssetAddress(network: string, asset: string): string {
  const trimmed = asset.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return trimmed;
  if (trimmed.toUpperCase() === "USDC") {
    const known = USDC_BY_NETWORK[network];
    if (known) return known;
  }
  throw new Error(
    `Unknown asset "${asset}" for ${network}. Pass a 0x token address or USDC.`,
  );
}

function toSmallestUnits(amount: string, decimals: number): string {
  const normalized = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Payment amount must be a positive decimal number");
  }
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) {
    throw new Error(`Amount has more than ${decimals} decimal places`);
  }
  const padded = fraction.padEnd(decimals, "0");
  const combined = `${whole}${padded}`.replace(/^0+(?=\d)/, "");
  return combined === "" ? "0" : combined;
}

export function buildNetworkRegistrationPayload(
  body: NetworkRegisterBody,
): NetworkRegistrationPayload {
  const notes: string[] = [];
  const destination = body.mint.destination;

  if (body.mint.kyc === "kyc" && !isKycVerificationEnabled()) {
    throw new Error(
      "KYC is not enabled on this environment. Choose mint without KYC.",
    );
  }

  if (destination === "managed") {
    if (body.mint.kyc === "kyc") {
      notes.push(
        "After KYC, your agent NFT is minted into a Masumi-managed wallet.",
      );
    } else {
      notes.push("Your agent NFT is minted into a Masumi-managed wallet.");
    }
    return {
      agent: body.agent,
      payment: body.payment,
      mint: body.mint,
      cardanoNetwork: body.cardanoNetwork,
      effectiveDestination: "managed",
      notes,
    };
  }

  if (destination === "browser") {
    if (body.mint.kyc === "kyc") {
      throw new Error(
        "Browser wallet mint is only available without KYC. Use managed or paper/existing after KYC.",
      );
    }
    if (!body.mint.cardanoAddress?.trim()) {
      throw new Error(
        "Connect a Cardano browser wallet before submitting (address required).",
      );
    }
    notes.push(
      "Your connected Cardano address was recorded. The registry NFT is minted into a Masumi-managed wallet for now (payment node requires managed recipients); external NFT delivery comes next.",
    );
    return {
      agent: body.agent,
      payment: body.payment,
      mint: body.mint,
      cardanoNetwork: body.cardanoNetwork,
      effectiveDestination: "browser",
      notes,
    };
  }

  // paper | existing
  if (body.mint.kyc !== "kyc") {
    throw new Error("Paper / existing-address mint requires KYC.");
  }
  if (!body.mint.cardanoAddress?.trim()) {
    throw new Error("Cardano address is required for paper / existing mint.");
  }
  notes.push(
    "After KYC, your Cardano address is recorded. The registry NFT is minted into a Masumi-managed wallet for now (payment node requires managed recipients); external NFT delivery comes next.",
  );
  return {
    agent: body.agent,
    payment: body.payment,
    mint: body.mint,
    cardanoNetwork: body.cardanoNetwork,
    effectiveDestination: destination,
    notes,
  };
}

export async function createNetworkRegistrationDraft(params: {
  body: NetworkRegisterBody;
  headers: Headers;
}): Promise<
  | {
      ok: true;
      draftId: string;
      email: string;
      notes: string[];
      devCode?: string;
    }
  | { ok: false; error: string; status: 400 | 429 | 500 }
> {
  let payload: NetworkRegistrationPayload;
  try {
    payload = buildNetworkRegistrationPayload(params.body);
    await assertAllowedAgentApiUrl(params.body.agent.apiUrl);
  } catch (error) {
    return {
      ok: false,
      status: 400,
      error: error instanceof Error ? error.message : "Invalid registration",
    };
  }

  const draftId = randomUUID();
  const expiresAt = new Date(Date.now() + DRAFT_TTL_MS);

  await prisma.networkRegistrationDraft.create({
    data: {
      id: draftId,
      email: params.body.email.trim().toLowerCase(),
      name: params.body.name.trim(),
      payload,
      expiresAt,
    },
  });

  const { sendNetworkRegistrationOtp } =
    await import("@/lib/network-registration/otp");
  const otp = await sendNetworkRegistrationOtp({
    email: params.body.email,
    name: params.body.name,
  });

  if (!otp.ok) {
    await prisma.networkRegistrationDraft.update({
      where: { id: draftId },
      data: { status: "FAILED", error: otp.error },
    });
    return { ok: false, status: otp.status, error: otp.error };
  }

  return {
    ok: true,
    draftId,
    email: otp.email,
    notes: payload.notes,
    ...(otp.devCode ? { devCode: otp.devCode } : {}),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fulfillNetworkRegistrationDraft(params: {
  draftId: string;
  user: { id: string; name: string | null; email: string | null };
  activeOrganizationId: string | null;
}): Promise<
  | {
      ok: true;
      agentId: string;
      status: "registered" | "pending";
      notes: string[];
      networkSiteSuccessUrl: string;
    }
  | {
      ok: false;
      error: string;
      needsKyc?: boolean;
      status: DraftStatus;
    }
> {
  const draft = await prisma.networkRegistrationDraft.findUnique({
    where: { id: params.draftId },
  });
  if (!draft) {
    return {
      ok: false,
      error: "Registration draft not found",
      status: "FAILED",
    };
  }

  const sessionEmail = params.user.email?.trim().toLowerCase();
  if (!sessionEmail || sessionEmail !== draft.email) {
    return {
      ok: false,
      error: "Signed-in email does not match this registration",
      status: draft.status,
    };
  }

  const payload = draft.payload as NetworkRegistrationPayload;

  // Resume/complete paths must work after the draft TTL: an agent may already
  // exist (on-chain pending) or the draft may already be COMPLETED.
  if (draft.status === "COMPLETED" && draft.agentId) {
    return {
      ok: true,
      agentId: draft.agentId,
      status: "registered",
      notes: payload.notes ?? [],
      networkSiteSuccessUrl: buildNetworkSiteSuccessUrl(draft.agentId),
    };
  }

  if (draft.agentId) {
    const complete = await pollComplete(draft.agentId, params.user.id);
    if (complete.ok) {
      await prisma.networkRegistrationDraft.update({
        where: { id: draft.id },
        data: {
          status: complete.status === "registered" ? "COMPLETED" : "PROCESSING",
          agentId: draft.agentId,
          userId: params.user.id,
          error: null,
        },
      });
      return {
        ok: true,
        agentId: draft.agentId,
        status: complete.status,
        notes: payload.notes,
        networkSiteSuccessUrl: buildNetworkSiteSuccessUrl(draft.agentId),
      };
    }
    await prisma.networkRegistrationDraft.update({
      where: { id: draft.id },
      data: { status: "FAILED", error: complete.error, userId: params.user.id },
    });
    return { ok: false, error: complete.error, status: "FAILED" };
  }

  if (draft.expiresAt.getTime() < Date.now()) {
    await prisma.networkRegistrationDraft.update({
      where: { id: draft.id },
      data: { status: "EXPIRED" },
    });
    return {
      ok: false,
      error: "Registration draft expired",
      status: "EXPIRED",
    };
  }

  if (payload.mint.kyc === "kyc") {
    const kyc = await getKycStatusForUser(params.user.id);
    if (kyc === "DISABLED") {
      return {
        ok: false,
        error: "KYC is not enabled on this environment",
        status: "FAILED",
      };
    }
    if (kyc !== "APPROVED") {
      // Keep the draft alive while the user finishes identity verification.
      await prisma.networkRegistrationDraft.update({
        where: { id: draft.id },
        data: {
          userId: params.user.id,
          expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
        },
      });
      return {
        ok: false,
        error: "Complete KYC verification to continue this registration",
        needsKyc: true,
        status: draft.status,
      };
    }
  }

  // Claim the draft before wallet/credit work so concurrent OTP verifies cannot
  // both call startAgentRegistration. Claim token in `error` lets an in-flight
  // run detect if the lock was overwritten before minting.
  const claimToken = randomUUID();
  const claimMarker = `claim:${claimToken}`;
  const claimed = await prisma.networkRegistrationDraft.updateMany({
    where: {
      id: draft.id,
      agentId: null,
      status: { in: ["PENDING", "FAILED"] },
    },
    data: {
      status: "PROCESSING",
      userId: params.user.id,
      error: claimMarker,
    },
  });
  if (claimed.count === 0) {
    const fresh = await prisma.networkRegistrationDraft.findUnique({
      where: { id: draft.id },
    });
    if (fresh?.agentId) {
      const complete = await pollComplete(fresh.agentId, params.user.id);
      if (complete.ok) {
        await prisma.networkRegistrationDraft.update({
          where: { id: draft.id },
          data: {
            status:
              complete.status === "registered" ? "COMPLETED" : "PROCESSING",
            userId: params.user.id,
            error: null,
          },
        });
        return {
          ok: true,
          agentId: fresh.agentId,
          status: complete.status,
          notes: payload.notes,
          networkSiteSuccessUrl: buildNetworkSiteSuccessUrl(fresh.agentId),
        };
      }
      return { ok: false, error: complete.error, status: "FAILED" };
    }
    return {
      ok: false,
      error: "Registration is already in progress. Please try again shortly.",
      status: "PROCESSING",
    };
  }

  const assertClaimHeld = async () => {
    const held = await prisma.networkRegistrationDraft.findFirst({
      where: {
        id: draft.id,
        agentId: null,
        status: "PROCESSING",
        error: claimMarker,
      },
      select: { id: true },
    });
    if (!held) {
      throw new Error("Registration claim was lost. Please try again shortly.");
    }
  };

  try {
    const network = payload.cardanoNetwork;
    const asset = resolveAssetAddress(
      payload.payment.network,
      payload.payment.asset,
    );
    const amount = toSmallestUnits(
      payload.payment.amount,
      payload.payment.decimals,
    );

    const supportedPaymentSources: SupportedPaymentSource[] = [
      buildEvmExactFixedPaymentSource({
        network: payload.payment.network,
        asset,
        amount,
        decimals: payload.payment.decimals,
        payTo: payload.payment.payTo,
        ...(payload.payment.resource
          ? { resource: payload.payment.resource }
          : {}),
        extra: { ...DEFAULT_EVM_REGISTRY_EXTRA },
      }),
    ];

    const agentPricing = buildAgentPricing(network, {
      pricingType: "Fixed",
      prices: [{ amount: payload.payment.amount, currency: "USD" }],
    });

    const preflight = await validateAgentRegistrationPaymentSourcesPreflight(
      network,
      supportedPaymentSources,
      agentPricing,
    );
    if (!preflight.ok) {
      throw new Error(preflight.error);
    }

    let payoutAddress = "";
    let registryNftRecipientAddress: string | undefined;

    if (payload.effectiveDestination !== "managed") {
      const dest = payload.mint.cardanoAddress?.trim() ?? "";
      const destError = validatePayoutAddressForNetwork(dest, network);
      if (destError) throw new Error(destError);
      registryNftRecipientAddress = dest;
      payoutAddress = dest;
    }

    const tags = payload.agent.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // Resume before debiting credits so a prior partial success can finish.
    const existingAgent = await prisma.agent.findUnique({
      where: { id: draft.id },
      select: { id: true },
    });
    if (existingAgent) {
      await prisma.networkRegistrationDraft.update({
        where: { id: draft.id },
        data: { agentId: existingAgent.id, userId: params.user.id },
      });
      await ensureNetworkRegistrationCreditDebited({
        userId: params.user.id,
        draftId: draft.id,
        network,
        agentName: payload.agent.name,
        destination: payload.effectiveDestination,
        agentId: existingAgent.id,
      });
      const complete = await pollComplete(existingAgent.id, params.user.id);
      if (!complete.ok) {
        await prisma.networkRegistrationDraft.update({
          where: { id: draft.id },
          data: { status: "FAILED", error: complete.error },
        });
        return { ok: false, error: complete.error, status: "FAILED" };
      }
      await prisma.networkRegistrationDraft.update({
        where: { id: draft.id },
        data: {
          status: complete.status === "registered" ? "COMPLETED" : "PROCESSING",
          agentId: existingAgent.id,
        },
      });
      return {
        ok: true,
        agentId: existingAgent.id,
        status: complete.status,
        notes: payload.notes,
        networkSiteSuccessUrl: buildNetworkSiteSuccessUrl(existingAgent.id),
      };
    }

    // Idempotent Mainnet debit before wallet/agent setup so unpaid agents cannot
    // be completed via the complete-registration endpoint alone.
    await assertClaimHeld();
    await ensureNetworkRegistrationCreditDebited({
      userId: params.user.id,
      draftId: draft.id,
      network,
      agentName: payload.agent.name,
      destination: payload.effectiveDestination,
    });

    await assertClaimHeld();

    const started = await startAgentRegistration(
      {
        user: params.user,
        activeOrganizationId: params.activeOrganizationId,
        network,
      },
      {
        id: draft.id,
        name: payload.agent.name,
        description: payload.agent.description?.trim() || null,
        apiUrl: payload.agent.apiUrl,
        tags,
        icon: null,
        agentPricing,
        exampleOutputs: [],
        capabilityName: tags[0] || "Masumi",
        capabilityVersion: "1.0",
        supportedPaymentSources,
        payoutAddress,
        registryNftRecipientAddress,
      },
    );

    if (!started.success) {
      throw new Error(started.error);
    }

    const complete = await pollComplete(started.agentId, params.user.id);

    await prisma.networkRegistrationDraft.update({
      where: { id: draft.id },
      data: {
        agentId: started.agentId,
        status:
          complete.ok && complete.status === "registered"
            ? "COMPLETED"
            : complete.ok
              ? "PROCESSING"
              : "FAILED",
        error: complete.ok ? null : complete.error,
        userId: params.user.id,
      },
    });

    if (!complete.ok) {
      return { ok: false, error: complete.error, status: "FAILED" };
    }

    return {
      ok: true,
      agentId: started.agentId,
      status: complete.status,
      notes: payload.notes,
      networkSiteSuccessUrl: buildNetworkSiteSuccessUrl(started.agentId),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registration failed";
    await prisma.networkRegistrationDraft.update({
      where: { id: draft.id },
      data: { status: "FAILED", error: message, userId: params.user.id },
    });
    return { ok: false, error: message, status: "FAILED" };
  }
}

async function ensureNetworkRegistrationCreditDebited(params: {
  userId: string;
  draftId: string;
  network: PaymentNodeNetwork;
  agentName: string;
  destination: string;
  agentId?: string;
}): Promise<void> {
  const reference = `network-register:${params.draftId}`;
  const existing = await prisma.creditLedgerEntry.findUnique({
    where: {
      userId_reason_reference: {
        userId: params.userId,
        reason: "agent_register",
        reference,
      },
    },
    select: { id: true },
  });
  if (existing) return;

  await consumeCreditIfRequired({
    userId: params.userId,
    reason: "agent_register",
    reference,
    network: params.network,
    metadata: {
      source: "network-site",
      draftId: params.draftId,
      name: params.agentName,
      destination: params.destination,
      ...(params.agentId ? { agentId: params.agentId } : {}),
    },
  });
}

async function pollComplete(
  agentId: string,
  userId: string,
): Promise<
  { ok: true; status: "registered" | "pending" } | { ok: false; error: string }
> {
  let last: Awaited<ReturnType<typeof completeOnChainRegistration>> | null =
    null;
  for (let i = 0; i < COMPLETE_POLL_ATTEMPTS; i += 1) {
    last = await completeOnChainRegistration(agentId, userId);
    if (last.status === "registered") {
      return { ok: true, status: "registered" };
    }
    if (last.status === "error") {
      return { ok: false, error: last.error };
    }
    await sleep(COMPLETE_POLL_DELAY_MS);
  }
  if (last?.status === "pending") {
    return { ok: true, status: "pending" };
  }
  return { ok: false, error: "Registration timed out" };
}

export function buildNetworkSiteSuccessUrl(agentId: string): string {
  const base =
    process.env.NETWORK_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_NETWORK_SITE_URL?.trim() ||
    "http://localhost:3010";
  const url = new URL("/register/success", base);
  url.searchParams.set("agentId", agentId);
  return url.toString();
}

export function buildNetworkKycReturnUrl(draftId: string): string {
  const app =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:2999";
  return new URL(
    `/network-register/continue?draftId=${encodeURIComponent(draftId)}`,
    app,
  ).toString();
}

export async function completeNetworkRegistrationWithOtp(params: {
  draftId: string;
  email: string;
  otp: string;
  headers: Headers;
}): Promise<
  | {
      ok: true;
      agentId: string;
      status: "registered" | "pending";
      notes: string[];
      successPath: string;
    }
  | {
      ok: false;
      error: string;
      needsKyc?: boolean;
      kycContinueUrl?: string;
      status?: 400 | 401 | 403;
    }
> {
  const email = params.email.trim().toLowerCase();

  const draft = await prisma.networkRegistrationDraft.findUnique({
    where: { id: params.draftId },
  });
  if (!draft) {
    return { ok: false, error: "Registration draft not found", status: 400 };
  }
  if (draft.email !== email) {
    return {
      ok: false,
      error: "Email does not match this registration",
      status: 400,
    };
  }

  const canResumePastExpiry =
    Boolean(draft.agentId) || draft.status === "COMPLETED";
  if (draft.expiresAt.getTime() < Date.now() && !canResumePastExpiry) {
    await prisma.networkRegistrationDraft.update({
      where: { id: draft.id },
      data: { status: "EXPIRED" },
    });
    return { ok: false, error: "Registration draft expired", status: 400 };
  }

  const { verifyNetworkRegistrationOtp } =
    await import("@/lib/network-registration/otp");
  const verified = await verifyNetworkRegistrationOtp({
    email,
    otp: params.otp,
    headers: params.headers,
  });
  if (!verified.ok) {
    return { ok: false, error: verified.error, status: 401 };
  }

  const fulfilled = await fulfillNetworkRegistrationDraft({
    draftId: params.draftId,
    user: verified.user,
    activeOrganizationId: null,
  });

  if (!fulfilled.ok) {
    if (fulfilled.needsKyc) {
      return {
        ok: false,
        error: fulfilled.error,
        needsKyc: true,
        kycContinueUrl: buildNetworkKycReturnUrl(params.draftId),
        status: 403,
      };
    }
    return { ok: false, error: fulfilled.error, status: 400 };
  }

  return {
    ok: true,
    agentId: fulfilled.agentId,
    status: fulfilled.status,
    notes: fulfilled.notes,
    successPath: `/register/success?agentId=${encodeURIComponent(fulfilled.agentId)}`,
  };
}
