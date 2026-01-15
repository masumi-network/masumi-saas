import nextPlugin from "eslint-config-next";
import prettier from "eslint-config-prettier/flat";
import react from "eslint-plugin-react";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

const config = [
  ...nextPlugin,
  prettier,
  {
    plugins: {
      react,
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
      // i18n: Prevent hardcoded strings in JSX
      // This rule flags hardcoded text in JSX elements to ensure all user-facing strings are translated
      "react/jsx-no-literals": [
        "error",
        {
          // Disallow string literals as children in JSX
          noStrings: true,
          // Also check attributes (like aria-label, title, placeholder, etc.)
          noAttributeStrings: true,
          // Allow strings in props (like className, style, etc.) as they're typically not user-facing
          ignoreProps: true,
          // Common non-translatable strings that are allowed
          allowedStrings: [
            // Common separators and formatting
            " ",
            "/",
            // Common technical strings
            "_blank",
            "_self",
          ],
        },
      ],
    },
  },
];

export default config;
