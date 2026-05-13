function getRegistryServiceBaseUrl(): string {
  const url = process.env.REGISTRY_SERVICE_BASE_URL;
  if (!url?.trim()) {
    throw new Error(
      "REGISTRY_SERVICE_BASE_URL is required for registry service integration",
    );
  }
  return url.replace(/\/$/, "");
}

function getRegistryServiceApiKey(): string {
  const key = process.env.REGISTRY_SERVICE_API_KEY;
  if (!key?.trim()) {
    throw new Error(
      "REGISTRY_SERVICE_API_KEY is required for registry service integration",
    );
  }
  return key;
}

function getRegistryServiceOpenApiUrl(): string {
  return (
    process.env.REGISTRY_SERVICE_OPENAPI_URL?.trim() ||
    "https://registry.masumi.network/api-docs"
  );
}

export function isRegistryServiceConfigured(): boolean {
  try {
    getRegistryServiceBaseUrl();
    getRegistryServiceApiKey();
    return true;
  } catch {
    return false;
  }
}

export const registryServiceConfig = {
  getBaseUrl: getRegistryServiceBaseUrl,
  getApiKey: getRegistryServiceApiKey,
  getOpenApiUrl: getRegistryServiceOpenApiUrl,
  isConfigured: isRegistryServiceConfigured,
} as const;
