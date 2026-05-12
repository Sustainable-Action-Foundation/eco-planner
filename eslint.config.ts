import type { Config } from "eslint/config";
import { defineConfig, globalIgnores } from "eslint/config";
import nextTS from "eslint-config-next/typescript";
import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const tsBaseConfig = tseslint.configs.recommendedTypeChecked;
const nextBaseConfig = [...nextTS, ...nextVitals];

const commonRules: Config["rules"] = {
  "class-methods-use-this": "error",
  "default-case-last": "error",
  "default-case": "error",
  "eqeqeq": ["error", "smart"],
  "no-array-constructor": "error",
  "no-case-declarations": "error",
  "no-cond-assign": ["error", "always"],
  "no-duplicate-imports": ["error", { allowSeparateTypeImports: true, includeExports: true }],
  "no-empty-function": "warn",
  "no-empty": "warn",
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-lonely-if": "warn",
  "no-multi-assign": "error",
  "no-multi-str": "error",
  "no-restricted-globals": "error",
  "no-restricted-imports": ["error", "fs", "path", "crypto", "child_process", "os", "http"],
  "no-self-compare": "error",
  "no-sequences": "error",
  "no-template-curly-in-string": "warn",
  "no-throw-literal": "error",
  "no-unmodified-loop-condition": "error",
  "no-unreachable-loop": "error",
  "no-use-before-define": ["error", { functions: false, classes: false }],
  "no-useless-assignment": "warn",
  "no-useless-rename": "error",
  "no-var": "error",
  "no-with": "error",
  "prefer-const": "error",
  "radix": "error",
  // "comma-dangle": ["error", "always-multiline"],
  // "no-alert": "warn", // TODO: cleanse this repo
  // "no-magic-numbers": "error", // TODO: cry
  // "no-param-reassign": "error", // TODO: implement
  // "no-return-assign": "error", // I don't wanna deal with the 4 arrow functions using this right now
  // "no-warning-comments": "warn", // TODO: implement hihi
  // "quotes": ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }], // Authoritarian option :))
  // "require-atomic-updates": "error", // TODO consider this rule
  // "semi": ["error", "always"],
  // "sort-imports": "warn", // Large touch of code base to implement, also does not auto fix most cases which is sad. Probably will never use.
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      args: "all",
      argsIgnorePattern: "^_",
      caughtErrors: "all",
      caughtErrorsIgnorePattern: "^_",
      destructuredArrayIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      ignoreRestSiblings: true,
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
      "react-hooks/set-state-in-effect": "off", // TODO: get a grip and understand react
      "react-hooks/set-state-in-render": "off", // TODO: get a grip and understand react
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
