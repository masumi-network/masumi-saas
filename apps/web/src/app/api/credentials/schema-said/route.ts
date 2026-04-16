import { NextRequest } from "next/server";

import { apiError } from "@/lib/api/error";
import { requireAnyNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import { getAgentVerificationSchemaSaid } from "@/lib/veridian";

import contract from "./route.contract";

export async function GET(request: NextRequest) {
  try {
    if (!isAgentVerificationFlowEnabled()) {
      return apiError(
        verificationFeatureCopy.agentVerificationUnavailableDescription,
        503,
        undefined,
        { contract, method: "GET" },
      );
    }

    const authContext = await getAuthenticatedOrThrow(request);
    requireAnyNetworkedOidcApiScope(authContext, {
      resource: "credentials",
      action: "read",
    });

    const schemaSaid = getAgentVerificationSchemaSaid();

    return contractJsonResponse(contract, "GET", 200, {
      success: true,
      data: { schemaSaid },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to get schema SAID:", error);
    return contractJsonResponse(contract, "GET", 500, {
      success: false,
      error: "Failed to get schema SAID",
    });
  }
}
