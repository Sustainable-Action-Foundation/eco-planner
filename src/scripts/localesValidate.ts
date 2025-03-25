
import "./lib/console.ts";
import { Locales, ns, uniqueLocales } from "i18n.config.ts";
import { glob } from "glob";
import fs from "node:fs";
import path from "node:path";
import { colors } from "./lib/colors.ts";
// @ts-expect-error - It's cjs
import escape from "regexp.escape"; // Polyfill for RegExp.escape. Not in node yet.

/** Where to find the locale files */
const localesDir = "public/locales";
/** Which folder to search for files with locale accesses */
const appDir = "src"
/** Expected namespaces */
const expectedNS = ns;
const expectedLocales = uniqueLocales;


/** 
 * Tests:
 *  - English as a fallback
 *    - En has all expected NS. If more than expected, inform.
 *    - En has all or equal keys to the sum of all other locales. Inform which locale if it has more.
 *  - All locales have all expected NS.
 *  - All locales have less or equal keys to English. Else, inform.
 *  - All keys are snake_case.
 *  - All keys are used in the app.
 *  - Kist all common keys in pages or components.
 */

/** Does every supported locale have a corresponding folder in the locales directory? */
async function TestLocalesDir() {
  const localeDirs = glob.sync(`${localesDir}/*/`)
    .map(dir => path.basename(dir));

  const missingLocales = expectedLocales.filter(lng => !localeDirs.includes(lng));
  const extraLocales = localeDirs.filter(lng => !expectedLocales.includes(lng as Locales));

  assertWarn(extraLocales.length === 0,
    `There are extra locale folders. Remove or implement them: [ ${extraLocales.join(", ")} ]`,
    "Locales in locales folder are valid"
  );

  assertWarn(missingLocales.length === 0,
    `There are missing locale folders. Add them: [ ${missingLocales.join(", ")} ]`,
    "Found every expected locale folder"
  );
}

/** Does every namespace exist in every locale? */
async function TestNamespaces() {
  // Track missing and extra namespaces per locale
  const perLocale: { [key: string]: { missing: string[], extra: string[] } }
    = Object.fromEntries(expectedLocales.map(locale => [locale, { missing: [], extra: [] }]));

  // Loop through all locales to find missing and extra namespaces
  expectedLocales.forEach((locale) => {
    const files = glob.sync(`${localesDir}/${locale}/*.json`);
    const namespaces = files.map(file => path.basename(file, ".json"));

    const missingNS = expectedNS.filter(ns => !namespaces.includes(ns));
    const extraNS = namespaces.filter(ns => !expectedNS.includes(ns));

    perLocale[locale] = { missing: missingNS, extra: extraNS };
  });

  const missingNS = Object.entries(perLocale).filter(([_, { missing }]) => missing.length > 0);
  const extraNS = Object.entries(perLocale).filter(([_, { extra }]) => extra.length > 0);

  assertWarn(missingNS.length === 0,
    `Missing namespace files in locales: ${missingNS.map(([locale, { missing }]) => `\n  ${locale}: [ ${missing.join(", ")} ]`).join("")}`,
    "No missing namespaces in any locale"
  );

  assertWarn(extraNS.length === 0,
    `Extra namespace files in locales. Add or remove them: ${extraNS.map(([locale, { extra }]) => `\n  ${locale}: [ ${extra.join(", ")} ]`).join("")}`,
    "No extra namespaces in any locale"
  );
}

/** Does english have all keys to function as a fallback? */
async function TestKeyCompleteness() {
  const enKeys = expectedNS.flatMap((namespace) => getResolvedKeys(Locales.en, namespace));

  // Track both types of missing keys
  const missingFromOtherLocales: Record<string, string[]> = {};
  const missingFromEnglish: Record<string, string[]> = {};

  // Loop through all locales
  expectedLocales.forEach(locale => {
    const localeKeys = expectedNS.flatMap((namespace) => getResolvedKeys(locale, namespace));

    // Keys in English missing from this locale
    const keysNotInLocale = enKeys.filter(key => !localeKeys.includes(key));
    if (keysNotInLocale.length > 0) {
      missingFromOtherLocales[locale] = keysNotInLocale;
    }

    // Keys in this locale missing from English
    const keysNotInEnglish = localeKeys.filter(key => !enKeys.includes(key));
    missingFromEnglish[locale] = keysNotInEnglish;
  });

  const missingFromOtherLocalesNoEnglish = Object.fromEntries(Object.entries(missingFromOtherLocales).filter(([key, value]) => key !== Locales.en && value.length));
  const missingFromEnglishNoEnglish = Object.fromEntries(Object.entries(missingFromEnglish).filter(([key, value]) => key !== Locales.en && value.length));

  // Report missing keys in other locales
  assertWarn(Object.keys(missingFromOtherLocalesNoEnglish).length === 0,
    `Keys missing in other locales but present in English: ${JSON.stringify(missingFromOtherLocalesNoEnglish, null, 2)}`,
    "All English keys exist in all locales"
  );

  // Report missing keys in English
  assert(Object.keys(missingFromEnglishNoEnglish).length === 0,
    `Keys missing in English but present in: ${JSON.stringify(missingFromEnglishNoEnglish, null, 2)
    }. This is a problem if English is the fallback language.`,
    "English has the keys to function as a fallback"
  );
}

