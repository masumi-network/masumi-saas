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

/** Generator-owned files must not be touched by Prettier or ESLint autofix —
 * both produce a different format from the generator script and cause
 * `openapi:manifest:verify` to fail in CI. */
function isGeneratedTsFile(f) {
  const n = f.replace(/\\/g, "/");
  return n.includes("/apps/web/src/lib/openapi/generated/");
}

function lintTs(filenames) {
  const files = filenames.filter((f) => !isGeneratedTsFile(f));
  if (files.length === 0) return [];
  const webFiles = files.filter(isWebFile);
  const otherFiles = files.filter((f) => !isWebFile(f));
  const commands = ["prettier --write " + files.join(" ")];
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

function validateI18n(filenames) {
  if (filenames.length === 0) return [];
  return [
    `prettier --write ${filenames.join(" ")}`,
    "pnpm --filter web run i18n:validate",
  ];
}

export default {
  "**/*.{ts,tsx}": lintTs,
  "apps/web/messages/*.json": validateI18n,
  "**/*.json": formatJson,
  "**/*.{js,jsx,mjs,cjs,md,yml,yaml}": ["prettier --write"],
};
