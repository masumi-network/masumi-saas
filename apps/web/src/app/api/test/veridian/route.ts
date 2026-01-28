import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  fetchContactCredentials,
  findCredentialBySchema,
  formatCredential,
  getAgentVerificationSchemaSaid,
  validateCredential,
} from "@/lib/veridian";

const testSchema = z.object({
  aid: z.string().min(1, "AID is required"),
  schemaSaid: z.string().optional(),
});

/**
 * Test endpoint for Veridian credential server integration
 * GET /api/test/veridian?aid={aid}&schemaSaid={schemaSaid}
 *
 * This endpoint allows testing the Veridian client functionality:
 * - Fetches credentials for a KERI identifier (AID)
 * - Optionally finds a specific credential by schema SAID
 * - Formats and validates credentials
 *
 * Example:
 * GET /api/test/veridian?aid=EGDR4TZaEvYDstjZJCITD3YgGWZ-zRNqG6jJDR6o8ErB
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const aid = searchParams.get("aid");
    const schemaSaid = searchParams.get("schemaSaid");

    // Validate input
    const validation = testSchema.safeParse({
      aid,
      schemaSaid: schemaSaid || undefined,
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid parameters",
          details: validation.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const { aid: validatedAid, schemaSaid: validatedSchemaSaid } =
      validation.data;

    // Fetch credentials
    const credentials = await fetchContactCredentials(validatedAid);

    if (credentials.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No credentials found for this AID",
        data: {
          aid: validatedAid,
          credentialsCount: 0,
          credentials: [],
        },
      });
    }

    // If schemaSaid is provided, find specific credential
    // Otherwise, use the expected agent verification schema
    const schemaToFind =
      validatedSchemaSaid || getAgentVerificationSchemaSaid();

    if (validatedSchemaSaid || schemaToFind) {
      const matchingCredential = findCredentialBySchema(
        credentials,
        schemaToFind,
      );

      if (!matchingCredential) {
        return NextResponse.json({
          success: true,
          message: `Credential with schema SAID '${schemaToFind}' not found`,
          data: {
            aid: validatedAid,
            schemaSaid: schemaToFind,
            credentialsCount: credentials.length,
            found: false,
            expectedSchemaSaid: getAgentVerificationSchemaSaid(),
          },
        });
      }

      // Format and validate the matching credential
      const formatted = formatCredential(matchingCredential);
      const validationResult = validateCredential(matchingCredential);

      return NextResponse.json({
        success: true,
        message: "Credential found and validated",
        data: {
          aid: validatedAid,
          schemaSaid: schemaToFind,
          credentialsCount: credentials.length,
          found: true,
          expectedSchemaSaid: getAgentVerificationSchemaSaid(),
          credential: {
            raw: matchingCredential,
            formatted,
            validation: validationResult,
          },
        },
      });
    }

    // Format and validate all credentials
    const formattedCredentials = credentials.map((cred) => ({
      raw: cred,
      formatted: formatCredential(cred),
      validation: validateCredential(cred),
    }));

    // Check if expected schema credential exists
    const expectedSchemaSaid = getAgentVerificationSchemaSaid();
    const expectedCredential = findCredentialBySchema(
      credentials,
      expectedSchemaSaid,
    );

    return NextResponse.json({
      success: true,
      message: `Found ${credentials.length} credential(s)`,
      data: {
        aid: validatedAid,
        credentialsCount: credentials.length,
        expectedSchemaSaid,
        hasExpectedCredential: !!expectedCredential,
        credentials: formattedCredentials,
      },
    });
  } catch (error) {
    console.error("[Veridian Test] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch credentials",
      },
      { status: 500 },
    );
  }
}
