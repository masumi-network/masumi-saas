import { NEW_LANGDOCK_CONNECTION } from "@/components/integrations/langdock-connection-fields";
import { parseBatchResourceUrlsInput } from "@/lib/x402/parse-batch-resource-urls";

import type { RegisterAgentFormType } from "./register-agent-form-model";
import type { X402OptionDraft } from "./x402-options-section";

// Maps reviewed form values to the POST /api/agents request body.
export function buildRegisterAgentRequestBody(
  data: RegisterAgentFormType,
  {
    tags,
    x402Options,
    defaultPricingAssetId,
  }: {
    tags: string[];
    x402Options: X402OptionDraft[];
    defaultPricingAssetId: string;
  },
) {
  const exampleOutputs = (data.exampleOutputs ?? []).filter(
    (e) => e.name?.trim() && e.url?.trim() && e.mimeType?.trim(),
  );

  const pricingBody =
    data.pricingType === "Free"
      ? { pricingType: "Free" as const }
      : data.pricingType === "Dynamic"
        ? { pricingType: "Dynamic" as const }
        : {
            pricingType: "Fixed" as const,
            prices: (data.prices ?? [])
              .filter((p) => p.amount?.trim())
              .map((p) => ({
                amount: p.amount.trim(),
                currency: p.asset?.trim() || defaultPricingAssetId,
              })),
          };

  const evmSupportedSources =
    data.pricingType === "Fixed"
      ? x402Options.map((option) => ({
          chain: "EVM" as const,
          network: option.caip2Network,
          scheme: "Exact" as const,
          payTo: option.payTo,
          ...(option.resource.trim()
            ? { resource: option.resource.trim() }
            : {}),
          pricing: {
            pricingType: "Fixed" as const,
            fixed: [
              {
                asset: option.asset,
                amount: option.amount,
                decimals: Number(option.decimals),
              },
            ],
          },
        }))
      : [];

  return {
    registrationKind: data.registrationKind,
    ...(data.registrationKind === "X402_HTTP"
      ? {
          x402ResourceUrl:
            parseBatchResourceUrlsInput(data.x402ResourceUrl?.trim() ?? "")
              .urls[0] ?? data.x402ResourceUrl?.trim(),
        }
      : {}),
    runtimeProvider: data.runtimeProvider,
    name: data.name,
    description: data.description?.trim() ?? "",
    apiUrl:
      data.registrationKind === "STANDARD" &&
      data.runtimeProvider === "DIRECT_MIP"
        ? data.apiUrl
        : undefined,
    integrationConnectionId:
      data.runtimeProvider === "LANGDOCK" &&
      data.integrationConnectionId !== NEW_LANGDOCK_CONNECTION
        ? data.integrationConnectionId
        : undefined,
    langdockApiKey:
      data.runtimeProvider === "LANGDOCK" &&
      data.integrationConnectionId === NEW_LANGDOCK_CONNECTION
        ? data.langdockApiKey
        : undefined,
    langdockAgentId:
      data.runtimeProvider === "LANGDOCK" ? data.langdockAgentId : undefined,
    langdockBaseUrl:
      data.runtimeProvider === "LANGDOCK" ? data.langdockBaseUrl : undefined,
    tags: tags.join(", "),
    icon: data.icon?.trim() ?? "",
    pricing:
      data.registrationKind === "X402_HTTP"
        ? { pricingType: "Free" as const }
        : pricingBody,
    termsOfUseUrl: data.termsOfUseUrl?.trim() ?? "",
    privacyPolicyUrl: data.privacyPolicyUrl?.trim() ?? "",
    otherUrl: data.otherUrl?.trim() ?? "",
    capabilityName: data.capabilityName?.trim() ?? "",
    capabilityVersion: data.capabilityVersion?.trim() ?? "",
    exampleOutputs:
      data.registrationKind === "X402_HTTP"
        ? undefined
        : exampleOutputs.length > 0
          ? exampleOutputs
          : undefined,
    ...(data.pricingType !== "Free" && data.payoutAddress.trim()
      ? { payoutAddress: data.payoutAddress.trim() }
      : {}),
    ...(data.registrationKind === "STANDARD" && evmSupportedSources.length > 0
      ? { supportedPaymentSources: evmSupportedSources }
      : {}),
  };
}
