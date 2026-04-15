import { generateOpenApiDocument } from "@/lib/openapi/generate-openapi-document";

export function generateOpenAPISpec() {
  return generateOpenApiDocument("public-v1", {
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "Masumi Agent Verification API",
      description:
        "Public API for looking up agent verification status on the Masumi network.",
    },
    servers: [
      {
        url: "/",
        description: "Current environment",
      },
    ],
  });
}
