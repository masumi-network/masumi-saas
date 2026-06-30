/**
 * Shared schemas + reusable response fragments for the public-v1 (`/api/v1/*`)
 * discovery surface. Used by the per-route Hono apps in
 * `src/app/api/v1/agents/**`. The actual OpenAPI document is now assembled by
 * `src/lib/openapi/aggregate-spec.ts`.
 */

import { agentVerifyQuerySchema as _agentVerifyQuerySchema } from "@/lib/schemas";

import { z } from "./zod-openapi";

// Re-exported so legacy import paths keep resolving while v1 routes migrate.
export const agentVerifyQuerySchema = _agentVerifyQuerySchema;

export const AgentSchema = z
  .object({
    id: z.string().openapi({ example: "cmlf6gswz0000x1uctad958tq" }),
    name: z.string().openapi({ example: "My AI Agent" }),
    description: z
      .string()
      .openapi({ example: "A payment processing agent on the Masumi network" }),
    apiUrl: z.string().openapi({
      example: "https://my-agent.example.com",
      description:
        "Agent API base URL. In production it must be a public HTTPS endpoint.",
    }),
    verificationStatus: z
      .enum(["PENDING", "VERIFIED", "REVOKED", "EXPIRED"])
      .openapi({
        example: "VERIFIED",
        description:
          "Agent verification status (credential-based). PENDING = not yet verified, VERIFIED = credential validated, REVOKED/EXPIRED = credential state.",
      }),
    veridianCredentialId: z.string().nullable().openapi({
      example: "EL9oOWU_7zQn_rD--Xsgi3giCWnFDaNvFMUGTOZx1ARO",
      description: "Veridian KERI credential ID, present when VERIFIED",
    }),
    tags: z.array(z.string()).openapi({ example: ["payments", "ai"] }),
    createdAt: z
      .string()
      .openapi({ format: "date-time", example: "2026-01-26T10:00:00.000Z" }),
    updatedAt: z
      .string()
      .openapi({ format: "date-time", example: "2026-01-26T12:00:00.000Z" }),
  })
  .openapi("Agent");

export const verifyAgentResultSchema = z
  .union([
    z.object({
      success: z.literal(true),
      data: z.object({
        verified: z.literal(false),
      }),
    }),
    z.object({
      success: z.literal(true),
      data: z.object({
        verified: z.boolean(),
        credentialId: z.string(),
        expiresAt: z.string().nullable(),
        agentName: z.string(),
        apiUrl: z.string(),
      }),
    }),
  ])
  .openapi({
    description:
      "Returns `verified: false` when the agent identifier is unknown, has no valid on-chain or database verification, or only has an expired credential. Expired credentials still include their metadata in the response.",
    example: {
      success: true,
      data: {
        verified: true,
        credentialId: "EL9oOWU_7zQn_rD--Xsgi3giCWnFDaNvFMUGTOZx1ARO",
        expiresAt: "2026-12-31T23:59:59.000Z",
        agentName: "My AI Agent",
        apiUrl: "https://my-agent.example.com",
      },
    },
  });

export const errorResponses = {
  400: { description: "Bad Request — invalid query parameters" },
  429: {
    description:
      "Too Many Requests — rate limit exceeded. Check Retry-After header.",
  },
  500: { description: "Internal Server Error" },
} as const;
