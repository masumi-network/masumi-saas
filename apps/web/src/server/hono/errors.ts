import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { CREDIT_OPERATION_COST_ATOMIC } from "@/lib/credits/pricing";

export type ApiErrorInit = {
  details?: unknown;
  /** Extra fields merged into the JSON body (e.g. `{ code: "..." }`). */
  extraBody?: Record<string, unknown>;
  /** Extra response headers (e.g. `Retry-After`, `X-RateLimit-*`). */
  headers?: Record<string, string>;
};

export class ApiError extends Error {
  readonly status: ContentfulStatusCode;
  readonly details?: unknown;
  readonly extraBody?: Record<string, unknown>;
  readonly headers?: Record<string, string>;

  constructor(
    status: ContentfulStatusCode,
    message: string,
    init?: ApiErrorInit,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = init?.details;
    this.extraBody = init?.extraBody;
    this.headers = init?.headers;
  }
}

type ErrorBody = {
  success: false;
  error: string;
  details?: unknown;
  [k: string]: unknown;
};

function buildBody(
  message: string,
  details?: unknown,
  extra?: Record<string, unknown>,
): ErrorBody {
  const body: ErrorBody = { success: false, error: message };
  if (details !== undefined) body.details = details;
  if (extra) Object.assign(body, extra);
  return body;
}

/**
 * Duck-type check for our named auth/credit errors. Done by `error.name`
 * (not `instanceof`) so test modules that mock `@/lib/auth/utils` or
 * `@/lib/credits/service` can throw plain objects with the right `name`
 * and still get the correct HTTP status from this central handler.
 */
function isErrorWithName(err: unknown, name: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === name
  );
}

const AUTH_OR_CREDITS_ERROR_NAMES = new Set([
  "UnauthorizedError",
  "EmailNotVerifiedError",
  "ForbiddenError",
  "InsufficientCreditsError",
]);

/**
 * True for the auth/credit errors that map to specific HTTP statuses.
 * Used by `toApiErrorIfAuth` and route catch blocks.
 */
function hasAuthOrCreditsName(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = (err as { name?: unknown }).name;
  return typeof name === "string" && AUTH_OR_CREDITS_ERROR_NAMES.has(name);
}

/**
 * If `err` is one of our auth/credit errors (by `name`), returns an
 * `ApiError` with the correct HTTP status + body. Otherwise returns null.
 *
 * Wrapping into `ApiError` (a real Error subclass) is required because
 * Hono's `app.onError` ignores non-Error throws — see
 * https://github.com/honojs/hono `#handleError` in hono-base.
 */
export function toApiErrorIfAuth(err: unknown): ApiError | null {
  if (!hasAuthOrCreditsName(err)) return null;
  const e = err as { name: string; message?: string };
  switch (e.name) {
    case "UnauthorizedError":
      return new ApiError(401, "Unauthorized");
    case "EmailNotVerifiedError":
      return new ApiError(403, "Email verification required");
    case "ForbiddenError":
      return new ApiError(403, e.message ?? "Forbidden");
    case "InsufficientCreditsError": {
      const c = err as {
        message?: string;
        creditsRemaining?: number;
        requiredCredits?: number;
      };
      return new ApiError(402, c.message ?? "Insufficient credits", {
        extraBody: {
          creditsRemaining: c.creditsRemaining ?? 0,
          requiredCredits:
            c.requiredCredits ??
            CREDIT_OPERATION_COST_ATOMIC.payment_proxy_write,
        },
      });
    }
    default:
      return null;
  }
}

/**
 * Boolean test for the auth/credit errors that map to specific HTTP statuses.
 * Exported so external consumers (test helpers, ad-hoc middleware) can match
 * the same set the central handler recognises.
 */
export function isAuthOrCreditsError(err: unknown): boolean {
  return hasAuthOrCreditsName(err);
}

/**
 * Convenience for route catch blocks. Throws an `ApiError` with the right
 * HTTP status if `err` is one of the known auth/credit errors; otherwise
 * no-ops. Wrapping into `ApiError` is required — Hono's `app.onError`
 * ignores non-Error throws, so test mocks that reject with a plain object
 * (or any unusual error shape) would otherwise bypass the central handler.
 *
 * Usage:
 *
 * ```ts
 * } catch (error) {
 *   if (error instanceof ApiError) throw error;
 *   rethrowIfAuthOrCreditsError(error);
 *   console.error("Failed to X:", error);
 *   throw new ApiError(500, "Failed to X");
 * }
 * ```
 */
export function rethrowIfAuthOrCreditsError(err: unknown): void {
  const apiErr = toApiErrorIfAuth(err);
  if (apiErr) throw apiErr;
}

function getMessage(err: unknown, fallback: string): string {
  if (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { message?: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}

export const handleApiError: ErrorHandler = (err, c) => {
  if (err instanceof ApiError) {
    const res = c.json(
      buildBody(err.message, err.details, err.extraBody),
      err.status,
    );
    if (err.headers) {
      for (const [key, value] of Object.entries(err.headers)) {
        res.headers.set(key, value);
      }
    }
    return res;
  }
  if (isErrorWithName(err, "UnauthorizedError")) {
    return c.json(buildBody("Unauthorized"), 401);
  }
  if (isErrorWithName(err, "EmailNotVerifiedError")) {
    return c.json(buildBody("Email verification required"), 403);
  }
  if (isErrorWithName(err, "ForbiddenError")) {
    return c.json(buildBody(getMessage(err, "Forbidden")), 403);
  }
  if (isErrorWithName(err, "InsufficientCreditsError")) {
    const e = err as {
      message?: string;
      creditsRemaining?: number;
      requiredCredits?: number;
    };
    return c.json(
      buildBody(e.message ?? "Insufficient credits", undefined, {
        creditsRemaining: e.creditsRemaining ?? 0,
        requiredCredits:
          e.requiredCredits ?? CREDIT_OPERATION_COST_ATOMIC.payment_proxy_write,
      }),
      402,
    );
  }
  console.error("Unhandled API error:", err);
  return c.json(buildBody("Internal server error"), 500);
};
