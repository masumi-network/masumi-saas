export function extractErrorMessage(
  error: unknown,
  fallback: string = "An error occurred",
): string {
  if (!error) return fallback;

  if (typeof error === "string") return error;

  if (error instanceof Error) return error.message;

  if (typeof error === "object") {
    const err = error as Record<string, unknown>;

    if (typeof err.message === "string") return err.message;
    if (typeof err.error === "string") return err.error;
    if (err.error != null && typeof err.error === "object") {
      const nested = err.error as Record<string, unknown>;
      if (typeof nested.message === "string") return nested.message;
    }
    if (typeof err.statusText === "string") return err.statusText;

    if (err.data && typeof err.data === "object") {
      const data = err.data as Record<string, unknown>;
      if (typeof data.message === "string") return data.message;
      if (typeof data.error === "string") return data.error;
    }

    try {
      const stringified = JSON.stringify(error);
      if (stringified && stringified !== "{}") {
        return stringified.length > 200
          ? stringified.substring(0, 200) + "..."
          : stringified;
      }
    } catch {
      /* ignore */
    }
  }

  return fallback;
}
