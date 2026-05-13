/**
 * Downloads the latest registry service OpenAPI JSON (default: production /api-docs).
 * Override URL: REGISTRY_SERVICE_OPENAPI_URL=https://localhost:3000/api-docs node scripts/...
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "specs", "registry-service-openapi.json");

const url =
  process.env.REGISTRY_SERVICE_OPENAPI_URL?.trim() ||
  "https://registry.masumi.network/api-docs";

const res = await fetch(url, {
  headers: { Accept: "application/json" },
});

if (!res.ok) {
  console.error(
    `fetch-registry-service-openapi: HTTP ${res.status} ${res.statusText} — ${url}`,
  );
  process.exit(1);
}

const text = await res.text();
try {
  JSON.parse(text);
} catch {
  console.error(
    "fetch-registry-service-openapi: response is not valid JSON (check URL / auth)",
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, text, "utf8");
console.log(
  `fetch-registry-service-openapi: wrote ${outPath} (${(text.length / 1024).toFixed(1)} KiB) from ${url}`,
);
