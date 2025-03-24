/*
 * Fun to see:
 *  - If all keys exist in all locales.
 *  - Collect all keys and make a page of them to visually inspect.
 * 
 * Things to test and validate:
 *  - All english base keys exist in all locales. (maybe default count key?)
 *  - All keys used in the app exist in all locales.
 *  - Keys used in the app not directly referencing common namespace.
 *  - Values in common don't exist in other namespaces. Should reference common.
 * 
 * 
 * Other todos:
 *  - Handle failed loading of json better. Especially when changing locales.
 */

import "./lib/console.ts";
import { Locales, ns, uniqueLocales } from "i18n.config.ts";
import { glob } from "glob";
import fs from "node:fs";
import path from "node:path";
import { colors } from "./lib/colors.ts";

/** Where to find the locale files */
const localesDir = "public/locales";
/** Which folder to search for files with locale accesses */
const localeUsersDir = "src"
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
  const localeDirs = glob.sync(`${localesDir}/*/`);
  const localeNames = localeDirs.map((dir) => dir.split(/\/|\\/g).at(-1));
  const exactMatch = localeNames.every((name) => expectedLocales.includes(name as Locales));
  const unused = expectedLocales.filter((lng) => !localeNames.includes(lng));

  assertWarn(unused.length === 0,
    `There are unused locales. Remove or include: [ ${unused.join(", ")}]`,
    "",
  );

  assert(exactMatch,
    `There is not a locales directory for every supported locale. Missing: [ ${expectedLocales.filter((lng) => !localeNames.includes(lng)).join(", ")}]`,
    "All supported locales have a directory in the locales folder",
  );
}

/** Does every namespace exist in every locale? */
async function TestNamespaceFiles() {
  expectedLocales.forEach((locale) => {
    expectedNS.forEach((namespace) => {
      const file = `${localesDir}/${locale}/${namespace}.json`;
      assert(fs.existsSync(file),
        `Missing namespace file: ${file}`,
        ""
      );
    });
  });
}

/** Does english have all keys to function as a fallback? */
async function TestLocaleKeyCompleteness() {
  const enKeys = expectedNS.flatMap((namespace) => getResolvedKeys(Locales.en, namespace));

  // Track both types of missing keys
  const missingFromOtherLocales: Record<string, string[]> = {};
  const missingFromEnglish: Record<string, string[]> = {};

  // Single loop through all locales
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
  const badKeysByLocale: Record<string, string[]> = {};

  expectedLocales.forEach((locale) => {
    expectedNS.forEach((namespace) => {
      const keys = getResolvedKeys(locale, namespace);

      keys.forEach(key => {
        const noNS = key.split(":").at(-1);
        const parts = noNS?.split(".");
        if (!parts) return;

        if (parts.some(part => !/^[a-z0-9_]+$/.test(part))) {
          if (!badKeysByLocale[locale]) badKeysByLocale[locale] = [];
          badKeysByLocale[locale].push(key);
        }
      });
    });
  });

  const totalBadKeys = Object.values(badKeysByLocale).flat().length;

  assertWarn(totalBadKeys === 0,
    `There are keys that are not snake_case: ${Object.entries(badKeysByLocale)
      .filter(([_, keys]) => keys.length > 0)
      .map(([locale, keys]) => `\n  ${locale}: [ ${keys.join(", ")} ]`)
      .join("")}`,
    "All keys are snake_case"
  );
}


/** Run all tests */
TestLocalesDir();
TestNamespaceFiles();
TestLocaleKeyCompleteness();
TestSnakeCase();


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
    console.warn("❕", badMessage);
  }
  else if (goodMessage) {
    console.info("ｉ", goodMessage);
  }
}

type LocaleJSON = NestedLocaleJSON | string;
interface NestedLocaleJSON {
  [key: string]: NestedLocaleJSON | string;
}
