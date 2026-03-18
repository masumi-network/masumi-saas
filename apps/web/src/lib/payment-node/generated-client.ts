/**
 * Generated payment node API client.
 * Uses openapi-fetch with types from payment-node-openapi.json.
 */

import createClient from "openapi-fetch";

import type { paths } from "./generated/paths";

export type PaymentNodePaths = paths;

export function createPaymentNodeFetchClient(baseUrl: string, token: string) {
  const client = createClient<paths>({
    baseUrl: baseUrl.replace(/\/$/, ""),
    headers: {
      token,
      "Content-Type": "application/json",
    },
  });
  return client;
}

export type PaymentNodeFetchClient = ReturnType<
  typeof createPaymentNodeFetchClient
>;
