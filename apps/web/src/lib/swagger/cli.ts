/**
 * Writes checked-in OpenAPI JSON next to the generators — same idea as
 * masumi-payment-service `pnpm run swagger-json` → `swagger-generator/openapi-docs.json`.
 *
 * Run from `apps/web`: `pnpm run swagger-json`
 *
 * Runtime routes still build fresh JSON (`GET /api/v1/openapi`, `GET /api/openapi`);
 * this keeps a reviewable snapshot in git and matches payment-service workflow.
 */

import fs from "fs";
import path from "path";

import { generateOpenAPISpec } from "./generator";
import { generateSaaSAppOpenAPISpec } from "./saas-app-openapi";

const swaggerDir = path.join(process.cwd(), "src", "lib", "swagger");

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

function writeSpec(relativeName: string, spec: unknown): void {
  const outPath = path.join(swaggerDir, relativeName);
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(spec, jsonReplacer, 2)}\n`,
    "utf-8",
  );
  console.log(`✓ OpenAPI spec written to ${outPath}`);
}

const publicV1Spec = generateOpenAPISpec();
writeSpec("openapi-docs.json", publicV1Spec);
writeSpec("openapi-platform-docs.json", generateSaaSAppOpenAPISpec());

/** Legacy static path; same document as `openapi-docs.json` (public v1 discovery). */
const publicOpenapiPath = path.join(process.cwd(), "public", "openapi.json");
fs.writeFileSync(
  publicOpenapiPath,
  `${JSON.stringify(publicV1Spec, jsonReplacer, 2)}\n`,
  "utf-8",
);
console.log(`✓ OpenAPI spec written to ${publicOpenapiPath}`);
