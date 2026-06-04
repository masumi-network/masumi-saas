import "server-only";

import {
  consumeCreditIfRequired,
  createCreditReference,
  refundConsumedCredit,
} from "@/lib/credits/service";
import {
  buildUpstreamHeaders,
  toUpstreamResponse,
} from "@/lib/v1-proxy/explicit-route-support";

function shouldRefundProxyUpstreamStatus(status: number): boolean {
  return status >= 500;
}

/**
 * Debits for a payment-node proxy write, calls upstream, refunds on 5xx or fetch failure.
 */
export async function executeCreditChargedProxyWrite(params: {
  userId: string;
  network: string;
  routePath: string;
  upstreamPath: string;
  upstreamBaseUrl: string;
  token: string;
  request: Request;
  method: "POST" | "DELETE";
  body?: string | null;
  authMethod?: string;
}) {
  const creditReference = createCreditReference("payment-proxy-write");
  const metadata = {
    method: params.method,
    route: params.routePath,
    upstreamPath: params.upstreamPath,
    network: params.network,
    ...(params.authMethod ? { authMethod: params.authMethod } : {}),
  };

  await consumeCreditIfRequired({
    userId: params.userId,
    reason: "payment_proxy_write",
    reference: creditReference,
    network: params.network,
    metadata,
  });

  try {
    const headers = buildUpstreamHeaders(params.request, params.token);
    const response = await fetch(
      `${params.upstreamBaseUrl}${params.upstreamPath}${new URL(params.request.url).search}`,
      {
        method: params.method,
        headers,
        ...(params.body !== undefined ? { body: params.body } : {}),
      },
    );

    if (shouldRefundProxyUpstreamStatus(response.status)) {
      await refundConsumedCredit({
        userId: params.userId,
        reason: "payment_proxy_write",
        reference: creditReference,
        network: params.network,
        metadata,
      });
    }

    return toUpstreamResponse(response);
  } catch (error) {
    await refundConsumedCredit({
      userId: params.userId,
      reason: "payment_proxy_write",
      reference: creditReference,
      network: params.network,
      metadata,
    });
    throw error;
  }
}
