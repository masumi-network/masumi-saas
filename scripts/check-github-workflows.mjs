import fs from "node:fs";
import path from "node:path";

const workflowDir = path.join(process.cwd(), ".github", "workflows");
const workflowFiles = fs
  .readdirSync(workflowDir)
  .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
  .sort();

const errors = [];

for (const file of workflowFiles) {
  const fullPath = path.join(workflowDir, file);
  const source = fs.readFileSync(fullPath, "utf8");

  if (!/^\s*permissions\s*:/m.test(source)) {
    errors.push(`${file}: missing explicit permissions block`);
  }

  if (!/^\s*concurrency\s*:/m.test(source)) {
    errors.push(`${file}: missing explicit concurrency block`);
  }

  if (!/^\s*timeout-minutes\s*:/m.test(source)) {
    errors.push(`${file}: missing explicit timeout-minutes setting`);
  }

  const usesLines = source.matchAll(/^\s*uses:\s*(.+?)\s*$/gm);
  for (const match of usesLines) {
    const target = match[1]?.trim();
    if (!target || target.startsWith("./")) {
      continue;
    }

    if (!/@[0-9a-f]{40}(?:\s|$)/i.test(target)) {
      errors.push(`${file}: unpinned action reference "${target}"`);
    }
  }
}

if (errors.length > 0) {
  console.error("GitHub workflow policy check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Validated ${workflowFiles.length} workflow file(s).`);
