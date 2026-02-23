export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  const record = error as Record<string, unknown> | null;
  if (record?.message && typeof record.message === "string")
    return record.message;
  return fallback;
}
