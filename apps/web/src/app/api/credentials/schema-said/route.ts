import { NextRequest, NextResponse } from "next/server";

import { apiError } from "@/lib/api/error";
import { requireAnyNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { getAgentVerificationSchemaSaid } from "@/lib/veridian";

export async function GET(request: NextRequest) {
  try {
    if (!isAgentVerificationFlowEnabled()) {
      return apiError(
        verificationFeatureCopy.agentVerificationUnavailableDescription,
        503,
      );
    }

    const authContext = await getAuthenticatedOrThrow(request);
    requireAnyNetworkedOidcApiScope(authContext, {
      resource: "credentials",
      action: "read",
    });

    const schemaSaid = getAgentVerificationSchemaSaid();

    return NextResponse.json({
      success: true,
      data: { schemaSaid },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get schema SAID:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get schema SAID" },
      { status: 500 },
    );
  }
}
