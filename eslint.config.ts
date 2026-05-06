import type { Config } from "eslint/config";
import { defineConfig, globalIgnores } from "eslint/config";
import nextTS from "eslint-config-next/typescript";
import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const tsBaseConfig = tseslint.configs.recommendedTypeChecked;
const nextBaseConfig = [...nextTS, ...nextVitals];

const commonRules: Config["rules"] = {
  "eqeqeq": ["error", "smart"],
  "no-duplicate-imports": ["error", { allowSeparateTypeImports: true, includeExports: true }],
  "no-useless-assignment": "warn",
  "prefer-const": "error",
  "comma-dangle": ["error", "always-multiline"], // Would be nice but not tweakable enough
  // "quotes": ["error", "double", { avoidEscape: true }], // Authoritarian option :))
  "semi": ["error", "always"],
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      "args": "all",
      "argsIgnorePattern": "^_",
      "caughtErrors": "all",
      "caughtErrorsIgnorePattern": "^_",
      "destructuredArrayIgnorePattern": "^_",
      "varsIgnorePattern": "^_",
      "ignoreRestSiblings": true,
    },
  ],
  "@typescript-eslint/ban-ts-comment": "error",
  "@typescript-eslint/consistent-type-assertions": "error",
  "@typescript-eslint/consistent-type-definitions": ["warn", "type"],
  "@typescript-eslint/consistent-type-exports": "warn",
  "@typescript-eslint/consistent-type-imports": "warn",
  "@typescript-eslint/no-base-to-string": "warn",
  "@typescript-eslint/no-confusing-non-null-assertion": "error",
  "@typescript-eslint/no-floating-promises": "warn",
  "@typescript-eslint/no-for-in-array": "error",
  "@typescript-eslint/no-misused-promises": "warn",
  "@typescript-eslint/no-non-null-assertion": "warn",
  "@typescript-eslint/no-unnecessary-type-assertion": "warn",
  "@typescript-eslint/no-unsafe-argument": "warn",
  "@typescript-eslint/no-unsafe-assignment": "warn",
  "@typescript-eslint/no-unsafe-call": "warn",
  "@typescript-eslint/no-unsafe-enum-comparison": "warn",
  "@typescript-eslint/no-unsafe-member-access": "warn",
  "@typescript-eslint/no-unsafe-return": "error",
  "@typescript-eslint/only-throw-error": "warn",
  "@typescript-eslint/prefer-nullish-coalescing": ["warn", { ignorePrimitives: { string: true, boolean: true } }],
  "@typescript-eslint/prefer-optional-chain": "warn",
  "@typescript-eslint/require-await": "warn",
  "@typescript-eslint/restrict-template-expressions": "warn",
  "@typescript-eslint/switch-exhaustiveness-check": "warn",
  "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
};

export default defineConfig([
  { // App linting
    name: "App src/",
    files: ["src/**/*.{ts,tsx}"],
    extends: [
      ...nextBaseConfig,
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/immutability": "error",
      ...commonRules,
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
      ...tsBaseConfig,
    ],
    rules: {
      ...commonRules,
    },
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: process.cwd(),
      },
    },
  },
  { // Script linting
    name: "scripts scripts/",
    files: ["scripts/**/*.{ts,tsx}", "*.config.ts"],
    extends: [
      ...tsBaseConfig,
    ],
    rules: {
      ...commonRules,
    },
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: process.cwd(),
      },
    },
  },
  globalIgnores([
    ".prisma/**/*",
    "src/prisma/generated/**/*",
    "src/.prisma/**/*",
    ".prisma/**/*",
    "prisma/generated/**/*",
    "node_modules/**/*",
    ".next/**/*",
    "out/**/*",
    "dist/**/*",
    "build/**/*",
    "ignore/**/*",
    "next-env.d.ts",
  ]),
]);
