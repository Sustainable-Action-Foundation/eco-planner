import fs from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";
import { allNamespaces, Locales } from "../../i18n.config";
import {
  allPermutations,
  filteredLocales,
  getAllJSONFlattened,
  getAllTSXFiles,
  isKeyDefined,
  localesDir,
  nestedTRegex,
  tCallRegex,
  validPluralSuffixes,
} from "../../scripts/lib/localeKeyScan";

/*
 * Repo lint over `public/locales` and the app's i18n usage. Only breaking
 * checks live here; non-breaking reports (dead keys, empty values) live in
 * `scripts/findDeadLocaleKeys.ts` (`yarn check:locales`).
 *
 * The three checks the old suite kept permanently skipped (common values
 * repeated in other namespaces, common keys used directly in files, and
 * hard-coded Swedish) are gone: each had dozens to hundreds of hits and is a
 * style audit, not a lint that can break the build.
 *
 * The locale files and the scanned sources are read lazily inside the tests,
 * never in describe bodies, so collection stays cheap and a read failure is
 * reported by the test that needs the data.
 */

type FlattenedLocales = ReturnType<typeof getAllJSONFlattened>;
type ScannedFiles = ReturnType<typeof getAllTSXFiles>;

let cachedJSON: FlattenedLocales | undefined;
let cachedFiles: ScannedFiles | undefined;

/** Every namespace file per locale with their flattened key-values. */
function allJSON(): FlattenedLocales {
  cachedJSON ??= getAllJSONFlattened();
  return cachedJSON;
}

/** The app files to check (`.tsx` and `.ts` under `src/`, comments stripped). */
function allSources(): ScannedFiles {
  cachedFiles ??= getAllTSXFiles();
  return cachedFiles;
}

/** Since the translation system uses client and server side instances of i18next, we test for mismatches. */
const tServerUsageIndications = ["@/lib/i18nServer", "serveTea("];
const tClientUsageIndications = ["useTranslation"];
const serverIndications = ["server-only", "use server", "next/server", "next/headers", "export default async function", "export async function"];
const clientIndications = ["client-only", "use client", "useEffect", "useMemo", "useState", "useRef"];
const serverSideFilesOverride = ["page.tsx", "layout.tsx"].map(file => path.join(...file.split("/")));
const clientSideFilesOverride: string[] = [];
const exemptedMixedUseFiles = ["src/app/tests/locale/page.tsx"].map(file => path.join(...file.split("/")));

/** Orphaned keys in root levels of namespaces are discouraged, except in these namespaces */
const exemptedOrphanNS = ["common"];
const exemptedOrphanKeys: string[] = [];

