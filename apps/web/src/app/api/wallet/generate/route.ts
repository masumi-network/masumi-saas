import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { createPaymentNodeClient, paymentNodeConfig } from "@/lib/payment-node";
import { parseNetwork } from "@/lib/schemas";

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
    await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });

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
        { status: 503 },
      );
    }

    const client = createPaymentNodeClient(baseUrl, adminKey);
    const wallet = await client.generateWallet(network);

    return NextResponse.json({
      success: true,
      data: {
        walletAddress: wallet.walletAddress,
        walletMnemonic: wallet.walletMnemonic,
      },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("[wallet/generate] failed", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate wallet" },
      { status: 500 },
    );
  }
}
