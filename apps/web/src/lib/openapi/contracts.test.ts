import { describe, expect, it } from "vitest";

import { z } from "@/lib/zod-openapi";

import {
  contractErrorResponse,
  contractJsonResponse,
  defineRouteContract,
  jsonResponse,
} from "./contracts";

const contract = defineRouteContract({
  documents: ["platform"],
  operations: {
    GET: {
      responses: {
        200: jsonResponse(
          "OK",
          z.object({
            success: z.literal(true),
            data: z.object({ id: z.string() }),
          }),
        ),
        400: jsonResponse(
          "Bad request",
          z.object({
            success: z.literal(false),
            error: z.string(),
            details: z.array(z.string()).optional(),
          }),
        ),
        500: jsonResponse(
          "Server error",
          z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        ),
      },
    },
  },
});

describe("contractJsonResponse", () => {
  it("returns validated success payloads", async () => {
    const response = contractJsonResponse(contract, "GET", 200, {
      success: true,
      data: { id: "agent-1" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { id: "agent-1" },
    });
  });

  it("returns documented 400 payloads for error responses", async () => {
    const response = contractErrorResponse(
      contract,
      "GET",
      400,
      "Invalid request",
      ["Missing id"],
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Invalid request",
      details: ["Missing id"],
    });
  });

  it("surfaces response-schema mismatches as a 500", async () => {
    const response = contractJsonResponse(contract, "GET", 200, {
      success: true,
      data: { missingId: true },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Response validation failed",
    });
  });
});
