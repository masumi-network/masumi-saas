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
import { getNetworkRegisterCapabilities } from "@/lib/payment-node/registry-capabilities";
import { validatePayoutAddressForNetwork } from "@/lib/payment-node/payout-address";
import { assertAllowedAgentApiUrl } from "@/lib/security/outbound-url";
import { z } from "@/lib/zod-openapi";

const DRAFT_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const COMPLETE_POLL_ATTEMPTS = 24;
const COMPLETE_POLL_DELAY_MS = 5_000;

type DraftStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED";

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
  payment: z
    .object({
      network: z
        .string()
        .regex(/^eip155:\d+$/, "EVM network must be a CAIP-2 eip155 id"),
      asset: z
        .string()
        .regex(
          /^0x[a-fA-F0-9]{40}$/,
          "asset must be an ERC-20 contract address",
        ),
      amount: z
        .string()
        .regex(/^\d+$/, "amount must be token base units (integer)")
        .refine((value) => value !== "0", "amount must be greater than zero"),
      decimals: z.coerce.number().int().min(0).max(255).default(6),
      payTo: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "payTo must be an EVM address"),
      resource: z.string().url().max(500).optional().or(z.literal("")),
    })
    .optional(),
  mint: z.object({
    kyc: z.enum(["skip", "kyc"]),
    destination: z.enum(["managed", "browser", "external"]),
    /** Cardano receive address for external / browser paths (and optional payout). */
    cardanoAddress: z.string().max(250).optional().or(z.literal("")),
  }),
  cardanoNetwork: z.enum(["Preprod", "Mainnet"]).default("Preprod"),
});

export type NetworkRegisterBody = z.infer<typeof networkRegisterBodySchema>;

export const networkRegisterAccountBodySchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  termsAccepted: z.literal(true),
});

export type NetworkRegisterAccountBody = z.infer<
  typeof networkRegisterAccountBodySchema
>;

export const networkRegisterCompleteBodySchema =
  networkRegisterBodySchema.extend({
    registrationToken: z.string().min(1),
  });

export type NetworkRegisterCompleteBody = z.infer<
  typeof networkRegisterCompleteBodySchema
>;

export type NetworkRegistrationPayload = {
  agent: NetworkRegisterBody["agent"];
  payment?: NetworkRegisterBody["payment"];
  mint: NetworkRegisterBody["mint"];
  cardanoNetwork: PaymentNodeNetwork;
  effectiveDestination: "managed" | "browser" | "external";
  notes: string[];
};

function resolveNetworkRegistrationCommerce(
  payload: NetworkRegistrationPayload,
): {
  agentPricing: ReturnType<typeof buildAgentPricing>;
  supportedPaymentSources: SupportedPaymentSource[] | undefined;
} {
  const payment = payload.payment;
  if (!payment) {
    return {
      agentPricing: { pricingType: "Free" },
      supportedPaymentSources: undefined,
    };
  }

  return {
    agentPricing: { pricingType: "Free" },
    supportedPaymentSources: [
      buildEvmExactFixedPaymentSource({
        network: payment.network,
        asset: payment.asset,
        amount: payment.amount,
        decimals: payment.decimals,
        payTo: payment.payTo,
        ...(payment.resource ? { resource: payment.resource } : {}),
        extra: { ...DEFAULT_EVM_REGISTRY_EXTRA },
      }),
    ],
  };
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
      ...(body.payment ? { payment: body.payment } : {}),
      mint: body.mint,
      cardanoNetwork: body.cardanoNetwork,
      effectiveDestination: "managed",
      notes,
    };
  }

  if (destination === "browser") {
    if (!getNetworkRegisterCapabilities().browserWalletMintSupported) {
      throw new Error(
        "Browser wallet mint is not available yet. Use managed wallet until the payment node update is deployed.",
      );
    }
    if (body.mint.kyc === "kyc") {
      throw new Error(
        "Browser wallet mint is only available without KYC. Use managed or your Cardano address after KYC.",
      );
    }
    if (!body.mint.cardanoAddress?.trim()) {
      throw new Error(
        "Connect a Cardano browser wallet before submitting (address required).",
      );
    }
    notes.push(
      "Your connected Cardano address receives the registry NFT and min-UTXO. Mint fees are sponsored in this PoC.",
    );
    return {
      agent: body.agent,
      ...(body.payment ? { payment: body.payment } : {}),
      mint: body.mint,
      cardanoNetwork: body.cardanoNetwork,
      effectiveDestination: "browser",
      notes,
    };
  }

  // external (paper / existing address — user-provided bech32 after KYC)
  if (body.mint.kyc !== "kyc") {
    throw new Error("Your Cardano address mint requires KYC.");
  }
  if (!body.mint.cardanoAddress?.trim()) {
    throw new Error("Cardano address is required for your-address mint.");
  }
  notes.push(
    "After KYC, your Cardano address receives the registry NFT and min-UTXO.",
  );
  return {
    agent: body.agent,
    ...(body.payment ? { payment: body.payment } : {}),
    mint: body.mint,
    cardanoNetwork: body.cardanoNetwork,
    effectiveDestination: destination,
    notes,
  };
}

export async function startNetworkRegistrationAccount(params: {
  body: NetworkRegisterAccountBody;
}): Promise<
  | {
      ok: true;
      email: string;
      resultKey: "VerificationCodeSent";
      devCode?: string;
    }
  | { ok: false; error: string; status: 400 | 429 | 500 }
