import "server-only";

import prisma from "@masumi/database/client";
import { z } from "zod";

import { decryptIntegrationConnectionSecret } from "@/lib/integrations/connections";
import {
  completeLangdockChat,
  type LangdockMessage,
} from "@/lib/integrations/langdock";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";

import {
  hashInputData,
  hashInputSchema,
  hashResult,
  signRuntimeResponse,
} from "./hash";
import {
  getDefaultLangdockInputSchema,
  getLangdockHitlInputSchema,
  type MipInputDataPayload,
  mipInputDataPayloadSchema,
  type MipInputSchema,
} from "./input-schema";

const PAYMENT_LOCKED_STATES = new Set(["FundsLocked"]);

const providerConfigSchema = z.object({
  langdockAgentId: z.string().min(1),
  langdockBaseUrl: z.string().optional().nullable(),
  inputSchema: z.unknown().optional(),
  hitl: z.literal(true).optional(),
});

const startJobBodySchema = z
  .object({
    identifierFromPurchaser: z.string().optional(),
    identifier_from_purchaser: z.string().optional(),
    input_data: mipInputDataPayloadSchema.default({}),
  })
  .passthrough();

const statusQuerySchema = z.object({
  job_id: z.string().min(1),
});

const provideInputBodySchema = z.object({
  job_id: z.string().min(1),
  input_schema_hash: z.string().min(1),
  input_data: mipInputDataPayloadSchema.default({}),
});

type RuntimeAgent = Awaited<ReturnType<typeof loadRuntimeAgent>>;

function dateFromPayment(value: string | null | undefined): Date | null {
  if (!value) return null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) return new Date(asNumber);
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

function dateMs(date: Date | null | undefined): number {
  return date?.getTime() ?? Date.now();
}

function calculatePaymentTimes() {
  const now = Date.now();
  return {
    payByTime: new Date(now + 60 * 60 * 1000),
    submitResultTime: new Date(now + 6 * 60 * 60 * 1000),
    unlockTime: new Date(now + 12 * 60 * 60 * 1000),
    externalDisputeUnlockTime: new Date(now + 18 * 60 * 60 * 1000),
  };
}

async function loadRuntimeAgent(agentId: string) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      integrationConnection: true,
      agentReference: true,
    },
  });
  if (!agent || agent.runtimeProvider !== "LANGDOCK") return null;
  if (!agent.integrationConnection) return null;
  const config = providerConfigSchema.safeParse(agent.providerConfig);
  if (!config.success) return null;
  return { ...agent, langdockConfig: config.data };
}

function buildInitialPrompt(inputData: MipInputDataPayload): string {
  const text = inputData.text;
  if (typeof text === "string" && text.trim()) return text.trim();

  const stringParts = Object.entries(inputData)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key, value]) => `${key}: ${String(value).trim()}`);
  if (stringParts.length > 0) return stringParts.join("\n");

  return JSON.stringify(inputData);
}

function serializeConversation(
  conversation: LangdockMessage[],
  latestUserMessage?: string | null,
): string {
  const messages = latestUserMessage
    ? [...conversation, { role: "user" as const, content: latestUserMessage }]
    : conversation;
  return messages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n\n");
}

function readConversation(value: unknown): LangdockMessage[] {
  const parsed = z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      }),
    )
    .safeParse(value);
  return parsed.success ? parsed.data : [];
}

function shouldFinish(inputData: MipInputDataPayload): boolean {
  for (const key of ["finish", "done", "submit"]) {
    if (inputData[key] === true) return true;
  }

  for (const key of ["message", "action"]) {
    const value = inputData[key];
    if (typeof value !== "string") continue;
    const normalized = value.trim().toLowerCase();
    if (["done", "finish", "submit"].includes(normalized)) return true;
  }

  return false;
}

function getMessageInput(inputData: MipInputDataPayload): string {
  const message = inputData.message;
  if (typeof message === "string") return message.trim();
  return buildInitialPrompt(inputData);
}

