import type { X402EvmWalletType } from "@masumi/database";

import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";
import type { WebhookEventType } from "@/lib/payment-node/schemas";

const WEBHOOK_REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = "Masumi-Webhook/1.0";
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? "masumi-saas";

type X402PaymentWebhookData = {
  attemptId: string;
  paymentPayloadHash: string;
  supportedPaymentSourceId: string | null;
  agentId: string | null;
  caip2Network: string;
  asset: string;
  amount: string;
  payTo: string;
  payer: string | null;
  txHash: string | null;
  success: boolean;
  errorReason: string | null;
  errorMessage: string | null;
  settledAt?: string;
};

type X402WalletLowBalanceWebhookData = {
  ruleId: string;
  evmWalletId: string;
  walletAddress: string;
  walletType: X402EvmWalletType;
  caip2Network: string;
  asset: string;
  thresholdAmount: string;
  currentAmount: string;
  checkedAt: string;
};

type WebhookDeliveryPayload = {
  event_type: WebhookEventType;
  service_name: string;
  timestamp: string;
  webhook_id: string;
  data: Record<string, unknown>;
};

async function listAllActiveWebhooksForUser(userId: string) {
  const client = await getPaymentNodeClientForUser(userId);
  if (client == null) return [];

  const webhooks = [];
  let cursorId: string | undefined;
  for (let page = 0; page < 20; page++) {
    const batch = await client.listWebhooks({ limit: 50, cursorId });
    webhooks.push(...batch.Webhooks.filter((webhook) => webhook.isActive));
    if (batch.Webhooks.length < 50) break;
    const nextCursor = batch.Webhooks[batch.Webhooks.length - 1]?.id;
    if (nextCursor == null || nextCursor === cursorId) break;
    cursorId = nextCursor;
  }
  return webhooks;
}

async function deliverWebhook(
  url: string,
  payload: WebhookDeliveryPayload,
): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Masumi-Event": payload.event_type,
        "X-Masumi-Timestamp": payload.timestamp,
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_REQUEST_TIMEOUT_MS),
      redirect: "manual",
    });
  } catch (error) {
    console.warn("[x402] webhook delivery failed", {
      event_type: payload.event_type,
      webhook_id: payload.webhook_id,
      error,
    });
  }
}

async function deliverEventToUserWebhooks(
  userId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
): Promise<void> {
  const webhooks = await listAllActiveWebhooksForUser(userId);
  const subscribers = webhooks.filter((webhook) =>
    webhook.Events.includes(eventType),
  );
  if (subscribers.length === 0) return;

  const timestamp = new Date().toISOString();
  await Promise.all(
    subscribers.map((webhook) =>
      deliverWebhook(webhook.url, {
        event_type: eventType,
        service_name: SERVICE_NAME,
        timestamp,
        webhook_id: webhook.id,
        data,
      }),
    ),
  );
}

export function triggerX402Payment(
  userId: string,
  success: boolean,
  payload: X402PaymentWebhookData,
): void {
  const eventType: WebhookEventType = success
    ? "X402_PAYMENT_SETTLED"
    : "X402_PAYMENT_FAILED";
  void deliverEventToUserWebhooks(userId, eventType, {
    ...payload,
    registryRequestId: null,
    settledAt: payload.settledAt ?? new Date().toISOString(),
  }).catch((error) => {
    console.error("[x402] failed to trigger payment webhook", {
      userId,
      attemptId: payload.attemptId,
      error,
    });
  });
}

export function triggerX402WalletLowBalance(
  userId: string,
  payload: X402WalletLowBalanceWebhookData,
): void {
  void deliverEventToUserWebhooks(
    userId,
    "X402_WALLET_LOW_BALANCE",
    payload,
  ).catch((error) => {
    console.error("[x402] failed to trigger low-balance webhook", {
      userId,
      ruleId: payload.ruleId,
      error,
    });
  });
}
