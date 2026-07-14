"use client";

import { toast } from "sonner";

import { PAYMENT_NODE_CHAIN_UNSUPPORTED_CODE } from "@/lib/x402/error-codes";

type X402ApiError = {
  error?: string;
  message?: string;
  code?: string;
};

export class X402ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "X402ApiRequestError";
  }
}

function isPaymentNodeChainUnsupported(err: X402ApiRequestError): boolean {
  return (
    err.code === PAYMENT_NODE_CHAIN_UNSUPPORTED_CODE ||
    err.message.toLowerCase().includes("not supported by the payment node")
  );
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
    throw new X402ApiRequestError(message, response.status, json.code);
  }

  return json;
}

export async function x402Mutate<T>(
  path: string,
  init: RequestInit,
  options?: {
    successMessage?: string;
    errorMessage?: string;
    /** i18n message when the payment node does not support the chain. */
    paymentNodeUnsupportedMessage?: string;
  },
): Promise<T | null> {
  try {
    // When x402Mutate shows its own error toast, silence x402Fetch's so a single
    // failure doesn't surface two toasts; otherwise let x402Fetch show the server message.
    const result = await x402Fetch<T>(path, {
      ...init,
      silentErrors: Boolean(options?.errorMessage),
    });
    if (options?.successMessage) toast.success(options.successMessage);
    return result;
  } catch (err) {
    if (err instanceof X402ApiRequestError) {
      if (
        isPaymentNodeChainUnsupported(err) &&
        options?.paymentNodeUnsupportedMessage
      ) {
        toast.error(options.paymentNodeUnsupportedMessage);
      } else if (options?.errorMessage) {
        toast.error(options.errorMessage);
      }
    } else if (options?.errorMessage) {
      toast.error(options.errorMessage);
    }
    return null;
  }
}