async function getLangdockSecret(agent: NonNullable<RuntimeAgent>) {
  if (!agent.integrationConnection) {
    throw new Error("Langdock integration connection not found");
  }
  return decryptIntegrationConnectionSecret(agent.integrationConnection);
}

function getRuntimeSignatureSecret(agent: NonNullable<RuntimeAgent>) {
  if (!agent.integrationConnection?.encryptedSecret) {
    throw new Error("Langdock integration connection not found");
  }
  return `${agent.id}:${agent.integrationConnection.encryptedSecret}`;
}

function signProvideInputBody<T extends Record<string, unknown>>(
  agent: NonNullable<RuntimeAgent>,
  body: T,
): T & { signature: string } {
  const secret = getRuntimeSignatureSecret(agent);
  return {
    ...body,
    signature: signRuntimeResponse(body, secret),
  };
}

async function resolvePaymentLocked(job: {
  blockchainIdentifier: string | null;
  agent: { userId: string; networkIdentifier: string | null };
}): Promise<boolean> {
  if (!job.blockchainIdentifier) return true;
  const client = await getPaymentNodeClientForUser(job.agent.userId);
  if (!client) return false;
  const payment = await client.resolvePaymentByBlockchainIdentifier({
    blockchainIdentifier: job.blockchainIdentifier,
    network: job.agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
    includeHistory: false,
  });
  return PAYMENT_LOCKED_STATES.has(payment.onChainState ?? "");
}

