import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { handleAuthError } from "@/lib/auth/utils";

export class ApiError extends Error {
  readonly status: ContentfulStatusCode;
  readonly details?: unknown;
  /** Extra fields merged into the JSON body (e.g. `{ code: "..." }`). */
  readonly extraBody?: Record<string, unknown>;

  constructor(
    status: ContentfulStatusCode,
    message: string,
    details?: unknown,
    extraBody?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.extraBody = extraBody;
  }
}

type ApiErrorBody = {
  success: false;
  error: string;
  details?: unknown;
  [k: string]: unknown;
};

export const handleApiError: ErrorHandler = (err, c) => {
  if (err instanceof ApiError) {
    const body: ApiErrorBody = { success: false, error: err.message };
    if (err.details !== undefined) {
      body.details = err.details;
    }
    if (err.extraBody) {
      Object.assign(body, err.extraBody);
    }
    return c.json(body, err.status);
  }

  const authResponse = handleAuthError(err);
  if (authResponse) {
    return authResponse;
  }

  console.error("Unhandled API error:", err);
  return c.json(
    { success: false, error: "Internal server error" } satisfies ApiErrorBody,
    500,
  );
};
