import { NextResponse } from "next/server";

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
): NextResponse {
  const body: { success: false; error: string; details?: unknown } = {
    success: false,
    error: message,
  };
  if (details !== undefined) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}
