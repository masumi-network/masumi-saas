import fs from "fs";
import path from "path";

import { generateOpenAPISpec } from "./generator";

const spec = generateOpenAPISpec();

const outputPath = path.join(process.cwd(), "public", "openapi.json");

fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2), "utf-8");

console.log(`✓ OpenAPI spec written to ${outputPath}`);
