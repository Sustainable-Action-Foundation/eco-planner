import fs from "node:fs";
import path from "node:path";
import { Locales, allNamespaces, uniqueLocales } from "../../i18n.config.ts";

/**
 * Shared helpers for statically scanning the app for i18n key usage and the
 * locale JSON files for key definitions. Used by the locale-files unit tests
 * (breaking checks) and `scripts/findDeadLocaleKeys.ts` (manual report).
 */

/** Where the locale files are located relative to project root. */
export const localesDir = "public/locales";

/** Every real locale (the pseudo test locale is excluded). */
export const filteredLocales = uniqueLocales.filter(locale => locale !== Locales.test);

/** Every combo of locale and ns in a 2d array. */
export const allPermutations = filteredLocales.flatMap(locale => allNamespaces.map(namespace => [locale, namespace]));

/** When validating pluralized translations, use these to determine if a base key is valid. */
export const validPluralSuffixes = ["_one", "_two", "_few", "_many", "_other", "_zero"];

/**
 * Matches `t("ns:key")` and `t("ns:key", options)` calls, capturing the key.
 * The leading `\W` excludes calls to functions merely ending in t, like `addToast(`.
 */
export const tCallRegex = /\Wt\(\s*["']([^"']+)["']\s*[,)]/gm;

/** Matches key-ish props on elements, e.g. `i18nKey="ns:key"`. Over-matches on purpose; only use where extra hits are harmless. */
export const keyPropRegex = /(?<=<\w*.*?\W)(?:\w*?[kK]ey\w*?)=\{?["'](.*?)["']\}?(?=.*?\/>)/gmus;

/** Matches `$t(ns:key)` references nested inside translation values. */
export const nestedTRegex = /\$t\((.*?)\)/gm;

/** Removes a trailing plural suffix, if any, so `action_one` compares equal to `action`. */
export function stripPluralSuffix(key: string): string {
  for (const suffix of validPluralSuffixes) {
    if (key.endsWith(suffix)) return key.slice(0, -suffix.length);
  }
  return key;
}

/** True if the key, or any pluralized variant of it, is defined in the given flattened locale data. */
export function isKeyDefined(key: string, flattenedLocale: Record<string, string>): boolean {
  if (flattenedLocale[key]) return true;
  return validPluralSuffixes.some(suffix => flattenedLocale[`${key}${suffix}`]);
}

/**
 * Every i18n key referenced by the app code (t() calls and key-ish props) plus keys
 * referenced via nested $t() in the locale's own values. Plural suffixes are stripped.
 */
export function collectUsedKeys(
  allTSX: { filePath: string, content: string }[],
  flattenedLocale: Record<string, string>,
): Set<string> {
  const usedKeys = new Set<string>();

  allTSX.forEach(({ content }) => {
    const allTCalls = Array.from(content.matchAll(tCallRegex));
    const allKeyProps = Array.from(content.matchAll(keyPropRegex));

    [...allTCalls, ...allKeyProps].forEach(([, key]) => {
      if (key) usedKeys.add(stripPluralSuffix(key));
    });
  });

  Object.values(flattenedLocale).forEach(value => {
    const nestedKeys = Array.from(value.matchAll(nestedTRegex));

    nestedKeys.forEach(([, key]) => {
      // Remove options object
      const optionsStart = key.indexOf(",");
      if (optionsStart !== -1) {
        key = key.slice(0, optionsStart).trim();
      }

      usedKeys.add(stripPluralSuffix(key));
    });
  });

  return usedKeys;
}

/** Structure is `{ Locales: { "namespace:key.keyN": value } }` */
export function getAllJSONFlattened(): Record<string, Record<string, string>> {
  const perLocale: Record<string, Record<string, string>> = Object.fromEntries(filteredLocales.map(locale => [locale, {}]));
  allPermutations.map(([locale, namespace]) => {
    try {
      const unparsed = fs.readFileSync(path.join(localesDir, locale, `${namespace}.json`), "utf-8");
      const nsData = JSON.parse(unparsed) as unknown;
      if (typeof nsData !== "object" || nsData === null || Array.isArray(nsData)) {
        throw new Error("Not an object");
      }
      const flattened = flattenTree(nsData);
      const prefixed = Object.fromEntries(Object.entries(flattened)
        .map(([key, value]) => [`${namespace}:${key}`, value]),
      );
      perLocale[locale] = { ...perLocale[locale], ...prefixed };
    }
    catch (err) {
      console.warn(`Failed to read or parse JSON file for locale '${locale}' and namespace '${namespace}':`, err);
      throw err;
    }
  });
  return perLocale;
}

/** Get every file where t might be implemented as an array of objects storing the file path and their content as text */
export function getAllTSXFiles() {
  const allTSXPaths = fs.globSync(["src/**/*.{tsx,ts}", "!scripts/**/*", "!src/prisma/generated/**/*", "!.prisma/**/*", "!src/.prisma/**/*", "!prisma/generated/**/*"]);

  return allTSXPaths.map(filePath => {
    const contentRaw = fs.readFileSync(filePath, "utf-8");

    const lines = contentRaw.split(/\r?\n/);
    // Remove comments
    const strippedLines = lines.map((line, i) => {

      const trimmedLine = line.trim();
      if (!trimmedLine) return ""; // Empty lines

      // Single line comments
      if (
        trimmedLine.startsWith("//") // Single line comment
        ||
        (trimmedLine.startsWith("/*") && trimmedLine.endsWith("*/")) // Single line block comment
        ||
        (trimmedLine.startsWith("{/*") && trimmedLine.endsWith("*/}")) // Single line block comment
      ) {
        return "";
      }

      // Remove block comments
      if (trimmedLine.startsWith("/*") || trimmedLine.startsWith("/**") || trimmedLine.startsWith("{/*") || trimmedLine.startsWith("{/**")) {
        const spanStart = i;
        const spanEnd = lines.findIndex((l, j) => ((l.trim().endsWith("*/") || l.trim().endsWith("*/}")) && j > spanStart));

        if (spanEnd === -1) {
          console.warn(`Comment stripping failed ${filePath}:${i + 1}`);
          return line;
        }

        for (let j = spanStart; j <= spanEnd; j++) {
          lines[j] = ""; // Remove the comment lines
        }
      }

      return line; // Keep the line as is
    });

    const content = strippedLines.join("\n");

    return { filePath, content: content };
  });
}

function isStandardObject(object: unknown): object is object {
  return typeof object === "object" && object != null && !Array.isArray(object);
}

/** Returns a flattened object with the structure `{ "key1.key2.keyN": value }` */
export function flattenTree(obj: unknown) {
  const result: Record<string, string> = {};

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  const recurse = (obj: object, prefix = "") => {
    for (const [key, value] of Object.entries(obj)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;

      if (isStandardObject(value)) {
        recurse(value, newPrefix);
      }
      else if (typeof value === "string") {
        result[newPrefix] = value;
      }
      else if (Array.isArray(value) && value.length === 0) {
        // No-op
      }
      else {
        console.warn(`Unexpected value type at key '${newPrefix}':`, value);
      }
    }
  };

  if (isRecord(obj)) {
    recurse(obj);
  }

  return result;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
