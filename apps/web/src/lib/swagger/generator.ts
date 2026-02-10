import {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

import { z } from "./zod-openapi";

const registry = new OpenAPIRegistry();

const AgentSchema = registry.register(
  "Agent",
  z.object({
    id: z.string().openapi({ example: "cmlf6gswz0000x1uctad958tq" }),
    name: z.string().openapi({ example: "My AI Agent" }),
    description: z
      .string()
      .openapi({ example: "A payment processing agent on the Masumi network" }),
    apiUrl: z.string().openapi({ example: "https://my-agent.example.com" }),
    verificationStatus: z
      .enum(["PENDING", "APPROVED", "REJECTED", "REVIEW"])
      .openapi({
        example: "APPROVED",
        description:
          "Current verification status of the agent on the Masumi network",
      }),
    veridianCredentialId: z.string().nullable().openapi({
      example: "EL9oOWU_7zQn_rD--Xsgi3giCWnFDaNvFMUGTOZx1ARO",
      description: "Veridian KERI credential ID, present when APPROVED",
    }),
    tags: z.array(z.string()).openapi({ example: ["payments", "ai"] }),
    createdAt: z
      .string()
      .openapi({ format: "date-time", example: "2026-01-26T10:00:00.000Z" }),
    updatedAt: z
      .string()
      .openapi({ format: "date-time", example: "2026-01-26T12:00:00.000Z" }),
  }),
);

const errorResponses = {
  400: { description: "Bad Request — invalid query parameters" },
  429: {
    description:
      "Too Many Requests — rate limit exceeded. Check Retry-After header.",
  },
  500: { description: "Internal Server Error" },
} as const;

registry.registerPath({
  method: "get",
  path: "/agents",
  tags: ["Agents"],
  summary: "List agents",
  description:
    "Returns a list of agents filtered by verification status. Defaults to APPROVED agents only. No authentication required.",
  request: {
    query: z.object({
      status: z
        .enum(["PENDING", "APPROVED", "REJECTED", "REVIEW"])
        .optional()
        .openapi({
          description:
            "Filter by verification status. Defaults to APPROVED if not specified.",
          example: "APPROVED",
        }),
    }),
  },
  responses: {
    200: {
      description: "List of agents",
      content: {
        "application/json": {
          schema: z
            .object({
              success: z.literal(true),
              data: z.array(AgentSchema),
            })
            .openapi({
              example: {
                success: true,
                data: [
                  {
                    id: "cmlf6gswz0000x1uctad958tq",
                    name: "My AI Agent",
                    description:
                      "A payment processing agent on the Masumi network",
                    apiUrl: "https://my-agent.example.com",
                    verificationStatus: "APPROVED",
                    veridianCredentialId:
                      "EL9oOWU_7zQn_rD--Xsgi3giCWnFDaNvFMUGTOZx1ARO",
                    tags: ["payments", "ai"],
                    createdAt: "2026-01-26T10:00:00.000Z",
                    updatedAt: "2026-01-26T12:00:00.000Z",
                  },
                ],
              },
            }),
        },
      },
    },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/agents/{agentId}",
  tags: ["Agents"],
  summary: "Get agent by ID",
  description:
    "Returns a single agent by its ID. Returns all verification statuses (not filtered to APPROVED). No authentication required.",
  request: {
    params: z.object({
      agentId: z.string().openapi({
        description: "The unique agent ID (CUID)",
        example: "cmlf6gswz0000x1uctad958tq",
      }),
    }),
  },
  responses: {
    200: {
      description: "Agent found",
      content: {
        "application/json": {
          schema: z
            .object({
              success: z.literal(true),
              data: AgentSchema,
            })
            .openapi({
              example: {
                success: true,
                data: {
                  id: "cmlf6gswz0000x1uctad958tq",
                  name: "My AI Agent",
                  description:
                    "A payment processing agent on the Masumi network",
                  apiUrl: "https://my-agent.example.com",
                  verificationStatus: "APPROVED",
                  veridianCredentialId:
                    "EL9oOWU_7zQn_rD--Xsgi3giCWnFDaNvFMUGTOZx1ARO",
                  tags: ["payments", "ai"],
                  createdAt: "2026-01-26T10:00:00.000Z",
                  updatedAt: "2026-01-26T12:00:00.000Z",
                },
              },
            }),
        },
      },
    },
    404: { description: "Agent not found" },
    ...errorResponses,
  },
});

export function generateOpenAPISpec() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "Masumi Agent Verification API",
      description:
        "Public API for looking up agent verification status on the Masumi network.",
      contact: {
        name: "Masumi Network",
        url: "https://masumi.network",
      },
    },
    servers: [
      {
        url: "/api/v1",
        description: "Current environment",
      },
    ],
  });
}