/** Do all the keys follow snake case? */
async function TestSnakeCase() {
  const perLocale: { [key: string]: string[] }
    = Object.fromEntries(expectedLocales.map(locale => [locale, []]));

  expectedLocales.forEach((locale) => {
    expectedNS.forEach((namespace) => {
      const keys = getResolvedKeys(locale, namespace);

      keys.forEach(key => {
        const noNS = key.split(":").at(-1);
        const parts = noNS?.split(".");
        if (!parts) return;

        if (parts.some(part => !/^[a-z0-9_]+$/.test(part))) {
          perLocale[locale].push(key);
        }
      });
    });
  });

  const totalBadKeys = Object.values(perLocale).flat().length;

  assertWarn(totalBadKeys === 0,
    `There are keys that are not snake_case: ${Object.entries(perLocale)
      .filter(([_, keys]) => keys.length > 0)
      .map(([locale, keys]) => `\n  ${locale}: [ ${keys.join(", ")} ]`)
      .join("")}`,
    "All keys are snake_case"
  );
}

/** Do namespaces use the values of common keys instead of referencing? */
async function TestMissedUseOfCommon() {

  const perLocale: { [key: string]: { [key: string]: string[] } }
    = Object.fromEntries(expectedLocales.map(locale => [locale, {}]));

  expectedLocales.forEach((locale) => {
    const commonFile = fs.readFileSync(`${localesDir}/${locale}/common.json`, "utf-8");

    try { JSON.parse(commonFile); }
    catch (e) {
      assert(false,
        `Failed to parse ${localesDir}/${locale}/common.json with error ${e}`,
        ""
      );
    }

    const commonValues = getFlattenedValues(locale, "common");

    expectedNS.forEach((namespace) => {
      // Skip common namespace since that's what we're checking against
      if (namespace === "common") return;

      const values = getFlattenedValues(locale, namespace);

      values.forEach(value => {
        commonValues.forEach(commonValue => {

          const escapedCommonValue = escape(commonValue);
          const patterns = [
            (text: string) => `\\s${text}\\s`, // Surrounding whitespace
            (text: string) => `^${text}$`, // Only thing in string
            (text: string) => `^${text}\\s`, // At start of string with whitespace after
            (text: string) => `\\s${text}$`, // At end of string with whitespace before
          ];
          const regex = new RegExp(patterns.map(pattern => pattern(escapedCommonValue)).join("|"), "g");

          if (value.match(regex)) {
            if (!perLocale[locale][namespace]) perLocale[locale][namespace] = [];
            perLocale[locale][namespace].push(`[${commonValue}] > '${value}'`);
          }
        });
      });
    });
  });

  const totalBadKeys = Object.values(perLocale).flat().length;

  assertWarn(totalBadKeys === 0,
    `These locale files might be using duplicate values defined in common: ${JSON.stringify(perLocale, null, 2)}\nUse ctrl+shift+f to find the perpetrators.`,
    ""
  );
}

/** Are all the nested keys used in locale files defined? */
function TestNestedKeysDefined() {

  const nestedTFunctionRegex = /\$t\(([^\)]+)\)/gmu;

  const perLocale: { [key: string]: { [key: string]: string[] } }
    = Object.fromEntries(expectedLocales.map(locale => [locale, {}]));


  expectedLocales.forEach((locale) => {
    const allNamespaceKeys = expectedNS.flatMap((namespace) => getResolvedKeys(locale, namespace));

    expectedNS.forEach((namespace) => {
      // Skip checking common namespace
      if (namespace === "common") return

      const values = getFlattenedValues(locale, namespace).join("\n");

      const tCalls = values.matchAll(nestedTFunctionRegex) || [];

      tCalls.forEach(call => {
        const [match, key] = call;

        if (allNamespaceKeys.includes(key)) return;

        if (!perLocale[locale][namespace]) perLocale[locale][namespace] = [];
        perLocale[locale][namespace].push(`[${key}] > '${match}'`);
      });
    });
  });

  const totalBadKeys = Object.values(perLocale).flat().length;

  assertWarn(totalBadKeys === 0,
    `These locale files have nested keys that are not defined: ${JSON.stringify(perLocale, null, 2)}\nUse ctrl+shift+f to find the perpetrators.`,
    ""
  );
}

