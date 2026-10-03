import "server-only";

import { serverLog } from "@/lib/server/logger";

/** Enable verbose DigitalOcean / prod diagnostics in runtime logs. */
export function isDoRuntimeDebugLoggingEnabled(): boolean {
  const normalized = process.env.DEBUG_DO_RUNTIME_LOGS?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function doRuntimeDebugLog(
  scope: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (!isDoRuntimeDebugLoggingEnabled()) return;
  serverLog.warn(`[DO debug][${scope}] ${message}`, meta);
}

export function serializeErrorForLog(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      ...(err.cause !== undefined ? { cause: String(err.cause) } : {}),
    };
  }
  return { value: String(err) };
}
