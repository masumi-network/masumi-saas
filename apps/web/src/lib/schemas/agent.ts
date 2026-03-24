import { z } from "zod";
import { zfd } from "zod-form-data";

/**
 * Shared agent validation schema — used by both server actions and API routes.
 * Keep in sync with Prisma Agent model constraints.
 */
const exampleOutputSchema = z.object({
  name: z.string().max(60).min(1),
  url: z.string().url().min(1),
  mimeType: z.string().max(60).min(1),
});

/**
 * Schema for agent.metadata JSON. Only allowed keys are accepted to prevent
 * metadata injection. Used when parsing stored metadata in API responses.
 */
export const agentMetadataSchema = z
  .object({
    authorName: z.string().optional(),
    authorEmail: z.string().optional(),
    organization: z.string().optional(),
    contactOther: z.string().optional(),
    termsOfUseUrl: z.string().optional(),
    privacyPolicyUrl: z.string().optional(),
    otherUrl: z.string().optional(),
    capabilityName: z.string().optional(),
    capabilityVersion: z.string().optional(),
    exampleOutputs: z.array(exampleOutputSchema).optional(),
  })
  .strict();

export const registerAgentBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(250, "Name must be less than 250 characters"),
  description: z
    .string()
    .max(250, "Description must be 250 characters or less")
    .optional()
    .or(z.literal("")),
  extendedDescription: z
    .string()
    .max(5000, "Extended description must be less than 5000 characters")
    .optional()
    .or(z.literal("")),
  apiUrl: z
    .string()
    .url("API URL must be a valid URL")
    .refine((val) => val.startsWith("http://") || val.startsWith("https://"), {
      message: "API URL must start with http:// or https://",
    }),
  tags: z.string().optional(),
  icon: z.string().max(2000).optional(),
  pricing: z
    .object({
      pricingType: z.enum(["Free", "Fixed"]),
      prices: z
        .array(
          z.object({
            amount: z.string(),
            currency: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  termsOfUseUrl: z.union([z.literal(""), z.string().url().max(250)]).optional(),
  privacyPolicyUrl: z
    .union([z.literal(""), z.string().url().max(250)])
    .optional(),
  otherUrl: z.union([z.literal(""), z.string().url().max(250)]).optional(),
  capabilityName: z.string().max(250).optional().or(z.literal("")),
  capabilityVersion: z.string().max(250).optional().or(z.literal("")),
  exampleOutputs: z.array(exampleOutputSchema).optional(),
});

/** GET /api/agents query — shared with OpenAPI (`saas-app-openapi`). */
export const agentsListQuerySchema = z.object({
  verificationStatus: z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(z.enum(["PENDING", "VERIFIED", "REVOKED", "EXPIRED"]))
    .optional(),
  unverified: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  cursor: z.string().optional(),
  take: z.coerce.number().int().min(1).max(50).optional().default(10),
  registrationState: z.string().optional(),
  registrationStateIn: z.string().optional(),
  search: z.string().optional(),
  network: z.enum(["Mainnet", "Preprod"]).optional(),
});

/** POST /api/agents/{agentId}/verify JSON body — shared with OpenAPI. */
export const verifyAgentBodySchema = z.object({
  aid: z.string().min(1, "AID is required"),
  schemaSaid: z.string().optional(),
});

/** Full schema for form-based registration (server actions).
 * Nested structures (prices, exampleOutputs) are serialised as JSON strings
 * because FormData is a flat key/value structure.
 */
const registerAgentFormBaseSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(250, "Name must be less than 250 characters"),
  description: z.string().max(250).optional().or(z.literal("")),
  extendedDescription: z
    .string()
    .max(5000, "Extended description must be less than 5000 characters")
    .optional()
    .or(z.literal("")),
  apiUrl: z
    .string()
    .url("API URL must be a valid URL")
    .refine((val) => val.startsWith("http://") || val.startsWith("https://"), {
      message: "API URL must start with http:// or https://",
    }),
  tags: z.string().optional(),
  icon: z.string().max(2000).optional().or(z.literal("")),
  /** "Free" | "Fixed" */
  pricingType: z.enum(["Free", "Fixed"]).optional(),
  /** JSON-encoded Array<{ amount: string; currency: string }> */
  prices: z.string().optional(),
  termsOfUseUrl: z.union([z.literal(""), z.string().url().max(250)]).optional(),
  privacyPolicyUrl: z
    .union([z.literal(""), z.string().url().max(250)])
    .optional(),
  otherUrl: z.union([z.literal(""), z.string().url().max(250)]).optional(),
  capabilityName: z.string().max(250).optional().or(z.literal("")),
  capabilityVersion: z.string().max(250).optional().or(z.literal("")),
  /** JSON-encoded Array<{ name: string; url: string; mimeType: string }> */
  exampleOutputs: z.string().optional(),
});

/** FormData variant for server actions */
export const registerAgentFormDataSchema = zfd.formData(
  registerAgentFormBaseSchema,
);

/**
 * Prisma select object for public agent API responses.
 * Excludes private fields (userId, metadata).
 */
export const publicAgentSelect = {
  id: true,
  name: true,
  description: true,
  apiUrl: true,
  verificationStatus: true,
  veridianCredentialId: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Default pagination limits */
export const AGENT_PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
} as const;

/** Pagination query schema for agent list endpoints */
export const agentPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(AGENT_PAGINATION.MAX_LIMIT)
    .default(AGENT_PAGINATION.DEFAULT_LIMIT),
});
