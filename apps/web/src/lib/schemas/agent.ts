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

export const registerAgentBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(250, "Name must be less than 250 characters"),
  summary: z
    .string()
    .max(250, "Summary must be 250 characters or less")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(5000, "Description must be less than 5000 characters")
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
  authorName: z.string().max(250).optional().or(z.literal("")),
  authorEmail: z.union([z.literal(""), z.string().email().max(250)]).optional(),
  organization: z.string().max(250).optional().or(z.literal("")),
  contactOther: z.string().max(250).optional().or(z.literal("")),
  termsOfUseUrl: z.union([z.literal(""), z.string().url().max(250)]).optional(),
  privacyPolicyUrl: z
    .union([z.literal(""), z.string().url().max(250)])
    .optional(),
  otherUrl: z.union([z.literal(""), z.string().url().max(250)]).optional(),
  capabilityName: z.string().max(250).optional().or(z.literal("")),
  capabilityVersion: z.string().max(250).optional().or(z.literal("")),
  exampleOutputs: z.array(exampleOutputSchema).optional(),
});

/** Minimal schema for form-based registration (server actions) */
const registerAgentFormBaseSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(250, "Name must be less than 250 characters"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(5000, "Description must be less than 5000 characters"),
  apiUrl: z
    .string()
    .url("API URL must be a valid URL")
    .refine((val) => val.startsWith("http://") || val.startsWith("https://"), {
      message: "API URL must start with http:// or https://",
    }),
  tags: z.string().optional(),
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
