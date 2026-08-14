import fs from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";
import { allNamespaces, Locales } from "../../i18n.config";
import {
  allPermutations,
  escapeRegExp,
  filteredLocales,
  getAllJSONFlattened,
  getAllTSXFiles,
  isKeyDefined,
  localesDir,
  nestedTRegex,
  tCallRegex,
  validPluralSuffixes,
} from "../../scripts/lib/localeKeyScan.ts";

/*
 **********
 * Config *
 **********
 */

/*
 * Only breaking checks live here. Non-breaking reports (unused/dead keys and
 * empty values) live in `scripts/findDeadLocaleKeys.ts`, run via `yarn check:locales`.
 */

/** Every NS file per locale with their flattened key-values. */
const allJSON = getAllJSONFlattened();

/** The app files to check. */
const allTSX = getAllTSXFiles();

/** Since the translation system uses client and server side instances of i18next, we test for mismatches. */
const tServerUsageIndications = ["@/lib/i18nServer", "serveTea("];
const tClientUsageIndications = ["useTranslation"];
const serverIndications = ["server-only", "use server", "next/server", "next/headers", "export default async function", "export async function"];
const clientIndications = ["client-only", "use client", "useEffect", "useMemo", "useState", "useRef"];
const serverSideFilesOverride = ["page.tsx", "layout.tsx"].map(file => file && path.join(...file.split("/")));
const clientSideFilesOverride: string[] = ([] as string[]).map(file => file && path.join(...file.split("/")));
const exemptedMixedUseFiles = ["src/app/tests/locale/page.tsx"].map(file => file && path.join(...file.split("/")));

/** When checking for mixed use of spaces these are allowed in any file */
const keysAllowedDirectlyInApp = ["common:tsx.", "common:placeholder.", "common:scope.", "common:layout.", "common:count.", "common:new.", "common:edit", "common:scaling_methods", "common:css.", "common:404."];

/** The Swedish regex is used to find hard coded swedish in the app */
const swedishRegex = /(?<!\/\/|\*|\/\*|\/\*\*|^\s*\*\s*)(?:\w*[åäöÅÄÖ]+\w*)+/gim;


/*
 * Exceptions
 */

/** Almost always prefer having nested $t() calls to common in namespaces over using duplicate values. Exceptions to that need to be here. */
const exemptedCommonKeysRef = ["common:tsx.", "common:placeholder."]; // Things that shouldn't always be referenced
/** When checking if a value may be a duplicate of a common value, values starting with any of these strings will be skipped.  */
const exemptedCommonValuesRef: string[] = []; // More fine grained option to the above one (useful for language specific exemptions)
/** To prevent recurring false positives, exempt these keys */
const exemptedKeysUsingCommonValues = ["pages:info.info_body", "components:confirm_delete.confirmation"];
/** Orphaned keys in root levels of namespaces are discouraged, except in these namespaces */
const exemptedOrphanNS = ["common"];
const exemptedOrphanKeys: string[] = [];

/*
 *********
 * Tests *
 *********
 */

