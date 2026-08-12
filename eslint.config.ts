import js from "@eslint/js";
import type { Config } from "eslint/config";
import { defineConfig, globalIgnores } from "eslint/config";
import nextTS from "eslint-config-next/typescript";
import nextVitals from "eslint-config-next/core-web-vitals";
import i18next from "eslint-plugin-i18next";
import tseslint from "typescript-eslint";
import { enumStyle } from "./scripts/eslint/enumStyle";
import { serializableBoundaryProps } from "./scripts/eslint/serializableBoundaryProps";

// js.configs.recommended first, so the TS configs' compat layer can turn off
// the core rules TypeScript itself already catches (no-undef, no-import-assign, ...)
const tsBaseConfig = [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked];
// eslint-config-next/typescript registers its own @typescript-eslint plugin instance,
// so tseslint configs can't be extended alongside it — merge their rules instead.
const tsRecommendedRules = tseslint.configs.recommendedTypeChecked
  .reduce<NonNullable<Config["rules"]>>((acc, c) => ({ ...acc, ...c.rules }), {});
const nextBaseConfig = [...nextTS, ...nextVitals];

const commonRules: Config["rules"] = {
  "comma-dangle": ["error", "always-multiline"],
  "default-case-last": "error",
  "default-case": "error",
  "eqeqeq": ["error", "smart"],
  "local/enum-style": "error",
  "no-case-declarations": "error",
  "no-cond-assign": ["error", "always"],
  "no-duplicate-imports": ["error", { allowSeparateTypeImports: true, includeExports: true }],
  "no-empty": "warn",
  "no-eval": "error",
  "no-lonely-if": "warn",
  "no-multi-assign": "error",
  "no-multi-str": "error",
  "no-restricted-globals": "error",
  "no-self-compare": "error",
  "no-sequences": "error",
  "no-template-curly-in-string": "warn",
  "no-throw-literal": "error",
  "no-unmodified-loop-condition": "error",
  "no-unreachable-loop": "error",
  "no-useless-assignment": "warn",
  "no-useless-rename": "error",
  "no-var": "error",
  "no-with": "error",
  "prefer-const": "error",
  "radix": "error",
  "semi": ["error", "always"],
  // "no-alert": "warn", // TODO: cleanse this repo
  // "no-magic-numbers": "error", // TODO: cry
  // "no-param-reassign": "error", // TODO: implement
  // "no-return-assign": "error", // I don't wanna deal with the 4 arrow functions using this right now
  // "no-warning-comments": "warn", // TODO: implement hihi
  // "quotes": ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }], // Authoritarian option :))
  // "require-atomic-updates": "error", // TODO consider this rule
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
  "@typescript-eslint/class-methods-use-this": "error",
  "@typescript-eslint/consistent-type-assertions": "error",
  "@typescript-eslint/consistent-type-definitions": ["warn", "type"],
  "@typescript-eslint/consistent-type-exports": "warn",
  "@typescript-eslint/consistent-type-imports": "warn",
  "@typescript-eslint/no-array-constructor": "error",
  "@typescript-eslint/no-base-to-string": "warn",
  "@typescript-eslint/no-confusing-non-null-assertion": "error",
  "@typescript-eslint/no-empty-function": "warn",
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-floating-promises": "warn",
  "@typescript-eslint/no-for-in-array": "error",
  "@typescript-eslint/no-implied-eval": "error",
  "@typescript-eslint/no-import-type-side-effects": "error",
  "@typescript-eslint/no-misused-promises": "warn",
  "@typescript-eslint/no-non-null-assertion": "warn",
  "@typescript-eslint/no-restricted-imports": ["error", {
    paths: ["fs", "path", "crypto", "child_process", "os", "http"],
    patterns: [
      {
        // Only the Prisma namespace may come from the generated client (error classes,
        // input types, TransactionClient...); models, enums, and payload types come from
        // the curated re-export at @/lib/prisma/generated (excluded from this pattern).
        group: ["**/prisma/generated", "**/prisma/generated/**", "!**/lib/prisma/generated", "!**/lib/prisma/generated/**", "@PRISMA-NAMESPACE-ONLY"],
        allowImportNames: ["Prisma"],
        message: "Import only the Prisma namespace from the generated client; everything else comes from @/lib/prisma/generated.",
      },
      {
        // The @/ alias must stay inside src. Escaping it (@/../...) resolves in the
        // Next bundler but breaks under plain tsx — e.g. the seed scripts' import
        // graph in CI. Files outside src/ have the @root/ alias instead.
        group: ["@/..", "@/../**"],
        message: "Do not escape the @/ alias; import files outside src/ via @root/ (tsx, used by the seed scripts, cannot resolve @/../).",
      },
    ],
  }],
  "@typescript-eslint/no-unnecessary-type-assertion": "warn",
  "@typescript-eslint/no-unsafe-argument": "warn",
  "@typescript-eslint/no-unsafe-assignment": "warn",
  "@typescript-eslint/no-unsafe-call": "warn",
  "@typescript-eslint/no-unsafe-enum-comparison": "warn",
  "@typescript-eslint/no-unsafe-member-access": "warn",
  "@typescript-eslint/no-unsafe-return": "error",
  "@typescript-eslint/no-use-before-define": ["error", { functions: false, classes: false }],
  "@typescript-eslint/only-throw-error": "warn",
  "@typescript-eslint/prefer-nullish-coalescing": ["warn", { ignorePrimitives: { string: true, boolean: true } }],
  "@typescript-eslint/prefer-optional-chain": "warn",
  "@typescript-eslint/require-await": "warn",
  "@typescript-eslint/restrict-template-expressions": "warn",
  "@typescript-eslint/switch-exhaustiveness-check": "warn",
  "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
  // "@typescript-eslint/array-type": ["error", { default: "array", readonly: "generic" }], // could be nice but cannot be bother to manually fix all occurrences

  // Switch cases must be scoped
  "no-restricted-syntax": ["error",
    {
      "selector": "SwitchCase > *.consequent:not(ReturnStatement):not(BreakStatement):not(BlockStatement)",
      "message": "Switch cases without blocks are disallowed.",
    },
    {
      "selector": "SwitchStatement:has(SwitchCase > *.consequent:not(ReturnStatement)):has(SwitchCase > ReturnStatement.consequent)",
      "message": "Switch cases must be consistent: do not mix direct returns with other case body styles.",
    },
    {
      // Only the un-aliased form is banned; `Unit as MathJSUnit` stays allowed.
      "selector": "ImportDeclaration[source.value=\"mathjs\"] ImportSpecifier[imported.name=\"Unit\"][local.name=\"Unit\"]",
      "message": "Importing mathjs' `Unit` un-aliased collides with the app's `Unit` type; alias it, e.g. `import { Unit as MathJSUnit } from \"mathjs\"`.",
    },
    {
      // async generateMetadata return type must be `Promise<Metadata>`
      "selector": "FunctionDeclaration[async=true][id.name=\"generateMetadata\"]:not([returnType.typeAnnotation.typeName.name=\"Promise\"][returnType.typeAnnotation.typeArguments.params.0.typeName.name=\"Metadata\"])",
      "message": "generateMetadata must return a Promise<Metadata>.",
    },
    {
      // generateMetadata must be async
      "selector": "FunctionDeclaration[id.name=\"generateMetadata\"]:not([async=true])",
      "message": "generateMetadata must be async.",
    },
    // The pre-org-rework "metaRoadmap" vocabulary is banned: the old MetaRoadmap is
    // now the roadmap (top level) and the old Roadmap is a roadmapIteration.
    {
      "selector": "[name=/(meta_?roadmap|roadmap[-_ ]?series)/i]",
      "message": "The legacy \"meta roadmap\" vocabulary is banned; use roadmap (top level) or roadmapIteration.",
    },
    {
      "selector": "Literal[value=/(meta_?roadmap|roadmap[-_ ]?series)/i]",
      "message": "The legacy \"meta roadmap\" vocabulary is banned; use roadmap (top level) or roadmapIteration.",
    },
    {
      "selector": "TemplateElement[value.raw=/(meta_?roadmap|roadmap[-_ ]?series)/i]",
      "message": "The legacy \"meta roadmap\" vocabulary is banned; use roadmap (top level) or roadmapIteration.",
    },
  ],
};

