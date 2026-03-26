import path from "node:path";
import { Config, defineConfig, globalIgnores } from "eslint/config";
import nextTS from "eslint-config-next/typescript";
import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const nonAppTsBaseConfig = tseslint.configs.recommendedTypeChecked;

const tsCommonRules: Config["rules"] = {
  "prefer-const": "warn",
  "@typescript-eslint/no-unused-vars": [
    "warn",
    {
      "args": "all",
      "argsIgnorePattern": "^_",
      "caughtErrors": "all",
      "caughtErrorsIgnorePattern": "^_",
      "destructuredArrayIgnorePattern": "^_",
      "varsIgnorePattern": "^_",
      "ignoreRestSiblings": true
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
  "@typescript-eslint/only-throw-error": "warn",
  "@typescript-eslint/switch-exhaustiveness-check": "warn",
  "@typescript-eslint/consistent-type-imports": "warn",
  "@typescript-eslint/consistent-type-exports": "warn",
  "@typescript-eslint/consistent-type-definitions": ["warn", "type"],
  "@typescript-eslint/ban-ts-comment": "error",
  "@typescript-eslint/prefer-nullish-coalescing": "warn",
  "@typescript-eslint/prefer-optional-chain": "warn",
  "@typescript-eslint/restrict-template-expressions": "warn",
  "@typescript-eslint/no-base-to-string": "warn",
  "@typescript-eslint/use-unknown-in-catch-callback-variable": "warn",
};

export default defineConfig([
  { // App linting
    name: "App src/",
    files: ["src/**/*.{ts,tsx}"],
    extends: [
      ...nextTS,
      ...nextVitals,
    ],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/immutability": "warn", // This should probably be a warning but the current recipe pipeline is dependant on it :sweat_smile:
      ...tsCommonRules,
    },
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: process.cwd(),
      },
    },
  },
  { // Test linting
    name: "Tests tests/",
    files: ["tests/**/*.{ts,tsx}"],
    extends: [
      ...nonAppTsBaseConfig,
    ],
    rules: {
      ...tsCommonRules,
    },
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: path.join(process.cwd(), "tests"),
      },
    },
  },
  { // Script linting
    name: "scripts scripts/",
    files: ["scripts/**/*.{ts,tsx}"],
    extends: [
      ...nonAppTsBaseConfig,
    ],
    rules: {
      ...tsCommonRules,
    },
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: path.join(process.cwd(), "scripts"),
      },
    },
  },
  globalIgnores([
    "src/prisma/generated/**/*",
    "node_modules/**/*",
    "prisma/**/*",
    ".next/**/*",
    "out/**/*",
    "dist/**/*",
    "build/**/*",
    "ignore/**/*",
    "next-env.d.ts",
  ]),
]);
