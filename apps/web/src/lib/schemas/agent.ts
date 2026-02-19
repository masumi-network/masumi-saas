import { z } from "zod";
import { zfd } from "zod-form-data";

/**
 * Shared agent validation schema — used by both server actions and API routes.
 * Keep in sync with Prisma Agent model constraints.
 */
export const registerAgentBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(250, "Name must be less than 250 characters"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(1000, "Description must be less than 1000 characters"),
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
  registerAgentBodySchema,
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
