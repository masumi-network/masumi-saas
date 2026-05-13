import { NextResponse } from "next/server";

import {
  contractJsonResponse,
  type HttpMethod,
  type RouteContract,
} from "@/lib/openapi/contracts";

/**
 * Returns a JSON error response with a consistent shape for API routes.
 * @param message - Error message for the client
 * @param status - HTTP status code (default 400)
 * @param details - Optional details (e.g. validation issues or server data)
 */
export function apiError(
  message: string,
  status: number = 400,
  details?: unknown,
  options?: {
    contract?: RouteContract;
    method?: HttpMethod;
    init?: Omit<ResponseInit, "status">;
  },
): NextResponse {
  const body: { success: false; error: string; details?: unknown } = {
    success: false,
    error: message,
  };
  if (details !== undefined) {
    body.details = details;
  }
  if (options?.contract && options.method) {
    return contractJsonResponse(
      options.contract,
      options.method,
      status,
      body,
      options.init,
    );
  }
  return NextResponse.json(body, { ...options?.init, status });
}
