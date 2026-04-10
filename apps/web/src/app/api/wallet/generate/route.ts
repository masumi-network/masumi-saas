import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/api/rate-limit";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { createPaymentNodeClient, paymentNodeConfig } from "@/lib/payment-node";
import { parseNetwork } from "@/lib/schemas";

/** Per-user limit on payment-node wallet generation (admin API). */
const WALLET_GENERATE_WINDOW_MS = 60 * 60 * 1000;
const WALLET_GENERATE_MAX_PER_WINDOW = parseInt(
  process.env.WALLET_GENERATE_RATE_LIMIT_MAX ?? "10",
  10,
);

/** Prevent caching of responses (success may include a wallet mnemonic). */
const NO_STORE_JSON_HEADERS = {
  "Cache-Control": "private, no-store, must-revalidate",
  Pragma: "no-cache",
} as const;

function getNetworkFromRequest(request: NextRequest): "Mainnet" | "Preprod" {
  const fromQuery = request.nextUrl.searchParams.get("network");
  const fromCookie = request.cookies.get("payment_network")?.value;
  return parseNetwork(fromQuery ?? fromCookie ?? undefined);
}

/**
 * Generate a one-off Cardano wallet via the payment node (admin API).
 * Not persisted on the node — for user backup / use as collection address only.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedOrThrow(request);

    const rl = await checkRateLimit(`wallet-generate:${user.id}`, {
      windowMs: WALLET_GENERATE_WINDOW_MS,
      maxRequests: WALLET_GENERATE_MAX_PER_WINDOW,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
        },
        {
          status: 429,
          headers: {
            ...NO_STORE_JSON_HEADERS,
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(rl.limit),
            "X-RateLimit-Remaining": String(rl.remaining),
          },
        },
      );
    }

    const network = getNetworkFromRequest(request);

    let baseUrl: string;
    let adminKey: string;
    try {
      baseUrl = paymentNodeConfig.getBaseUrl();
      adminKey = paymentNodeConfig.getAdminApiKey();
    } catch (e) {
      console.error("[wallet/generate] payment node config missing", e);
      return NextResponse.json(
        {
          success: false,
          error: "Payment service is not configured. Try again later.",
        },
        { status: 503, headers: NO_STORE_JSON_HEADERS },
      );
    }

    const client = createPaymentNodeClient(baseUrl, adminKey);
    const wallet = await client.generateWallet(network);

    return NextResponse.json(
      {
        success: true,
        data: {
          walletAddress: wallet.walletAddress,
          walletMnemonic: wallet.walletMnemonic,
        },
      },
      { headers: NO_STORE_JSON_HEADERS },
    );
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("[wallet/generate] failed", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate wallet" },
      { status: 500, headers: NO_STORE_JSON_HEADERS },
    );
  }
}
