import createClient from "openapi-fetch";

import type { paths } from "./generated/paths";

export type RegistryServicePaths = paths;

export function createRegistryServiceFetchClient(
  baseUrl: string,
  token: string,
) {
  const client = createClient<paths>({
    baseUrl: baseUrl.replace(/\/$/, ""),
    headers: {
      token,
      "Content-Type": "application/json",
    },
  });
  return client;
}

export type RegistryServiceFetchClient = ReturnType<
  typeof createRegistryServiceFetchClient
>;
