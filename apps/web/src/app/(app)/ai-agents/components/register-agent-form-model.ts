import { isCardanoAddressForNetwork } from "@masumi/payment-source-x402/payment-source";
import { z } from "zod";

import { NEW_LANGDOCK_CONNECTION } from "@/components/integrations/langdock-connection-fields";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { normalizePayoutAddress } from "@/lib/payment-node/payout-address";
import {
  hasMultipleX402ResourceUrlsInInput,
  MAX_BATCH_RESOURCE_URLS,
  parseBatchResourceUrlsInput,
} from "@/lib/x402/parse-batch-resource-urls";

import type { X402OptionDraft } from "./x402-options-section";

export type RuntimeProvider = "DIRECT_MIP" | "LANGDOCK";
export type RegistrationKind = "STANDARD" | "X402_HTTP";
export type PricingMode = "Free" | "Fixed" | "Dynamic";

export const X402_REGISTRY_CAIP2_IDS = ["eip155:84532", "eip155:8453"] as const;

export type RegisterAgentDialogStep = "form" | "review";

export type X402ProbeViewState =
  | { status: "idle" }
  | { status: "checking"; key: string }
  | { status: "valid"; key: string }
  | { status: "invalid"; key: string; message: string };

export type AgentFormFields = {
  name: string;
  description?: string;
  pricingType: PricingMode;
  prices: Array<{ amount: string; asset: string }>;
  tags?: string;
  icon?: string;
  authorName?: string;
  authorEmail?: string;
  organization?: string;
  contactOther?: string;
  termsOfUseUrl?: string;
  privacyPolicyUrl?: string;
  otherUrl?: string;
  capabilityName?: string;
  capabilityVersion?: string;
  exampleOutputs?: Array<{ name: string; url: string; mimeType: string }>;
};

export type RegisterAgentFormType = AgentFormFields & {
  registrationKind: RegistrationKind;
  x402ResourceUrl: string;
  runtimeProvider: RuntimeProvider;
  apiUrl: string;
  integrationConnectionId: string;
  langdockApiKey: string;
  langdockAgentId: string;
  langdockBaseUrl: string;
  payoutAddress: string;
};

export type RegisterAgentTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function buildX402ResourceProbeKey(
  paymentNetwork: string,
  resourceUrl: string,
) {
  return `${paymentNetwork}|${resourceUrl.trim()}`;
}

