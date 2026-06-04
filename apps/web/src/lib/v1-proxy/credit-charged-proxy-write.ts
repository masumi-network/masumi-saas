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

  const refundParams = {
    userId: params.userId,
    reason: "payment_proxy_write" as const,
    reference: creditReference,
    network: params.network,
    metadata,
  };

  let response: Response;
  try {
    const headers = buildUpstreamHeaders(params.request, params.token);
    response = await fetch(
      `${params.upstreamBaseUrl}${params.upstreamPath}${new URL(params.request.url).search}`,
      {
        method: params.method,
        headers,
        ...(params.body !== undefined ? { body: params.body } : {}),
      },
    );
  } catch (error) {
    await refundConsumedCredit(refundParams);
    throw error;
  }

  if (shouldRefundProxyUpstreamStatus(response.status)) {
    await refundConsumedCredit(refundParams);
  }

  // Do not refund if mapping the upstream body fails after a non-5xx response —
  // the payment node may already have applied the write.
  return toUpstreamResponse(response);
}
