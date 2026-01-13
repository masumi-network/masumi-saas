import nextPlugin from "eslint-config-next";
import prettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

const config = [
  ...nextPlugin,
  prettier,
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      "unused-imports": unusedImports,
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // Import organization
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "unused-imports/no-unused-imports": "error",
      // TypeScript
      "@typescript-eslint/no-explicit-any": "error",
      // Next.js specific rules
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];

export default config;
