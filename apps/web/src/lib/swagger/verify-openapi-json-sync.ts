/**
 * Fails if checked-in OpenAPI JSON does not match the generators.
 * Run from `apps/web`: `pnpm run check-openapi-json`
 */

import fs from "fs";
import path from "path";

import { generateOpenAPISpec } from "./generator";
import { generateSaaSAppOpenAPISpec } from "./saas-app-openapi";

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

function serialize(spec: unknown): string {
  return `${JSON.stringify(spec, jsonReplacer, 2)}\n`;
}

function assertMatches(label: string, filePath: string, spec: unknown): void {
  const generated = serialize(spec);
  const onDisk = fs.readFileSync(filePath, "utf-8");
  if (generated !== onDisk) {
    console.error(`${label} is out of sync with the Zod OpenAPI generators.`);
    console.error(`Expected path: ${filePath}`);
    console.error("From apps/web run: pnpm run swagger-json");
    process.exit(1);
  }
}

const cwd = process.cwd();
const swaggerDir = path.join(cwd, "src", "lib", "swagger");

const publicV1Spec = generateOpenAPISpec();

assertMatches(
  "openapi-platform-docs.json",
  path.join(swaggerDir, "openapi-platform-docs.json"),
  generateSaaSAppOpenAPISpec(),
);
assertMatches(
  "openapi-docs.json",
  path.join(swaggerDir, "openapi-docs.json"),
  publicV1Spec,
);
assertMatches(
  "public/openapi.json",
  path.join(cwd, "public", "openapi.json"),
  publicV1Spec,
);

console.log("OK: checked-in OpenAPI JSON matches generators.");
