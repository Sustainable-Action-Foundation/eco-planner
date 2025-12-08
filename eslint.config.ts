// @ts-check

import eslint from "@eslint/js";
import { defineConfig, globalIgnores, } from "eslint/config";

import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

import nextTS from "eslint-config-next/typescript";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig(
  eslint.configs.recommended,
  reactRefresh.configs.next,
  reactHooks.configs.flat.recommended,
  ...nextVitals,
  ...nextTS,
  {
    rules: {
      "prefer-const": "warn",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "react-hooks/immutability": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^[_t]",
          ignoreRestSiblings: true
        }
      ],
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-enum-comparison": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-confusing-non-null-assertion": "error",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "no-empty": "warn",
    },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: process.cwd(),
      },
    },
  },
  globalIgnores([
    ".next/**",
    "*.config.js",
    "*.config.ts",
    "**/*.d.ts",
    "dist/**",
    "node_modules/**",
    "out/**",
    "public/**",
    "scripts/**",
    "src/prisma/generated/**",
    "src/components/ui/**",
    "tailwind.config.js",
  ]),
)