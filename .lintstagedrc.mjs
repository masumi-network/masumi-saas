/**
 * lint-staged configuration for the Masumi SaaS monorepo.
 * Runs formatting and linting on staged files before commit.
 * apps/web files use the web app's ESLint config (Next.js + react-hooks).
 */
function isWebFile(path) {
  return (
    path.includes("apps/web/") ||
    path.replace(/^.*[/\\]/, "").startsWith("apps/web")
  );
}

function toWebRelative(path) {
  const match = path.match(/apps\/web\/(.*)$/);
  return match ? match[1] : path.replace(/^.*?apps\/web\/?/, "");
}

function lintTs(filenames) {
  const webFiles = filenames.filter(isWebFile);
  const otherFiles = filenames.filter((f) => !isWebFile(f));
  const commands = ["prettier --write " + filenames.join(" ")];
  if (webFiles.length) {
    const webPaths = webFiles.map(toWebRelative);
    commands.push(
      "cd apps/web && pnpm exec eslint --fix --max-warnings 0 " +
        webPaths.map((p) => `"${p}"`).join(" "),
    );
  }
  if (otherFiles.length) {
    commands.push(
      "pnpm exec eslint --fix --max-warnings 0 " + otherFiles.join(" "),
    );
  }
  return commands;
}

/** Must match generator output byte-for-byte (see verify-openapi-json-sync.ts). */
function isGeneratedOpenApiJsonFile(f) {
  const n = f.replace(/\\/g, "/");
  return (
    n.endsWith("/apps/web/public/openapi.json") ||
    n.endsWith("/apps/web/src/lib/swagger/openapi-docs.json") ||
    n.endsWith("/apps/web/src/lib/swagger/openapi-platform-docs.json")
  );
}

function formatJson(filenames) {
  const rest = filenames.filter((f) => !isGeneratedOpenApiJsonFile(f));
  if (rest.length === 0) return [];
  return [`prettier --write ${rest.join(" ")}`];
}

export default {
  "**/*.{ts,tsx}": lintTs,
  "**/*.json": formatJson,
  "**/*.{js,jsx,mjs,cjs,md,yml,yaml}": ["prettier --write"],
};