export async function resumeLangdockJob(jobId: string): Promise<void> {
  const job = await prisma.mipJob.findUnique({
    where: { id: jobId },
    include: {
      agent: {
        include: {
          integrationConnection: true,
          agentReference: true,
        },
      },
    },
  });
  if (!job) return;
  if (job.status === "COMPLETED" || job.status === "FAILED") return;
  if (job.agent.runtimeProvider !== "LANGDOCK") return;

  const agent = await loadRuntimeAgent(job.agentId);
  if (!agent) {
    await prisma.mipJob.update({
      where: { id: job.id },
      data: { status: "FAILED", error: "Langdock runtime agent not found" },
    });
    return;
  }

  if (job.status === "AWAITING_PAYMENT") {
    const locked = await resolvePaymentLocked(job);
    if (!locked) return;
    await prisma.mipJob.update({
      where: { id: job.id },
      data: { status: "RUNNING" },
    });
  }

  const refreshed = await prisma.mipJob.findUnique({
    where: { id: job.id },
  });
  if (!refreshed || refreshed.status !== "RUNNING") return;

  try {
    const secret = await getLangdockSecret(agent);
    const messages: LangdockMessage[] = [
      {
        role: "user",
        content: buildInitialPrompt(refreshed.inputData as MipInputDataPayload),
      },
    ];
    const answer = await completeLangdockChat({
      apiKey: secret,
      agentId: agent.langdockConfig.langdockAgentId,
      baseUrl: agent.langdockConfig.langdockBaseUrl,
      messages,
    });
    const conversation = [
      ...messages,
      { role: "assistant" as const, content: answer },
    ];
    await prisma.mipJob.update({
      where: { id: refreshed.id },
      data: {
        status: "AWAITING_INPUT",
        result: answer,
        inputSchema: getLangdockHitlInputSchema(),
        conversation,
      },
    });
  } catch (error) {
    await prisma.mipJob.update({
      where: { id: refreshed.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

export async function getLangdockAvailability(agentId: string) {
  const agent = await loadRuntimeAgent(agentId);
  if (!agent) return null;
  return {
    type: "masumi-agent",
    status: "available",
    agentIdentifier: agent.agentIdentifier ?? undefined,
  };
}

export async function getLangdockInputSchema(agentId: string) {
  const agent = await loadRuntimeAgent(agentId);
  if (!agent) return null;
  const schema =
    agent.langdockConfig.inputSchema ?? getDefaultLangdockInputSchema();
  return schema as MipInputSchema;
}

export async function startLangdockJob(agentId: string, body: unknown) {
  const agent = await loadRuntimeAgent(agentId);
  if (!agent) {
    return { status: 404 as const, body: { error: "Agent not found" } };
  }
  const parsed = startJobBodySchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400 as const, body: { error: "Invalid start_job body" } };
  }

  const identifierFromPurchaser =
    parsed.data.identifierFromPurchaser ??
    parsed.data.identifier_from_purchaser ??
    null;
  const inputData = parsed.data.input_data;
  const isPaidJob = Boolean(identifierFromPurchaser);

  if (isPaidJob && !agent.agentIdentifier) {
    return {
      status: 409 as const,
      body: { error: "Agent is not registered on-chain yet" },
    };
  }

  const inputHash = identifierFromPurchaser
    ? hashInputData(inputData, identifierFromPurchaser)
    : "";

  if (!isPaidJob) {
    const job = await prisma.mipJob.create({
      data: {
        agentId: agent.id,
        status: "RUNNING",
        identifierFromPurchaser: "",
        inputData,
        inputHash,
      },
    });
    void resumeLangdockJob(job.id);
    return { status: 200 as const, body: { id: job.id } };
  }

  const client = await getPaymentNodeClientForUser(agent.userId);
  if (!client) {
    return {
      status: 503 as const,
      body: { error: "Payment node unavailable" },
    };
  }

  const times = calculatePaymentTimes();
  const payment = await client.createPayment({
    inputHash,
    network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
    agentIdentifier: agent.agentIdentifier!,
    identifierFromPurchaser: identifierFromPurchaser!,
    payByTime: times.payByTime.toISOString(),
    submitResultTime: times.submitResultTime.toISOString(),
    unlockTime: times.unlockTime.toISOString(),
    externalDisputeUnlockTime: times.externalDisputeUnlockTime.toISOString(),
    metadata: JSON.stringify({ agentId: agent.id }),
  });

  const payByTime = dateFromPayment(payment.payByTime) ?? times.payByTime;
  const submitResultTime =
    dateFromPayment(payment.submitResultTime) ?? times.submitResultTime;
  const unlockTime = dateFromPayment(payment.unlockTime) ?? times.unlockTime;
  const externalDisputeUnlockTime =
    dateFromPayment(payment.externalDisputeUnlockTime) ??
    times.externalDisputeUnlockTime;

  const job = await prisma.mipJob.create({
    data: {
      agentId: agent.id,
      status: "AWAITING_PAYMENT",
      identifierFromPurchaser: identifierFromPurchaser!,
      inputData,
      inputHash,
      blockchainIdentifier: payment.blockchainIdentifier,
      agentIdentifier: agent.agentIdentifier,
      sellerVKey:
        agent.agentReference?.sellingWalletVkey ??
        payment.SmartContractWallet?.walletVkey ??
        null,
      payByTime,
      submitResultTime,
      unlockTime,
      externalDisputeUnlockTime,
    },
  });

  void resumeLangdockJob(job.id);

  return {
    status: 200 as const,
    body: {
      id: job.id,
      input_hash: inputHash,
      identifierFromPurchaser,
      blockchainIdentifier: payment.blockchainIdentifier,
      payByTime: dateMs(payByTime),
      submitResultTime: dateMs(submitResultTime),
      unlockTime: dateMs(unlockTime),
      externalDisputeUnlockTime: dateMs(externalDisputeUnlockTime),
      agentIdentifier: agent.agentIdentifier,
      sellerVKey: job.sellerVKey ?? "",
    },
  };
}

export async function getLangdockJobStatus(agentId: string, query: unknown) {
  const parsed = statusQuerySchema.safeParse(query);
  if (!parsed.success) {
    return { status: 400 as const, body: { error: "Missing job_id" } };
  }
  const scopedJob = await prisma.mipJob.findFirst({
    where: { id: parsed.data.job_id, agentId },
  });
  if (!scopedJob) {
    return { status: 404 as const, body: { error: "Job not found" } };
  }

  await resumeLangdockJob(scopedJob.id);
  const job = await prisma.mipJob.findFirst({
    where: { id: scopedJob.id, agentId },
  });
  if (!job) return { status: 404 as const, body: { error: "Job not found" } };

  switch (job.status) {
    case "AWAITING_PAYMENT":
      return { status: 200 as const, body: { status: "awaiting_payment" } };
    case "RUNNING":
      return { status: 200 as const, body: { status: "running" } };
    case "AWAITING_INPUT":
      return {
        status: 200 as const,
        body: {
          status: "awaiting_input",
          input_schema: job.inputSchema ?? getLangdockHitlInputSchema(),
        },
      };
    case "COMPLETED":
      return {
        status: 200 as const,
        body: { status: "completed", result: job.result ?? "" },
      };
    case "FAILED":
      return {
        status: 200 as const,
        body: { status: "failed", result: job.error ?? "Job failed" },
      };
  }
}

export async function provideLangdockJobInput(agentId: string, body: unknown) {
  const parsed = provideInputBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400 as const,
      body: { error: "Invalid provide_input body" },
    };
  }

  const job = await prisma.mipJob.findFirst({
    where: { id: parsed.data.job_id, agentId },
    include: {
      agent: {
        include: {
          integrationConnection: true,
          agentReference: true,
        },
      },
    },
  });
  if (!job) return { status: 404 as const, body: { error: "Job not found" } };
  if (job.status !== "AWAITING_INPUT") {
    return {
      status: 409 as const,
      body: { error: "Job is not awaiting input" },
    };
  }

  const expectedHash = hashInputSchema(
    job.inputSchema ?? getLangdockHitlInputSchema(),
  );
  if (!expectedHash || expectedHash !== parsed.data.input_schema_hash) {
    return {
      status: 400 as const,
      body: { error: "Invalid input schema hash" },
    };
  }

  const inputHash = hashInputData(
    parsed.data.input_data,
    job.identifierFromPurchaser || job.id,
  );
  const conversation = readConversation(job.conversation);
  const message = getMessageInput(parsed.data.input_data);
  const agent = await loadRuntimeAgent(job.agentId);
  if (!agent) {
    return { status: 404 as const, body: { error: "Agent not found" } };
  }

  if (shouldFinish(parsed.data.input_data)) {
    const finalResult = serializeConversation(conversation, message || null);
    const outputHash = hashResult(
      finalResult,
      job.identifierFromPurchaser || job.id,
    );
    const client = await getPaymentNodeClientForUser(agent.userId);
    if (job.blockchainIdentifier && client) {
      await client.submitPaymentResult({
        network: agent.networkIdentifier === "Mainnet" ? "Mainnet" : "Preprod",
        blockchainIdentifier: job.blockchainIdentifier,
        submitResultHash: outputHash,
      });
    }
    await prisma.mipJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        result: finalResult,
        outputHash,
      },
    });
    const responseBody = {
      input_hash: inputHash,
      status: "completed",
      job_id: job.id,
      result: finalResult,
      output_hash: outputHash,
    };
    return {
      status: 200 as const,
      body: signProvideInputBody(agent, responseBody),
    };
  }

  const updatedMessages = [
    ...conversation,
    { role: "user" as const, content: message },
  ];
  const langdockSecret = await getLangdockSecret(agent);
  const answer = await completeLangdockChat({
    apiKey: langdockSecret,
    agentId: agent.langdockConfig.langdockAgentId,
    baseUrl: agent.langdockConfig.langdockBaseUrl,
    messages: updatedMessages,
  });
  const nextConversation = [
    ...updatedMessages,
    { role: "assistant" as const, content: answer },
  ];
  await prisma.mipJob.update({
    where: { id: job.id },
    data: {
      status: "AWAITING_INPUT",
      result: answer,
      inputSchema: getLangdockHitlInputSchema(),
      conversation: nextConversation,
    },
  });

  const responseBody = {
    input_hash: inputHash,
    status: "awaiting_input",
    job_id: job.id,
    result: answer,
  };
  return {
    status: 200 as const,
    body: signProvideInputBody(agent, responseBody),
  };
}
