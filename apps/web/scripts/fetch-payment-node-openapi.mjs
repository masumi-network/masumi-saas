/**
 * Downloads the latest payment node OpenAPI JSON (default: production /api-docs).
 * Override URL: PAYMENT_NODE_OPENAPI_URL=https://localhost:3001/api-docs node scripts/...
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "specs", "payment-node-openapi.json");

const url =
  process.env.PAYMENT_NODE_OPENAPI_URL?.trim() ||
  "https://payment.masumi.network/api-docs";

const res = await fetch(url, {
  headers: { Accept: "application/json" },
});

if (!res.ok) {
  console.error(
    `fetch-payment-node-openapi: HTTP ${res.status} ${res.statusText} — ${url}`,
  );
  process.exit(1);
}

const text = await res.text();
try {
  JSON.parse(text);
} catch {
  console.error(
    "fetch-payment-node-openapi: response is not valid JSON (check URL / auth)",
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, text, "utf8");
console.log(
  `fetch-payment-node-openapi: wrote ${outPath} (${(text.length / 1024).toFixed(1)} KiB) from ${url}`,
);