/* Does every namespace exist in every locale? */
test.describe("Namespace files exist", () => {
  // Track missing and extra namespaces per locale
  const perLocale = Object.fromEntries(filteredLocales.map(locale =>
    [locale as Locales, { missing: [] as string[], extra: [] as string[], empty: [] as string[] }],
  ));

  filteredLocales.forEach(locale => {
    const nsFiles = fs.globSync(`${localesDir}/${locale}/*.json`);
    const nsFilesNames = nsFiles.map(file => path.basename(file, ".json"));

    const missingNS = allNamespaces.filter(ns => !nsFilesNames.includes(ns));
    const extraNS = nsFilesNames.filter(ns => !allNamespaces.includes(ns));
    const emptyNS = nsFilesNames.filter(ns => {
      const filePath = path.join(localesDir, locale, `${ns}.json`);
      const content = fs.readFileSync(filePath, "utf-8").trim();
      return !content || content === "{}";
    });

    if (missingNS.length > 0) perLocale[locale].missing.push(...missingNS);
    if (extraNS.length > 0) perLocale[locale].extra.push(...extraNS);
    if (emptyNS.length > 0) perLocale[locale].empty.push(...emptyNS);
  });

  const missingNS = Object.entries(perLocale).filter(([_, { missing }]) => missing.length > 0);
  const extraNS = Object.entries(perLocale).filter(([_, { extra }]) => extra.length > 0);
  const emptyNS = Object.entries(perLocale).filter(([_, { empty }]) => empty.length > 0);

  test("Missing namespaces", () => expect(missingNS.length, `Missing namespaces in locales: ${JSON.stringify(missingNS, null, 2)}`).toBe(0));
  test("Extra namespaces", () => expect(extraNS.length, `Extra namespaces in locales: ${JSON.stringify(extraNS, null, 2)}`).toBe(0));
  test("Empty namespaces", () => expect(emptyNS.length, `Empty namespaces in locales: ${JSON.stringify(emptyNS, null, 2)}`).toBe(0));
});

/* Does english have all keys to function as a fallback? */
test.describe("English as fallback", () => {
  const enKeys = Object.keys(allJSON[Locales.default]);

  // Track both types of missing keys
  const missingInOthers: Record<string, string[]> = {};
  const missingInEnglish: Record<string, string[]> = {};

  filteredLocales.forEach((locale) => {
    const keys = Object.keys(allJSON[locale]);
    const missingOther = enKeys.filter(key => !keys.includes(key));
    const missingEng = keys.filter(key => !enKeys.includes(key));

    if (missingOther.length > 0) missingInOthers[locale] = missingOther;
    if (missingEng.length > 0) missingInEnglish[locale] = missingEng;
  });

  test("Missing keys in non-english locales", () => expect(Object.keys(missingInOthers).length, `Missing keys in non-english locales: ${JSON.stringify(missingInOthers, null, 2)}`).toBe(0));
  test("Missing keys in english", () => expect(Object.keys(missingInEnglish).length, `Missing keys in english: ${JSON.stringify(missingInEnglish, null, 2)}`).toBe(0));
});

/** Do namespaces use the values of common keys instead of referencing? */
test.skip("Common values not referenced", () => {
  const perLocaleNS: Record<string, Record<string, string[]>>
    = Object.fromEntries(filteredLocales.map(locale => [locale, {}]));

  /** To minimize false positives, the values will have to match one of these */
  const wordPatterns = [
    (text: string) => `\\s${text}\\s`, // Surrounding whitespace
    (text: string) => `^${text}$`, // Only thing in string
    (text: string) => `^${text}\\s`, // At start of string with whitespace after
    (text: string) => `\\s${text}$`, // At end of string with whitespace before
  ];

  filteredLocales.forEach((locale) => {
    const commonTranslations = Object.fromEntries(Object.entries(allJSON[locale])
      .filter(([key]) => key.startsWith("common:"))
      .filter(([key]) => !exemptedCommonKeysRef.some(exemptedKey => key.startsWith(exemptedKey)))
      .filter(([, value]) => !exemptedCommonValuesRef.some(exemptedValue => value.startsWith(exemptedValue)))
      .map(([key, value]) => [key, { key, value, pattern: wordPatterns.map(pattern => new RegExp(pattern(escapeRegExp(value)), "gm")) }]),
    );

    const namespacesToCheck = allNamespaces.filter(ns => ns !== "common");

    const everyOtherTranslation = Object.fromEntries(Object.entries(allJSON[locale])
      .filter(([key]) => namespacesToCheck.some(ns => key.startsWith(ns)))
      .filter(([key]) => !exemptedKeysUsingCommonValues.some(exemptedKey => key.startsWith(exemptedKey))),
    );

    Object.entries(everyOtherTranslation).forEach(([key, value]) => {
      Object.entries(commonTranslations).forEach(([commonKey, commonValues]) => {
        // Check if the value matches any of the patterns
        const hasCommonValue = commonValues.pattern.some(p => p.test(value));
        if (hasCommonValue) {
          if (!perLocaleNS[locale][commonKey]) perLocaleNS[locale][commonKey] = [];
          perLocaleNS[locale][commonKey].push(`[${commonKey}] > '${key}': '${value}'`);
        }
      });
    });
  });

  const totalBadKeys = Object.values(perLocaleNS).flatMap(commonKeys => Object.values(commonKeys)).flat().length;
  expect(totalBadKeys, `Common keys used as values: ${JSON.stringify(perLocaleNS, null, 2)}`).toBe(0);
});