export function isProbeableResourceUrl(resourceUrl: string) {
  try {
    const url = new URL(resourceUrl.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function trimmedField(value: string | undefined): string {
  return (value ?? "").trim();
}

function baselinePricingTypeForKind(kind: RegistrationKind): PricingMode {
  return kind === "X402_HTTP" ? "Free" : "Fixed";
}

export function registerFormHasMeaningfulDraft(
  values: RegisterAgentFormType,
  tags: string[],
  tagInput: string,
  x402Options: X402OptionDraft[],
): boolean {
  if (tags.length > 0 || tagInput.trim().length > 0) return true;
  if (x402Options.length > 0) return true;

  if (trimmedField(values.name)) return true;
  if (trimmedField(values.description)) return true;

  if (values.registrationKind === "X402_HTTP") {
    if (trimmedField(values.x402ResourceUrl)) return true;
  } else if (trimmedField(values.apiUrl)) return true;

  if (
    values.pricingType !== baselinePricingTypeForKind(values.registrationKind)
  ) {
    return true;
  }
  if (trimmedField(values.payoutAddress)) return true;

  const prices = values.prices ?? [];
  if (prices.length > 1) return true;
  if (prices.some((price) => trimmedField(price.amount))) return true;

  if (trimmedField(values.termsOfUseUrl)) return true;
  if (trimmedField(values.privacyPolicyUrl)) return true;
  if (trimmedField(values.otherUrl)) return true;
  if (trimmedField(values.capabilityName)) return true;
  if (trimmedField(values.capabilityVersion)) return true;

  const outputs = values.exampleOutputs ?? [];
  if (
    outputs.some(
      (output) =>
        trimmedField(output.name) ||
        trimmedField(output.url) ||
        trimmedField(output.mimeType),
    )
  ) {
    return true;
  }

  if (values.icon && values.icon !== "bot") return true;

  if (values.runtimeProvider === "LANGDOCK") {
    if (values.integrationConnectionId === NEW_LANGDOCK_CONNECTION) {
      if (trimmedField(values.langdockApiKey)) return true;
      if (trimmedField(values.langdockAgentId)) return true;
      if (trimmedField(values.langdockBaseUrl)) return true;
    }
  }

  return false;
}

// Values passed to form.reset after a submit or close. They carry no payoutAddress, as before the split.
export function buildRegisterAgentResetValues(
  registrationKind: RegistrationKind,
  defaultPricingAssetId: string,
) {
  return {
    registrationKind,
    x402ResourceUrl: "",
    name: "",
    description: "",
    runtimeProvider: "DIRECT_MIP" as const,
    apiUrl: "",
    integrationConnectionId: NEW_LANGDOCK_CONNECTION,
    langdockApiKey: "",
    langdockAgentId: "",
    langdockBaseUrl: "",
    pricingType: "Fixed" as const,
    prices: [{ amount: "", asset: defaultPricingAssetId }],
    tags: "",
    icon: "bot",
    termsOfUseUrl: "",
    privacyPolicyUrl: "",
    otherUrl: "",
    capabilityName: "",
    capabilityVersion: "",
    exampleOutputs: [],
  };
}

export function buildRegisterAgentDefaultValues(
  registrationKind: RegistrationKind,
  defaultPricingAssetId: string,
): RegisterAgentFormType {
  return {
    ...buildRegisterAgentResetValues(registrationKind, defaultPricingAssetId),
    payoutAddress: "",
  };
}

export function buildRegisterAgentSchema(
  t: RegisterAgentTranslate,
  network: PaymentNodeNetwork,
) {
  return z
    .object({
      registrationKind: z.enum(["STANDARD", "X402_HTTP"]),
      x402ResourceUrl: z.string().optional().or(z.literal("")),
      name: z.string().min(1, t("nameRequired")).max(250, t("nameMaxLength")),
      description: z
        .string()
        .max(250, t("descriptionMaxLength"))
        .optional()
        .or(z.literal("")),
      runtimeProvider: z.enum(["DIRECT_MIP", "LANGDOCK"]),
      apiUrl: z.string().optional().or(z.literal("")),
      integrationConnectionId: z.string().optional().or(z.literal("")),
      langdockApiKey: z.string().optional().or(z.literal("")),
      langdockAgentId: z.string().optional().or(z.literal("")),
      langdockBaseUrl: z
        .union([z.literal(""), z.string().url().max(250)])
        .optional(),
      pricingType: z.enum(["Free", "Fixed", "Dynamic"]),
      prices: z.array(
        z.object({
          amount: z.string(),
          asset: z.string(),
        }),
      ),
      tags: z.string().optional(),
      icon: z.string().max(2000).optional(),
      termsOfUseUrl: z
        .union([z.literal(""), z.string().url().max(250)])
        .optional(),
      privacyPolicyUrl: z
        .union([z.literal(""), z.string().url().max(250)])
        .optional(),
      otherUrl: z.union([z.literal(""), z.string().url().max(250)]).optional(),
      capabilityName: z.string().max(250).optional(),
      capabilityVersion: z.string().max(250).optional(),
      exampleOutputs: z
        .array(
          z.object({
            name: z.string().max(60),
            url: z.string(),
            mimeType: z.string().max(60),
          }),
        )
        .optional(),
      payoutAddress: z.string().optional().or(z.literal("")),
    })
    .refine(
      (data) => {
        if (data.registrationKind === "X402_HTTP") return true;
        if (data.pricingType !== "Fixed") return true;
        const filled = (data.prices ?? []).filter((p) => p.amount?.trim());
        return filled.length > 0;
      },
      { message: t("priceAmountRequired"), path: ["prices"] },
    )
    .superRefine((data, ctx) => {
      if (data.registrationKind === "X402_HTTP") {
        const raw = data.x402ResourceUrl?.trim() ?? "";
        if (!raw) {
          ctx.addIssue({
            code: "custom",
            message: t("x402ResourceUrlRequired"),
            path: ["x402ResourceUrl"],
          });
          return;
        }
        const parsed = parseBatchResourceUrlsInput(raw);
        if (parsed.urls.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: t("x402ResourceUrlInvalid"),
            path: ["x402ResourceUrl"],
          });
          return;
        }
        if (hasMultipleX402ResourceUrlsInInput(raw)) {
          ctx.addIssue({
            code: "custom",
            message: t("x402MultipleResourcesBlocked"),
            path: ["x402ResourceUrl"],
          });
          return;
        }
        if (parsed.urls.length > MAX_BATCH_RESOURCE_URLS) {
          ctx.addIssue({
            code: "custom",
            message: t("x402ResourceUrlBatchMax", {
              max: MAX_BATCH_RESOURCE_URLS,
            }),
            path: ["x402ResourceUrl"],
          });
        }
        return;
      }

      if (data.runtimeProvider === "DIRECT_MIP") {
        const apiUrl = data.apiUrl?.trim() ?? "";
        try {
          const url = new URL(apiUrl);
          if (url.protocol !== "http:" && url.protocol !== "https:") {
            ctx.addIssue({
              code: "custom",
              message: t("apiUrlProtocol"),
              path: ["apiUrl"],
            });
          }
        } catch {
          ctx.addIssue({
            code: "custom",
            message: t("apiUrlInvalid"),
            path: ["apiUrl"],
          });
        }
      }

      if (data.runtimeProvider === "LANGDOCK") {
        if (!data.langdockAgentId?.trim()) {
          ctx.addIssue({
            code: "custom",
            message: t("langdockAgentIdRequired"),
            path: ["langdockAgentId"],
          });
        }
        const usingSaved =
          data.integrationConnectionId &&
          data.integrationConnectionId !== NEW_LANGDOCK_CONNECTION;
        if (!usingSaved && !data.langdockApiKey?.trim()) {
          ctx.addIssue({
            code: "custom",
            message: t("langdockApiKeyRequired"),
            path: ["langdockApiKey"],
          });
        }
      }

      const payoutAddress = normalizePayoutAddress(data.payoutAddress ?? "");
      if (data.pricingType !== "Free") {
        if (!payoutAddress) {
          ctx.addIssue({
            code: "custom",
            message: t("payoutAddressRequired"),
            path: ["payoutAddress"],
          });
        } else if (!isCardanoAddressForNetwork(payoutAddress, network)) {
          ctx.addIssue({
            code: "custom",
            message:
              network === "Mainnet"
                ? t("payoutAddressInvalidMainnet")
                : t("payoutAddressInvalidPreprod"),
            path: ["payoutAddress"],
          });
        }
      }
    });
}
