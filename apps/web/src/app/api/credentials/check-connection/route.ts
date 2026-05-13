import { NextRequest } from "next/server";

import { apiError } from "@/lib/api/error";
import { requireAnyNetworkedOidcApiScope } from "@/lib/auth/oidc-api-permissions";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  isAgentVerificationFlowEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";
import { contractJsonResponse } from "@/lib/openapi/contracts";
import { checkContactExists } from "@/lib/veridian";

import contract, { checkConnectionSchema } from "./route.contract";

export async function POST(request: NextRequest) {
  try {
    if (!isAgentVerificationFlowEnabled()) {
      return apiError(
        verificationFeatureCopy.agentVerificationUnavailableDescription,
        503,
        undefined,
        { contract, method: "POST" },
      );
    }

    const authContext = await getAuthenticatedOrThrow(request);
    requireAnyNetworkedOidcApiScope(authContext, {
      resource: "credentials",
      action: "read",
    });

    const body = await request.json().catch(() => ({}));
    const validation = checkConnectionSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        "Invalid request",
        400,
        validation.error.issues.map((issue) => issue.message),
        { contract, method: "POST" },
      );
    }

    const { aid } = validation.data;

    const exists = await checkContactExists(aid);

    return contractJsonResponse(contract, "POST", 200, {
      success: true,
      data: { exists },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to check connection:", error);
    return apiError(
      error instanceof Error ? error.message : "Failed to check connection",
      500,
      undefined,
      { contract, method: "POST" },
    );
  }
}