test.describe("Namespace files", () => {
  test("every namespace exists, non-empty, in every locale, and nothing else does", () => {
    const perLocale: Record<string, { missing: string[], extra: string[], empty: string[] }> = {};

    for (const locale of filteredLocales) {
      const nsFiles = fs.globSync(`${localesDir}/${locale}/*.json`);
      const nsFilesNames = nsFiles.map(file => path.basename(file, ".json"));

      const missing = allNamespaces.filter(ns => !nsFilesNames.includes(ns));
      const extra = nsFilesNames.filter(ns => !allNamespaces.includes(ns));
      const empty = nsFilesNames.filter(ns => {
        const content = fs.readFileSync(path.join(localesDir, locale, `${ns}.json`), "utf-8").trim();
        return !content || content === "{}";
      });

      if (missing.length || extra.length || empty.length) perLocale[locale] = { missing, extra, empty };
    }

    expect(filteredLocales.length).toBeGreaterThan(0);
    expect(perLocale, `Namespace problems per locale: ${JSON.stringify(perLocale, null, 2)}`).toEqual({});
  });

  test("namespace files are JSON objects", () => {
    const bad: string[] = [];
    for (const [locale, namespace] of allPermutations) {
      const content = fs.readFileSync(path.join(localesDir, locale, `${namespace}.json`), "utf-8");
      try {
        const parsed: unknown = JSON.parse(content);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) bad.push(`${locale}/${namespace}.json: not an object`);
      }
      catch (err) {
        bad.push(`${locale}/${namespace}.json: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

test.describe("Keys across locales", () => {
  test("English, the fallback, has every key and every locale has every English key", () => {
    const json = allJSON();
    const enKeys = Object.keys(json[Locales.default]);
    expect(enKeys.length).toBeGreaterThan(0);

    const missingInOthers: Record<string, string[]> = {};
    const missingInEnglish: Record<string, string[]> = {};
    for (const locale of filteredLocales) {
      const keys = new Set(Object.keys(json[locale]));
      const enSet = new Set(enKeys);
      const missingOther = enKeys.filter(key => !keys.has(key));
      const missingEng = [...keys].filter(key => !enSet.has(key));
      if (missingOther.length > 0) missingInOthers[locale] = missingOther;
      if (missingEng.length > 0) missingInEnglish[locale] = missingEng;
    }

    expect(missingInOthers, `Missing keys in non-english locales: ${JSON.stringify(missingInOthers, null, 2)}`).toEqual({});
    expect(missingInEnglish, `Missing keys in english: ${JSON.stringify(missingInEnglish, null, 2)}`).toEqual({});
  });

  test("nested $t() references resolve, plural and formatter variants included", () => {
    const json = allJSON();
    const perLocale: Record<string, string[]> = {};
    const report = (locale: string, message: string) => { (perLocale[locale] ??= []).push(message); };

    for (const locale of filteredLocales) {
      for (const [key, value] of Object.entries(json[locale])) {
        for (const [match, nestedKey] of value.matchAll(nestedTRegex)) {
          if (json[locale][nestedKey]) continue;

          if (!/^[^:]+:/.test(nestedKey)) {
            report(locale, `[Missing namespace] > '${key}': '${value}'`);
            continue;
          }

          const hasArgs = nestedKey.includes(",") && nestedKey.includes("{") && nestedKey.includes("}");
          if (hasArgs) {
            // Find and escape the arguments; `{"count": n}` is written without quotes around n
            const args = nestedKey
              .replace(/.*?:.*?,\s*/gm, "")
              .replace(/(?<=".*?":\s*)([^"']*?)(?=\s*,|\s*}$)/gm, "\"$1\"");
            try { JSON.parse(args); }
            catch {
              report(locale, `[Syntax error: args] > '${key}': '${value}'`);
              continue;
            }
            const baseKey = nestedKey.split(",")[0];
            if (validPluralSuffixes.some(suffix => json[locale][`${baseKey}${suffix}`])) continue;
            report(locale, `[Missing plural key] > '${key}': '${value}'`);
            continue;
          }

          // Formatters are written inside the parentheses: $t(ns:key, formatter)
          if (/(.*?:.*?,\s*)\w+$/m.test(nestedKey)) {
            const noFormat = nestedKey.replace(/,\s?\w+$/m, "");
            if (json[locale][noFormat]) continue;
          }

          report(locale, `[${key}] > '${match}'`);
        }
      }
    }

    expect(perLocale, `Nested keys not defined: ${JSON.stringify(perLocale, null, 2)}`).toEqual({});
  });

  test("interpolation braces are balanced in every value", () => {
    const json = allJSON();
    const perLocale: Record<string, string[]> = {};

    for (const locale of filteredLocales) {
      for (const [key, value] of Object.entries(json[locale])) {
        if (!value.includes("{") && !value.includes("}")) continue;
        let depth = 0;
        let problem: string | null = null;
        for (const char of value) {
          if (char === "{") depth++;
          if (char === "}") depth--;
          if (depth < 0) { problem = "Missing '{'"; break; }
        }
        if (problem === null && depth > 0) problem = "Missing '}'";
        if (problem) (perLocale[locale] ??= []).push(`[${problem}] > '${key}': '${value}'`);
      }
    }

    expect(perLocale, `Invalid variable syntax: ${JSON.stringify(perLocale, null, 2)}`).toEqual({});
  });

  test("no orphan string keys in the root of namespace files other than common", () => {
    const perLocale: Record<string, string[]> = {};

    for (const [locale, namespace] of allPermutations) {
      if (exemptedOrphanNS.includes(namespace)) continue;
      const data = JSON.parse(fs.readFileSync(path.join(localesDir, locale, `${namespace}.json`), "utf-8")) as Record<string, unknown>;
      for (const [key, value] of Object.entries(data)) {
        if (exemptedOrphanKeys.some(exemptedKey => key.startsWith(exemptedKey))) continue;
        if (typeof value === "string") (perLocale[locale] ??= []).push(`[Orphan key] > '${namespace}:${key}': '${value}'`);
      }
    }

    expect(perLocale, `Orphan keys in root of namespace files: ${JSON.stringify(perLocale, null, 2)}`).toEqual({});
  });
});

test.describe("Keys used by the app", () => {
  test("the scan covers .ts modules as well as .tsx components", () => {
    const files = allSources();
    expect(files.some(file => file.filePath.endsWith(".tsx"))).toBe(true);
    expect(files.some(file => file.filePath.endsWith(".ts") && !file.filePath.endsWith(".d.ts"))).toBe(true);
    // Catalogs written in plain TypeScript carry their keys through t() like components do
    expect(files.some(file => file.filePath.endsWith("curatedHistoricalData.ts"))).toBe(true);
    expect(files.some(file => file.filePath.endsWith("leapSuggestedRecipes.ts"))).toBe(true);
    expect(files.some(file => file.filePath.includes(path.join("prisma", "generated")))).toBe(false);
  });

  test("every literal t() key is defined in every locale", () => {
    const json = allJSON();
    const perFile: Record<string, string[]> = {};

    for (const { filePath, content } of allSources()) {
      for (const [, key] of content.matchAll(tCallRegex)) {
        for (const locale of filteredLocales) {
          if (isKeyDefined(key, json[locale])) continue;
          (perFile[filePath] ??= []).push(`[Undefined key] > '${locale}': '${key}'`);
        }
      }
    }

    expect(perFile, `Keys used in app are not defined in JSON: ${JSON.stringify(perFile, null, 2)}`).toEqual({});
  });

  test("server and client i18n instances are not mixed in one file", () => {
    const perFile: Record<string, string[]> = {};
    const report = (filePath: string, message: string) => { (perFile[filePath] ??= []).push(message); };

    for (const { filePath, content } of allSources()) {
      if (exemptedMixedUseFiles.some(file => filePath.endsWith(file))) continue;

      const usingTServer = tServerUsageIndications.some(indication => content.includes(indication));
      const usingTClient = tClientUsageIndications.some(indication => content.includes(indication));
      if (!usingTServer && !usingTClient) continue;
      if (usingTServer && usingTClient) report(filePath, "Found both server and client side translations");

      const serverOverride = serverSideFilesOverride.some(file => filePath.endsWith(file));
      const clientOverride = clientSideFilesOverride.some(file => filePath.endsWith(file));
      const isServer = serverIndications.some(indication => content.includes(indication)) || (serverOverride && !clientOverride);
      const isClient = clientIndications.some(indication => content.includes(indication)) || (clientOverride && !serverOverride);

      if (isServer && isClient) report(filePath, "Found both server and client side code");
      if (isClient && !usingTClient) report(filePath, "Client side file using server side translations");
      if (isServer && !usingTServer) report(filePath, "Server side file using client side translations");
    }

    expect(perFile, `Server and client side code mixed: ${JSON.stringify(perFile, null, 2)}`).toEqual({});
  });

  test("<Trans /> tags use defined i18nKey props", () => {
    const json = allJSON();
    const perFile: Record<string, string[]> = {};
    const i18nKeyRegex = /(?<=<Trans(?:\r?\n.*)*)i18nKey=["'](.*?)["'](?=(?:\r?\n.*)*\/>)/gmu;

    for (const { filePath, content } of allSources()) {
      for (const [match, key] of content.matchAll(i18nKeyRegex)) {
        if (key && isKeyDefined(key, json[Locales.default])) continue;
        (perFile[filePath] ??= []).push(`[Invalid i18nKey] > '${match}'`);
      }
    }

    expect(perFile, `Invalid i18nKey: ${JSON.stringify(perFile, null, 2)}`).toEqual({});
  });

  test("<Trans /> tags pass components exactly when their value has markup", () => {
    const json = allJSON();
    const perFile: Record<string, string[]> = {};
    const transTagRegex = /<Trans.*?\/>(?!\s*\}\})(?!,)/gmus;

    for (const { filePath, content } of allSources()) {
      for (const [matchTrans] of content.matchAll(transTagRegex)) {
        const collapsed = matchTrans.replace(/\s+/g, " ");
        if (/\si18nKey=\{(.*?)\}/.test(collapsed)) continue; // Dynamic key, nothing to check statically

        const i18nKeyStringMatch = /\si18nKey=["'](.*?)["']/.exec(collapsed);
        if (!i18nKeyStringMatch) {
          (perFile[filePath] ??= []).push(`[Missing i18nKey] > '${matchTrans}'`);
          continue;
        }

        const value = json[Locales.default][i18nKeyStringMatch[1]];
        const componentsMatch = /\scomponents=\{\{(.*?)\}\}/.exec(collapsed);
        const componentsInTag = !!componentsMatch && componentsMatch[1] !== "null" && componentsMatch[1] !== "undefined";
        const componentsInValue = !!value && (value.includes("<") || value.includes(">"));

        if (componentsInTag && !componentsInValue) (perFile[filePath] ??= []).push(`[Missing components in value] > '${collapsed}'`);
        if (!componentsInTag && componentsInValue) (perFile[filePath] ??= []).push(`[Missing components in tag] > '${collapsed}'`);
      }
    }

    expect(perFile, `Invalid <Trans /> syntax: ${JSON.stringify(perFile, null, 2)}`).toEqual({});
  });
});
