import { defineConfig } from "eslint/config";
import nextPlugin from "eslint-config-next";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

import { sharedPlugins, sharedRules } from "../../eslint.config.mjs";

export default defineConfig([
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...tseslint.configs.recommended,
  ...nextPlugin,
  prettier,
  {
    plugins: sharedPlugins,
    rules: {
      ...sharedRules,
      // Next.js specific rules
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);
