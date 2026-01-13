/**
 * lint-staged configuration for the Masumi SaaS monorepo.
 * Runs formatting and linting on staged files before commit.
 */
export default {
  // Format and lint TypeScript/TSX files
  "**/*.{ts,tsx}": ["prettier --write", "eslint --fix --max-warnings 0"],
  // Format JSON files
  "**/*.json": ["prettier --write"],
  // Format other common files
  "**/*.{js,jsx,mjs,cjs,md,yml,yaml}": ["prettier --write"],
};