> {
  if (!params.body.termsAccepted) {
    return { ok: false, status: 400, error: "Terms must be accepted" };
  }

  const { sendNetworkRegistrationOtp } =
    await import("@/lib/network-registration/otp");
  const otp = await sendNetworkRegistrationOtp({
    email: params.body.email,
    name: params.body.name,
  });

  if (!otp.ok) {
    return { ok: false, status: otp.status, error: otp.error };
  }

  return {
    ok: true,
    email: otp.email,
    resultKey: "VerificationCodeSent",
    ...(otp.devCode ? { devCode: otp.devCode } : {}),
  };
}

export async function verifyNetworkRegistrationAccount(params: {
  email: string;
  otp: string;
  headers: Headers;
}): Promise<
  | {
      ok: true;
      email: string;
      registrationToken: string;
      sessionHeaders: Headers;
    }
  | { ok: false; error: string; status: 401 }
> {
  const { verifyNetworkRegistrationOtp } =
    await import("@/lib/network-registration/otp");
  const verified = await verifyNetworkRegistrationOtp({
    email: params.email,
    otp: params.otp,
    headers: params.headers,
  });
  if (!verified.ok) {
    return { ok: false, error: verified.error, status: 401 };
  }

  return {
    ok: true,
    email:
      verified.user.email?.trim().toLowerCase() ||
      params.email.trim().toLowerCase(),
    registrationToken: verified.registrationToken,
    sessionHeaders: verified.sessionHeaders,
  };
}

export async function createNetworkRegistrationDraft(params: {
  body: NetworkRegisterBody;
  userId?: string;
}): Promise<
  | {
      ok: true;
      draftId: string;
      email: string;
      notes: string[];
    }
  | { ok: false; error: string; status: 400 }
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
      ...(params.userId ? { userId: params.userId } : {}),
    },
  });

  return {
    ok: true,
    draftId,
    email: params.body.email.trim().toLowerCase(),
    notes: payload.notes,
  };
}

export async function completeNetworkRegistrationWithTicket(params: {
  body: NetworkRegisterCompleteBody;
}): Promise<
  | {
      ok: true;
      agentId: string;
      status: "registered" | "pending";
      notes: string[];
      successPath: string;
      continueUrl?: string;
    }
  | {
      ok: false;
      error: string;
      needsKyc?: boolean;
      kycContinueUrl?: string;
      status?: 400 | 401 | 403;
    }
> {
  const email = params.body.email.trim().toLowerCase();
  const { resolveNetworkRegistrationTicket, revokeNetworkRegistrationTicket } =
    await import("@/lib/network-registration/otp");
  const ticket = await resolveNetworkRegistrationTicket({
    token: params.body.registrationToken,
    email,
  });
  if (!ticket.ok) {
    return { ok: false, error: ticket.error, status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { id: ticket.userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    return {
      ok: false,
      error: "User not found for registration session",
      status: 401,
    };
  }

  const draft = await createNetworkRegistrationDraft({
    body: params.body,
    userId: user.id,
  });
  if (!draft.ok) {
    return { ok: false, error: draft.error, status: 400 };
  }

  const fulfilled = await fulfillNetworkRegistrationDraft({
    draftId: draft.draftId,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    activeOrganizationId: null,
    // Return quickly; the marketing site redirects to /network-register/continue
    // where the client poller waits for on-chain mint confirmation.
    deferOnChainPolling: true,
  });

  if (!fulfilled.ok) {
    if (fulfilled.needsKyc) {
      // Keep the ticket alive so the marketing-site wizard can retry /complete
      // after the user finishes KYC without sending another OTP.
      return {
        ok: false,
        error: fulfilled.error,
        needsKyc: true,
        kycContinueUrl: buildNetworkKycVerifyUrl(draft.draftId),
        status: 403,
      };
    }
    return { ok: false, error: fulfilled.error, status: 400 };
  }

  await revokeNetworkRegistrationTicket(ticket.token);

  const continueUrl =
    fulfilled.status === "pending"
      ? buildNetworkKycReturnUrl(draft.draftId)
      : undefined;

  return {
    ok: true,
    agentId: fulfilled.agentId,
    status: fulfilled.status,
    notes: fulfilled.notes,
    successPath: fulfilled.networkSiteSuccessUrl,
    ...(continueUrl ? { continueUrl } : {}),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fulfillNetworkRegistrationDraft(params: {
  draftId: string;
  user: { id: string; name: string | null; email: string | null };
  activeOrganizationId: string | null;
  /** Skip server-side mint polling; caller shows a client poller instead. */
  deferOnChainPolling?: boolean;
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
    const { agentPricing, supportedPaymentSources } =
      resolveNetworkRegistrationCommerce(payload);

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

    if (params.deferOnChainPolling) {
      await prisma.networkRegistrationDraft.update({
        where: { id: draft.id },
        data: {
          agentId: started.agentId,
          status: "PROCESSING",
          error: null,
          userId: params.user.id,
        },
      });
      return {
        ok: true,
        agentId: started.agentId,
        status: "pending",
        notes: payload.notes,
        networkSiteSuccessUrl: buildNetworkSiteSuccessUrl(started.agentId),
      };
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

export function buildNetworkKycVerifyUrl(draftId: string): string {
  const app =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:2999";
  return new URL(
    `/network-register/verify?draftId=${encodeURIComponent(draftId)}`,
    app,
  ).toString();
}