// i18n: flag hardcoded UI strings in JSX. Currently disabled — uncomment the spread in defineConfig below to enable.
// Exported (rather than plain const) so no-unused-vars stays quiet while disabled.
// Current findings inventory + tuning rationale: ignore/i18n-todos.md (standalone runner: ignore/eslint.i18n-sweep.config.ts)
// Caveat: jsx-only mode misses strings assigned outside JSX (e.g. `const label = "..."` later rendered).
export const i18nLiteralStrings: Config = {
  name: "i18n literal strings src/",
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/app/tests/**"], // Internal dev/test pages are intentionally untranslated
  plugins: { i18next },
  rules: {
    "i18next/no-literal-string": ["warn", {
      mode: "jsx-only",
      // NOTE: each option block replaces the plugin defaults wholesale (shallow spread),
      // so the defaults are repeated before our additions.
      "jsx-attributes": {
        include: [],
        exclude: [
          // plugin defaults
          "className", "styleName", "style", "type", "key", "id", "width", "height",
          // standard non-UI attributes
          "data-testid", "href", "src", "rel", "target", "name", "htmlFor",
          "aria-labelledby", "aria-describedby", "aria-hidden", "aria-live", "role",
          "autoComplete", "lang", "dir", "sizes", "viewBox", "d", "fill",
          "stroke", "strokeWidth", "color", "form", "accept", "min", "max",
          "step", "pattern", "inputMode", "loading", "decoding", "value",
          "defaultValue", "popover", "popoverTarget",
          // custom component props in this codebase (machine values)
          "anchorName", "positionAnchor", "anchorInlinePosition",
          "popoverDirection", "margin", "chartType", "chartOptionsType",
          "styling", "placement", "ariaLabelledBy", "labelledBy", "dataTestid",
          // image attribution props (proper nouns + URLs)
          "author", "authorLink", "source", "sourceLink",
        ],
      },
      "object-properties": {
        include: [],
        exclude: [
          // plugin default
          "[A-Z_-]+",
          // DOM/props passed as object props
          "className", "classNames", "id", "name", "type", "key", "dataTestid",
          "placement", "role", "aria-.+",
          // CSS-in-JS style keys
          "style", "gridTemplateColumns", "gridRow", "gridColumn", "width",
          "height", "borderBottom", "backgroundColor", "transform", "padding",
          "fontSize", "flexGrow", "marginTop",
        ],
      },
      callees: {
        exclude: [
          // plugin defaults
          "i18n(ext)?", "t", "require", "addEventListener", "removeEventListener",
          "postMessage", "getElementById", "dispatch", "commit", "includes",
          "indexOf", "endsWith", "startsWith",
          // logging + attribute lookups
          "console\\.(log|warn|error|debug|info)", "getAttributes",
        ],
      },
      words: {
        exclude: [
          // plugin defaults (punctuation/digits, ALL_CAPS, html entities, emoji),
          // widened to tolerate whitespace/nbsp/·/×/↺/… mixed into punctuation runs.
          // NOTE: the plugin compiles string patterns WITHOUT the u flag, so \p{...}
          // escapes silently never match — emoji are matched as surrogate ranges instead.
          "[0-9!-/:-@[-`{-~\\s\\u00a0\\u00b7\\u00d7\\u21ba\\u2026]+", "[A-Z_-]+", "(&[a-z]+;|\\s)+",
          "^[\\s\\ufe0f\\u2600-\\u27bf\\ud800-\\udfff]+$", "^$",
          // machine-value patterns
          "^var\\(--.+\\)$", "^--.+", "^https?://.+", "^mailto:.+", "^/.+",
          "^[0-9.]+(rem|em|px|%)$", "^[a-z0-9-]+@[a-z0-9-]+\\..+",
        ],
      },
    }],
  },
};

export default defineConfig([
  { // Register the local plugin globally so commonRules can reference it in every block
    name: "Local rules",
    plugins: { local: { rules: { "enum-style": enumStyle, "serializable-boundary-props": serializableBoundaryProps } } },
  },
  { // App linting
    name: "App src/",
    files: ["src/**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...nextBaseConfig,
    ],
    rules: {
      ...tsRecommendedRules,
      "react-hooks/set-state-in-effect": "off", // TODO: get a grip and understand react
      "react-hooks/set-state-in-render": "off", // TODO: get a grip and understand react
      "react-hooks/immutability": "error",
      "local/serializable-boundary-props": "error",
      "react/button-has-type": "error",
      "react/checked-requires-onchange-or-readonly": "error",
      "react/jsx-boolean-value": ["error", "always"],
      "react/jsx-no-leaked-render": "error",
      "react/jsx-no-target-blank": "error",
      "react/jsx-no-useless-fragment": "error",
      "react/jsx-pascal-case": "error",
      "react/no-array-index-key": "off", // In a perfect world...
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
      // Playwright fixtures require a (possibly empty) destructuring pattern as first arg
      "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
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
  { // The curated Prisma re-export is the one place allowed to deep-import the generated client
    name: "Prisma re-export carve-out",
    files: ["src/lib/prisma/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": "off",
    },
  },
  // i18nLiteralStrings, // Uncomment to flag hardcoded UI strings (see the const above defineConfig)
  globalIgnores([
    "prisma/generated/**/*",
    "node_modules/**/*",
    ".next/**/*",
    ".claude/**/*",
    "ignore/**/*",
    "next-env.d.ts",
  ]),
]);
