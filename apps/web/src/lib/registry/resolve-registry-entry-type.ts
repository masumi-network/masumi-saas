import type {
  RegistryEntry,
  RegistryEntryType,
} from "@/lib/payment-node/schemas";

export function resolveRegistryEntryType(
  registryEntry: Pick<
    RegistryEntry,
    "type" | "x402ResourcesUrl" | "openApiSpecUrl" | "apiBaseUrl"
  >,
): RegistryEntryType {
  if (registryEntry.type) {
    return registryEntry.type;
  }
  if (registryEntry.x402ResourcesUrl?.trim()) {
    return "X402";
  }
  if (registryEntry.openApiSpecUrl?.trim()) {
    return "OpenApi";
  }
  return "Standard";
}
