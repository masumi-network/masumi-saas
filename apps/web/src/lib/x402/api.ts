"use client";

import { toast } from "sonner";

type X402ApiError = { error?: string; message?: string };

export class X402ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "X402ApiRequestError";
  }
}

export async function x402Fetch<T>(
  path: string,
  init?: RequestInit & { silentErrors?: boolean },
): Promise<T> {
  const { silentErrors, ...requestInit } = init ?? {};
  const headers = new Headers(requestInit.headers);
  if (requestInit.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api/v1/x402${path}`, {
    credentials: "include",
    ...requestInit,
    headers,
  });

  let json: T & X402ApiError;
  try {
    json = (await response.json()) as T & X402ApiError;
  } catch {
    if (!response.ok) {
      const message = `Request failed (${response.status})`;
      if (!silentErrors) toast.error(message);
      throw new X402ApiRequestError(message, response.status);
    }
    throw new X402ApiRequestError("Invalid JSON response", response.status);
  }

  if (!response.ok) {
    const message =
      json.error ?? json.message ?? `Request failed (${response.status})`;
    if (!silentErrors) toast.error(message);
    throw new X402ApiRequestError(message, response.status);
  }

  return json;
}

export async function x402Mutate<T>(
  path: string,
  init: RequestInit,
  options?: { successMessage?: string; errorMessage?: string },
): Promise<T | null> {
  try {
    const result = await x402Fetch<T>(path, init);
    if (options?.successMessage) toast.success(options.successMessage);
    return result;
  } catch {
    if (options?.errorMessage) toast.error(options.errorMessage);
    return null;
  }
}