/** Are all the nested keys used in locale files defined? */
test("Are nested keys defined", () => {
  const perLocale: Record<string, string[]>
    = Object.fromEntries(filteredLocales.map(locale => [locale, []]));

  filteredLocales.forEach(locale => {
    const translations = Object.entries(allJSON[locale])
      .map(([key, value]) => [key, {
        value, nested: Array.from(value.matchAll(nestedTRegex)), // Find all nested t() calls
      }]);

    (translations as [string, { value: string, nested: [RegExpMatchArray, `${string}:${string}`][] }][]).forEach(([key, values]) => {
      values.nested.forEach(([match, nestedKey]) => {

        // Is defined?
        if (allJSON[locale][nestedKey]) return;

        // Is it a valid namespace?
        const nestedNS = /(^[^:]+):/gm.exec(nestedKey)?.[0];
        if (!nestedNS) {
          if (!perLocale[locale]) perLocale[locale] = [];
          perLocale[locale].push(`[Missing namespace] > '${key}': '${values.value}'`);
          return;
        }

        // Does it have arguments?
        const hasArgs = nestedKey.includes(",") && nestedKey.includes("{") && nestedKey.includes("}");
        if (hasArgs) {
          // Find and escape the arguments
          const args = nestedKey
            .replace(/.*?:.*?,\s*/gm, "") // Remove key part
            .replace(/(?<=".*?":\s*)([^"']*?)(?=\s*,|\s*}$)/gm, "\"$1\""); // var => "var"

          // Notice on argument, syntax error
          try { JSON.parse(args); }
          catch {
            if (!perLocale[locale]) perLocale[locale] = [];
            perLocale[locale].push(`[Syntax error: args] > '${key}': '${values.value}'`);
            return;
          }

          // If so, will the key resolve to something valid?
          const baseKey = nestedKey.split(",")[0];
          const allVariants = validPluralSuffixes.map(suffix => `${baseKey}${suffix}`);
          const isValid = allVariants.some(variant => allJSON[locale][variant]);
          if (isValid) return; // Valid plural key
          if (!isValid) {
            if (!perLocale[locale]) perLocale[locale] = [];
            perLocale[locale].push(`[Missing plural key] > '${key}': '${values.value}'`);
          }
        }

        // Handle formatters, added after formatters moved into t parentheses
        const hasFormatter = /(.*?:.*?,\s*)\w+$/gm.test(nestedKey);
        if (hasFormatter) {
          const noFormat = nestedKey.replace(/,\s?\w+$/gm, ""); // Remove the formatter part
          if (allJSON[locale][noFormat]) return; // Valid key without formatter
        }

        if (!perLocale[locale]) perLocale[locale] = [];
        perLocale[locale].push(`[${key}] > '${match.toString()}'`);
      });
    });
  });

  const totalBadKeys = Object.values(perLocale).flat().length;

  expect(totalBadKeys, `Nested keys not defined: ${JSON.stringify(perLocale, null, 2)}`).toBe(0);
});

/** Variable syntax in the JSON files i.e. {{var}}, {{var, formatter}} syntax */
test("Variable syntax in JSON files", () => {
  const perLocale: Record<string, string[]>
    = Object.fromEntries(filteredLocales.map(locale => [locale, []]));

  filteredLocales.forEach(locale => {
    const translations = Object.entries(allJSON[locale])
      .filter(([, value]) => value.includes("{") || value.includes("}"));

    translations.forEach(([key, value]) => {
      let count = 0;
      value.split("").forEach(char => {
        if (char === "{") count++;
        if (char === "}") count--;

        if (count < 0) {
          if (!perLocale[locale]) perLocale[locale] = [];
          perLocale[locale].push(`[Missing '{'] > '${key}': '${value}'`);
          return;
        }
      });
      if (count > 0) {
        if (!perLocale[locale]) perLocale[locale] = [];
        perLocale[locale].push(`[Missing '}'] > '${key}': '${value}'`);
      }
      if (count === 0) return; // Valid syntax

      if (!perLocale[locale]) perLocale[locale] = [];
      perLocale[locale].push(`[Syntax error: '{' & '}' usage] > '${key}': '${value}'`);
    });
  });

  const totalBad = Object.values(perLocale).flat().length;

  expect(totalBad, `Invalid variable syntax: ${JSON.stringify(perLocale, null, 2)}`).toBe(0);
});

/** Shows any keys in root of their ns file which only has a string as a value instead of an object */
test("Orphan keys in root of namespace files", () => {
  const perLocale: Record<string, string[]> = {};

  allPermutations.forEach(([locale, namespace]) => {
    if (exemptedOrphanNS.includes(namespace)) return; // Skip exempted namespaces

    const filePath = path.join(localesDir, locale, `${namespace}.json`);

    // Read file instead of allData to not get flattened data
    const content = fs.readFileSync(filePath, "utf-8").toString().trim();

    try {
      const parseTest: unknown = JSON.parse(content);
      if (typeof parseTest !== "object" || parseTest === null || Array.isArray(parseTest)) {
        throw new Error("Not an object");
      }
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      perLocale[locale] ??= [];
      perLocale[locale].push(`[Invalid JSON] > '${namespace}.json': ${errorMessage}`);
      return;
    }

    const data = JSON.parse(content) as Record<string, unknown>;
    const keys = Object.keys(data);

    keys.forEach(key => {
      if (exemptedOrphanKeys.some(exemptedKey => key.startsWith(exemptedKey))) return; // Skip exempted keys
      if (typeof data[key] === "string") {
        const value = data[key];
        if (!perLocale[locale]) perLocale[locale] = [];
        perLocale[locale].push(`[Orphan key] > '${namespace}:${key}': '${value}'`);
      }
    });
  });

  const totalBad = Object.values(perLocale).flat().length;

  expect(totalBad, `Orphan keys in root of namespace files: ${JSON.stringify(perLocale, null, 2)}`).toBe(0);
});

/** Checks if a file that is likely server or client side is using the wrong import method of t() */
test("Mixed server and client side code", () => {
  const perFile: Record<string, string[]> = {};

  allTSX.forEach(({ filePath, content }) => {
    if (exemptedMixedUseFiles.some(file => filePath.endsWith(file))) return; // Skip exempted files

    const usingTServer = tServerUsageIndications.some(indication => content.includes(indication));
    const usingTClient = tClientUsageIndications.some(indication => content.includes(indication));

    if (!usingTServer && !usingTClient) return; // Skip if not using t()
    if (usingTServer && usingTClient) {
      if (!perFile[filePath]) perFile[filePath] = [];
      perFile[filePath].push("Found both server and client side translations");
    }

    const serverOverride = serverSideFilesOverride.some(file => filePath.endsWith(file));
    const clientOverride = clientSideFilesOverride.some(file => filePath.endsWith(file));
    const isServer = serverIndications.some(indication => content.includes(indication) || (serverOverride && !clientOverride));
    const isClient = clientIndications.some(indication => content.includes(indication) || (clientOverride && !serverOverride));

    if (isServer && isClient) {
      if (!perFile[filePath]) perFile[filePath] = [];
      perFile[filePath].push("Found both server and client side code");
    }

    // Kind of a bs condition, it's fine if it's not either 🤷‍♀️ TODO: clean up
    // if (!isServer && !isClient) {
    //   if (!perFile[filePath]) perFile[filePath] = [];
    //   const serverIndicationsFound = serverIndications.filter(indication => content.includes(indication));
    //   const clientIndicationsFound = clientIndications.filter(indication => content.includes(indication));
    //   perFile[filePath].push(`Ambiguous file. Found server indications: ${serverIndicationsFound.length > 0 ? JSON.stringify(serverIndicationsFound) : "None"}, client indications: ${clientIndicationsFound.length > 0 ? JSON.stringify(clientIndicationsFound) : "None"}`);
    // }

    if (isClient && !usingTClient) {
      if (!perFile[filePath]) perFile[filePath] = [];
      perFile[filePath].push("Client side file using server side translations");
    }

    if (isServer && !usingTServer) {
      if (!perFile[filePath]) perFile[filePath] = [];
      perFile[filePath].push("Server side file using client side translations");
    }

    if (usingTServer && usingTClient) {
      if (!perFile[filePath]) perFile[filePath] = [];
      perFile[filePath].push("Found both server and client side i18n functions");
    }
  });

  const totalBad = Object.values(perFile).flat().length;

  expect(totalBad, `Server and client side code mixed: ${JSON.stringify(perFile, null, 2)}`).toBe(0);
});

/** Checks if all t() calls in the tsx use keys that are defined, including calls with an options argument */
test("Keys used in app are not defined", () => {
  const perFile: Record<string, string[]> = {};

  allTSX.forEach(({ filePath, content }) => {
    const allTCalls = Array.from(content.matchAll(tCallRegex));

    allTCalls.forEach(call => {
      const [, key] = call;

      filteredLocales.forEach(locale => {
        if (isKeyDefined(key, allJSON[locale])) return; // Defined directly or as a plural variant
        if (!perFile[filePath]) perFile[filePath] = [];
        perFile[filePath].push(`[Undefined key] > '${locale}': '${key}'`);
      });
    });
  });

  const totalBad = Object.values(perFile).flat().length;

  expect(totalBad, `Keys used in app are not defined in JSON: ${JSON.stringify(perFile, null, 2)}`).toBe(0);
});

/** Checks whether a file is consistent with namespaces and first level keys */
test.skip("Common keys used directly in files", () => {
  const perFile: Record<string, string[]> = {};

  allTSX.forEach(({ filePath, content }) => {
    const allTCalls = Array.from(content.matchAll(tCallRegex));
    if (allTCalls.length === 0) return; // Skip if no t() calls

    allTCalls.forEach(call => {
      const [, key] = call;
      if (keysAllowedDirectlyInApp.some(allowedKey => key.startsWith(allowedKey))) return; // Skip allowed keys

      const namespace = /(^[^:]+):/.exec(key)?.[1];
      if (!namespace) return; // Skip if no namespace

      if (namespace === "common") {
        perFile[filePath] = perFile[filePath] || [];
        perFile[filePath].push(`[Common key used directly] > '${key}'`);
      }
    });
  });

  const totalBadKeys = Object.values(perFile).flat().length;

  expect(totalBadKeys, `Common keys used directly in files: ${JSON.stringify(perFile, null, 2)}`).toBe(0);
});

/** Checks if the <Trans /> tags have a defined i18nKey */
test("<Trans /> keys", () => {
  const perFile: Record<string, string[]> = {};

  /** Trans tags need a prop called i18nKey which this regex finds */
  const i18nKeyRegex = /(?<=<Trans(?:\r?\n.*)*)i18nKey=["'](.*?)["'](?=(?:\r?\n.*)*\/>)/gmu;

  allTSX.forEach(({ filePath, content }) => {
    const calls = Array.from(content.matchAll(i18nKeyRegex)) || [];

    calls.forEach(call => {
      const [match, key] = call;
      const isValidKey = key && isKeyDefined(key, allJSON[Locales.default]); // Check if key is valid

      if (!isValidKey) {
        if (!perFile[filePath]) perFile[filePath] = [];
        perFile[filePath].push(`[Invalid i18nKey] > '${match}'`);
      }
    });
  });

  const totalBadKeys = Object.values(perFile).flat().length;

  expect(totalBadKeys, `Invalid i18nKey: ${JSON.stringify(perFile, null, 2)}`).toBe(0);
});

/** Checks if the <Trans /> tags have valid syntax */
test("<Trans /> syntax", () => {
  const perFile: Record<string, string[]> = {};

  const transTagRegex = /<Trans.*?\/>(?!\s*\}\})(?!,)/gmus;

  allTSX.forEach(({ filePath, content }) => {
    const calls = Array.from(content.matchAll(transTagRegex)) || [];

    calls.forEach(call => {
      const [matchTrans] = call;
      const collapsedWhitespace = matchTrans.replace(/\s+/g, " ");

      const i18nKeyStringMatch = /\si18nKey=["'](.*?)["']/.exec(collapsedWhitespace);
      const i18nKeyVarMatch = /\si18nKey=\{(.*?)\}/.exec(collapsedWhitespace);

      if (i18nKeyVarMatch) return; // Skip if it's a variable

      // Missing key
      if (!i18nKeyStringMatch) {
        if (!perFile[filePath]) perFile[filePath] = [];
        perFile[filePath].push(`[Missing i18nKey] > '${matchTrans}'`);
        return;
      }

      const i18nKey = i18nKeyStringMatch[1];
      const componentsMatch = /\scomponents=\{\{(.*?)\}\}/.exec(collapsedWhitespace);

      // TODO: Maybe use a more sophisticated check for this?
      const componentsInTag = componentsMatch && componentsMatch[1] !== "null" && componentsMatch[1] !== "undefined";
      const componentsInValue = allJSON[Locales.default][i18nKey]?.includes("<") || allJSON[Locales.default][i18nKey]?.includes(">");

      if (componentsInTag && !componentsInValue) {
        if (!perFile[filePath]) perFile[filePath] = [];
        perFile[filePath].push(`[Missing components in value] > '${collapsedWhitespace}'`);
      }
      if (!componentsInTag && componentsInValue) {
        if (!perFile[filePath]) perFile[filePath] = [];
        perFile[filePath].push(`[Missing components in tag] > '${collapsedWhitespace}'`);
      }
      if (componentsInTag && componentsInValue) return; // Valid syntax
    });
  });

  const totalBadKeys = Object.values(perFile).flat().length;

  expect(totalBadKeys, `Invalid <Trans /> syntax: ${JSON.stringify(perFile, null, 2)}`).toBe(0);
});

/** Check for Swedish text in code files that should be internationalized */
test("No hardcoded Swedish text in code", () => {
  // TODO: Needs better implementation, with ability to allow certain hardcoded strings, better detection (of all hardcoded strings, not just Swedish), etc.
  test.skip();

  const perFile: Record<string, string[]> = {};

  allTSX.forEach(({ filePath, content }) => {
    // Split content by lines to report line numbers
    const lines = content.split(/\r?\n/);
    const matches: { line: number, text: string, context: string }[] = [];

    // Check each line for Swedish text
    lines.forEach((line, index) => {
      if (!line.trim()) return; // Skip empty lines

      const lineMatches = Array.from(line.matchAll(swedishRegex) || []);
      if (lineMatches.length > 0) {
        lineMatches.forEach(match => {
          matches.push({
            line: index + 1,
            text: match[0],
            context: line,
          });
        });
      }
    });

    if (matches.length > 0) {
      perFile[filePath] = matches.map(m => `[Line ${m.line}] > '${m.text}' in: '${m.context.trim()}'`);
    }
  });

  const totalMatches = Object.values(perFile).flat().length;

  expect(totalMatches, `Found Swedish text that should be internationalized: ${JSON.stringify(perFile, null, 2)}`).toBe(0);
});