/**  */
function TestNestedKeysSyntax() {
  const nestedTFunctionRegex = /\$t\(([^\)]+)\)/gmu;
  const escapedRegexes = expectedNS.map(ns => escape(ns)).join("|");
  const nsRegex = new RegExp(`^(${escapedRegexes}):`, "gm");

  const perLocale: { [key: string]: { [key: string]: string[] } }
    = Object.fromEntries(expectedLocales.map(locale => [locale, {}]));

  expectedLocales.forEach((locale) => {
    expectedNS.forEach((namespace) => {
      // Skip checking common namespace
      if (namespace === "common") return

      const values = getFlattenedValues(locale, namespace).join("\n");

      const tCalls = values.matchAll(nestedTFunctionRegex) || [];

      tCalls.forEach(call => {
        const [, key] = call;

        if (!key.includes(":")) {
          if (!perLocale[locale][namespace]) perLocale[locale][namespace] = [];
          perLocale[locale][namespace].push(`${key} - Missing namespace. Might be missing ':'`);
        }
        else if (!key.match(nsRegex)) {
          if (!perLocale[locale][namespace]) perLocale[locale][namespace] = [];
          perLocale[locale][namespace].push(`${key} - Missing namespace`);
        }
      });
    });
  });

  const totalBadKeys = Object.values(perLocale).flat().length;

  assertWarn(totalBadKeys === 0,
    `These locale files have nested keys that are not namespaced: ${JSON.stringify(perLocale, null, 2)}\nUse ctrl+shift+f to find the perpetrators.`,
    ""
  );
}


/** Run all tests */
TestLocalesDir();
TestNamespaces();
TestKeyCompleteness();
TestSnakeCase();
TestMissedUseOfCommon();
TestNestedKeysDefined();
TestNestedKeysSyntax();


/** Get all keys from a locale and namespace from the filesystem */
function getResolvedKeys(locale: Locales, namespace: string) {
  const file = `${localesDir}/${locale}/${namespace}.json`;
  try { JSON.parse(fs.readFileSync(file, "utf-8")); }
  catch (e) { assert(false, `Failed to parse ${file} with error ${e}`, `Parsed ${file}`); }

  const nestedData = JSON.parse(fs.readFileSync(file, "utf-8"));

  // Resolve all nested keys to [parent1].[..parentN].[key]
  const extractNestedKeys = (obj: LocaleJSON | null, prefix = ""): string[] => {
    // If leaf node, return key
    if (typeof obj !== "object" || obj === null) {
      return [prefix];
    }

    // Else, recurse into children
    return Object.keys(obj).flatMap(key => {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      return extractNestedKeys(obj[key], newPrefix);
    });
  };

  // Extract all keys with their full paths
  const keys = extractNestedKeys(nestedData);

  // Add namespace to keys
  const nsMappedKeys = keys.map(key => `${namespace}:${key}`);

  // Remove default keys which are dupes of every root key
  const noDefaultKeys = nsMappedKeys.filter(key => !key.includes(":default."));

  return noDefaultKeys;
}
/** Get all values from a locale and namespace from the filesystem */
function getFlattenedValues(locale: Locales, namespace: string) {
  const file = `${localesDir}/${locale}/${namespace}.json`;

  try { JSON.parse(fs.readFileSync(file, "utf-8")); }
  catch (e) {
    assert(false,
      `Failed to parse ${file} with error ${e}`,
      ""
    );
  }

  const nestedData = JSON.parse(fs.readFileSync(file, "utf-8"));

  // Resolve all nested keys to [parent1].[..parentN].[key]
  const extractNestedValues = (obj: LocaleJSON | null): string[] => {
    // If leaf node, return key
    if (typeof obj !== "object" || obj === null) {
      return [obj || ""];
    }

    // Else, recurse into children
    return Object.values(obj).flatMap(value => {
      return extractNestedValues(value);
    });
  };

  // Extract all keys with their full paths
  const values = extractNestedValues(nestedData);

  return values;
}

/** Assert with error and exit */
function assert(condition: boolean, badMessage: string, goodMessage?: string) {
  if (!condition) {
    console.error("❌ ", badMessage);
    process.exit(1);
  }
  else if (goodMessage) {
    console.info(
      { _color: colors.green },
      "✔ ", goodMessage
    );
  }
}
/** Warn instead of erroring out */
function assertWarn(condition: boolean, badMessage: string, goodMessage?: string) {
  if (!condition) {
    console.warn(colors.redBG("❕"), badMessage);
  }
  else if (goodMessage) {
    console.info(
      { _color: colors.gray },
      "ｉ", goodMessage
    );
  }
}

type LocaleJSON = NestedLocaleJSON | string;
interface NestedLocaleJSON {
  [key: string]: NestedLocaleJSON | string;
}
