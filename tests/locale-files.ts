import "./lib/console.js";
import { colors } from "./lib/colors.js";
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";
import { expect, test } from "playwright/test";
import escape from "regexp.escape"; // Polyfill for RegExp.escape. Not in node yet.

/* 
 **********
 * Config *
 **********
 */

/** The locale type */
enum Locales { enSE = "en-SE", svSE = "sv-SE", default = enSE, };

/** All locales */
const uniqueLocales = [...new Set(Object.values(Locales))];

/** The language switcher uses these values */
const localeAliases = { [Locales.enSE]: "English", [Locales.svSE]: "Svenska", };

/** All namespaces */
const namespaces = ["common", "forms", "components", "graphs", "pages", "email", "test",];

/** Where the locale files are located relative to project root. */
const localesDir = "public/locales";

/** Every combo of locale and ns in a 2d array. */
const allPermutations = uniqueLocales.flatMap(locale => namespaces.map(namespace => [locale, namespace]));

/** Every NS file per locale with their flattened key-values. */
const allJSON = getAllJSONFlattened();

/** The app files to check. */
const allTSX = getAllTSXFiles();

/** When validating pluralized translations, use these to determine if a base key isa valid. */
const validPluralSuffixes = ["_one", "_two", "_few", "_many", "_other", "_zero",];

/** Since the translation system uses client and server side instances of i18next, we test for mismatches. */
const tServerUsageIndications = ["@/lib/i18nServer",];
const tClientUsageIndications = ["react-i18next", "useTranslation", "<Trans",];
const serverIndications = ["use server", "next/server", "next/headers", "accessChecker",];
const clientIndications = ["use client", "useEffect", "useMemo", "useState", "useRef",];
const serverSideFilesOverride = ["page.tsx", "layout.tsx",];
const clientSideFilesOverride = ["src\\app\\verify\\page.tsx", "src\\app\\verify\\verify\\page.tsx", "src\\app\\password\\page.tsx", "src\\app\\password\\reset\\page.tsx"];

/** When checking for mixed use of spaces these are allowed in any file */
const keysAllowedDirectlyInApp = ["common:tsx.", "common:placeholder.", "common:scope.", "common:layout.", "common:count.", "common:new.", "common:edit", "common:scaling_methods", "common:css.", "common:404."];


/* 
 * Exceptions
 */

/** Almost always prefer having nested $t() calls to common in namespaces over using duplicate values. Exceptions to that need to be here. */
const exemptedCommonKeysRef = ["common:tsx.", "common:placeholder.",]; // Things that shouldn't always be referenced
/** When checking if a value may be a duplicate of a common value, values starting with any of these strings will be skipped.  */
const exemptedCommonValuesRef = []; // More fine grained option to the above one (useful for language specific exemptions)
/** To prevent recurring false positives, exempt these keys */
const exemptedKeysUsingCommonValues = ["pages:info.info_body", "components:confirm_delete.confirmation",];
/** Orphaned keys in root levels of namespaces are discouraged, except in these namespaces */
const exemptedOrphanNS = ["common", "test",];
const exemptedOrphanKeys = [];


/* 
 *********
 * Tests *
 *********
 */

/* Does every namespace exist in every locale? */
test.describe("Namespace files exist", async () => {
  // Track missing and extra namespaces per locale
  const perLocale = Object.fromEntries(uniqueLocales.map(locale =>
    [locale as Locales, { missing: [] as string[], extra: [] as string[], empty: [] as string[] }]
  ));

  uniqueLocales.forEach(locale => {
    const nsFiles = glob.sync(`${localesDir}/${locale}/*.json`);
    const nsFilesNames = nsFiles.map(file => path.basename(file, ".json"));

    const missingNS = namespaces.filter(ns => !nsFilesNames.includes(ns));
    const extraNS = nsFilesNames.filter(ns => !namespaces.includes(ns));
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

  uniqueLocales.forEach((locale) => {
    const keys = Object.keys(allJSON[locale]);
    const missingOther = enKeys.filter(key => !keys.includes(key));
    const missingEng = keys.filter(key => !enKeys.includes(key));

    if (missingOther.length > 0) missingInOthers[locale] = missingOther;
    if (missingEng.length > 0) missingInEnglish[locale] = missingEng;
  });

  test("Missing keys in non-english locales", () => expect(Object.keys(missingInOthers).length, `Missing keys in non-english locales: ${JSON.stringify(missingInOthers, null, 2)}`).toBe(0));
  test("Missing keys in english", () => expect(Object.keys(missingInEnglish).length, `Missing keys in english: ${JSON.stringify(missingInEnglish, null, 2)}`).toBe(0));
});

/** Do all the keys follow snake case? */
test("Keys are snake_case", () => {
  const perLocale: Record<string, string[]> = Object.fromEntries(uniqueLocales.map(locale => [locale, []]));

  uniqueLocales.forEach((locale) => {
    const keys = Object.keys(allJSON[locale]);
    keys.forEach(key => {
      const noNS = key.replace(/^[^:]+:/, "");
      const parts = noNS.split(".");
      if (!parts) return;

      if (parts.some(part => !/^[a-z0-9_]+$/.test(part))) {
        perLocale[locale].push(key);
      }
    });
  });

  const totalBadKeys = Object.values(perLocale).flat().length;

  expect(totalBadKeys, `Keys not in snake_case: ${JSON.stringify(perLocale, null, 2)}`).toBe(0);
});

/** Do namespaces use the values of common keys instead of referencing? */
test("Common values not referenced", () => {
  const perLocaleNS: Record<string, Record<string, string[]>>
    = Object.fromEntries(uniqueLocales.map(locale => [locale, {}]));

  /** To minimize false positives, the values will have to match one of these */
  const wordPatterns = [
    (text: string) => `\\s${text}\\s`, // Surrounding whitespace
    (text: string) => `^${text}$`, // Only thing in string
    (text: string) => `^${text}\\s`, // At start of string with whitespace after
    (text: string) => `\\s${text}$`, // At end of string with whitespace before
  ];

  uniqueLocales.forEach((locale) => {
    const commonTranslations = Object.fromEntries(Object.entries(allJSON[locale])
      .filter(([key,]) => key.startsWith("common:"))
      .filter(([key,]) => !exemptedCommonKeysRef.some(exemptedKey => key.startsWith(exemptedKey)))
      .filter(([, value]) => !exemptedCommonValuesRef.some(exemptedValue => value.startsWith(exemptedValue)))
      .map(([key, value]) => [key, { key, value, pattern: wordPatterns.map(pattern => new RegExp(pattern(escape(value)), "gm")) }])
    );

    const namespacesToCheck = namespaces.filter(ns => ns !== "common");

    const everyOtherTranslation = Object.fromEntries(Object.entries(allJSON[locale])
      .filter(([key,]) => namespacesToCheck.some(ns => key.startsWith(ns)))
      .filter(([key,]) => !exemptedKeysUsingCommonValues.some(exemptedKey => key.startsWith(exemptedKey)))
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

  const totalBadKeys = Object.values(flattenTree(perLocaleNS)).length;
  expect(totalBadKeys, `Common keys used as values: ${JSON.stringify(perLocaleNS, null, 2)}`).toBe(0);
});

/** Are all the nested keys used in locale files defined? */
test("Are nested keys defined", () => {
  const perLocale: Record<string, string[]>
    = Object.fromEntries(uniqueLocales.map(locale => [locale, []]));

  const nestedTRegex = /\$t\((.*?)\)/gm;

  uniqueLocales.forEach(locale => {
    const translations = Object.entries(allJSON[locale])
      .map(([key, value]) => [key, {
        value, nested: Array.from(value.matchAll(nestedTRegex)) // Find all nested t() calls
      }]);

    (translations as [string, { value: string, nested: [RegExpMatchArray, string][] }][]).forEach(([key, values]) => {
      values.nested.forEach(([match, nestedKey]) => {

        // Is defined?
        if (allJSON[locale][nestedKey]) return;

        // Is it a valid namespace?
        const nestedNS = nestedKey.match(/[^:]+:/)?.[0];
        if (!nestedNS) {
          if (!perLocale[locale]) perLocale[locale] = [];
          perLocale[locale].push(`[Missing namespace] > '${key}': '${values.value}'`);
          return;
        }

        // Does it have arguments?
        const hasArgs = nestedKey.includes(",");
        if (hasArgs) {
          // Find and escape the arguments
          const args = nestedKey
            .replace(/.*?:.*?,\s*/gm, "") // Remove key part
            .replace(/(?<=\".*?\":\s*)([^"']*?)(?=\s*,|\s*}$)/gm, "\"$1\"") // var => "var"

          // Notice on argument, syntax error
          try { JSON.parse(args); }
          catch (e) {
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

        if (!perLocale[locale]) perLocale[locale] = [];
        perLocale[locale].push(`[${key}] > '${match}'`);
      });
    });
  });

  const totalBadKeys = Object.values(flattenTree(perLocale)).length;

  expect(totalBadKeys, `Nested keys not defined: ${JSON.stringify(perLocale, null, 2)}`).toBe(0);
});

/** Variable syntax in the JSON files i.e. {{var}}, {{var, formatter}} syntax */
test("Variable syntax in JSON files", () => {
  const perLocale: Record<string, string[]>
    = Object.fromEntries(uniqueLocales.map(locale => [locale, []]));

  uniqueLocales.forEach(locale => {
    const translations = Object.entries(allJSON[locale])
      .filter(([, value]) => value.includes("{") || value.includes("}"));

    translations.forEach(([key, value]) => {
      let count = 0;
      for (let i = 0; i < value.length; i++) {
        const char = value[i];

        if (char === "{") count++;
        if (char === "}") count--;

        if (count < 0) {
          if (!perLocale[locale]) perLocale[locale] = [];
          perLocale[locale].push(`[Missing '{'] > '${key}': '${value}'`);
          break;
        }
      }
      if (count > 0) {
        if (!perLocale[locale]) perLocale[locale] = [];
        perLocale[locale].push(`[Missing '}'] > '${key}': '${value}'`);
      }
      if (count === 0) return; // Valid syntax

      if (!perLocale[locale]) perLocale[locale] = [];
      perLocale[locale].push(`[Syntax error: '{' & '}' usage] > '${key}': '${value}'`);
    });
  });

  const totalBad = Object.values(flattenTree(perLocale)).length;

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

    try { JSON.parse(content); }
    catch (e) {
      if (!perLocale[locale]) perLocale[locale] = [];
      perLocale[locale].push(`[Invalid JSON] > '${namespace}.json': '${e}'`);
      return;
    }

    const data = JSON.parse(content);
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
test("Server and client side code is not mixed", () => {
  const perFile: Record<string, string[]> = {};

  allTSX.forEach(({ filePath, content }) => {
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

    if (!isServer && !isClient) {
      if (!perFile[filePath]) perFile[filePath] = [];
      perFile[filePath].push("Ambiguous file");
    }

    if (isClient && !usingTClient) {
      if (!perFile[filePath]) perFile[filePath] = [];
      perFile[filePath].push("Client side file using server side translations");
    }

    if (isServer && !usingTServer) {
      if (!perFile[filePath]) perFile[filePath] = [];
      perFile[filePath].push("Server side file using client side translations");
    }

    if (isClient && isServer) {
      if (!perFile[filePath]) perFile[filePath] = [];
      perFile[filePath].push("Found both server and client side code");
    }

    if (usingTServer && usingTClient) {
      if (!perFile[filePath]) perFile[filePath] = [];
      perFile[filePath].push("Found both server and client side i18n functions");
    }
  });

  const totalBad = Object.values(perFile).flat().length;

  expect(totalBad, `Server and client side code mixed: ${JSON.stringify(perFile, null, 2)}`).toBe(0);
});

/** Checks if all t() calls in the tsx have a defined namespace  */
test("Keys used in app are not defined", () => {
  const perFile: Record<string, string[]> = {};

  allTSX.forEach(({ filePath, content }) => {
    const allTCalls = Array.from(content.matchAll(/\Wt\(["']([^"']*)["']\)/gm)) || [];

    allTCalls.forEach(call => {
      const [, key] = call;

      uniqueLocales.forEach(locale => {
        if (allJSON[locale][key]) return; // Skip if key is defined
        if (!perFile[filePath]) perFile[filePath] = [];
        perFile[filePath].push(`[Undefined key] > '${locale}': '${key}'`);
      });
    });
  });

  const totalBad = Object.values(perFile).flat().length;

  expect(totalBad, `Keys used in app are not defined in JSON: ${JSON.stringify(perFile, null, 2)}`).toBe(0);
});

/** Checks whether a file is consistent with namespaces and first level keys */
test("Namespace consistency in app", () => {
  const perFile: Record<string, string[]> = {};

  allTSX.forEach(({ filePath, content }) => {
    const allTCalls = Array.from(content.matchAll(/\Wt\(["']([^"']*)["']\)/gm)) || [];
    if (allTCalls.length === 0) return; // Skip if no t() calls

    const usedNS: Record<string, number> = {};

    allTCalls.forEach(call => {
      const [, key] = call;
      if (keysAllowedDirectlyInApp.some(allowedKey => key.startsWith(allowedKey))) return; // Skip allowed keys

      const namespace = key.match(/(^[^:]+):/)?.[1];
      if (!namespace) return; // Skip if no namespace

      if (!usedNS[namespace]) usedNS[namespace] = 0;
      usedNS[namespace]++;
    });

    // If it's only using one (or zero) namespace, skip it
    if (Object.values(usedNS).length < 2) return; // Skip if no namespaces used

    perFile[filePath] = perFile[filePath] || [];
    const usedNSString = Object.entries(usedNS).map(([ns, count]) => `${ns}: ${count}`).join(", ");
    perFile[filePath].push(`[Mixed namespaces] > { ${usedNSString} }`);
  });

  const totalBadKeys = Object.values(perFile).flat().length;

  expect(totalBadKeys, `Mixed namespaces: ${JSON.stringify(perFile, null, 2)}`).toBe(0);
});

// /** Checks whether a file is consistent with namespaces and first level keys */
// function TestInFileCommonKeyUse() {
//   const perFile: { [key: string]: Record<string, number> } = {};

//   const files = glob.sync(appFiles, { ignore: ["src/scripts/**/*"] })
//     .filter(file => !file.includes("common")); // Ignore common namespace

//   files.forEach(filePath => {
//     const content = fs.readFileSync(filePath, "utf-8");

//     const tCalls = getAllInFileTCalls(content);

//     tCalls.forEach(call => {
//       const [, key] = call;
//       // Skip the common keys that are explicitly allowed
//       if (commonKeysAllowedDirectlyInFile.some(commonKey => key.startsWith(commonKey))) return;


//       if (!key.startsWith("common:")) return;

//       perFile[filePath] = perFile[filePath] || {};
//       perFile[filePath][key] = perFile[filePath][key] || 0;
//       perFile[filePath][key]++;
//     });
//   });

//   const totalBadKeys = Object.values(perFile).flat().length;

//   assertWarn(totalBadKeys === 0,
//     `Common keys are being used directly in files and not referenced: ${JSON.stringify(perFile, null, 2)}`,
//     "Common keys are used in an expected manor in the app"
//   );
// }

// /** Checks if the <Trans /> tags have a defined i18nKey */
// function TestInFileTransKeysDefined() {
//   const perFile: { [key: string]: string[] } = {};

//   /** Trans tags need a prop called i18nKey which this regex finds */
//   const i18nKeyRegex = /(?<=<Trans(?:\r?\n.*)*)i18nKey=["'](.*?)["'](?=(?:\r?\n.*)*\/>)/gmu;

//   const validKeys = expectedNS.flatMap((namespace) => getFlattenedKeys(Locales.default, namespace));

//   const files = glob.sync(appFiles, { ignore: ["src/scripts/**/*"] });

//   files.forEach(filePath => {
//     const content = fs.readFileSync(filePath, "utf-8");

//     const i18nKeys = content.matchAll(i18nKeyRegex) || [];

//     Array.from(i18nKeys).forEach(call => {
//       const [, key] = call;

//       // Key is empty?
//       if (!key) {
//         if (!perFile[filePath]) perFile[filePath] = [];
//         perFile[filePath].push(`[Empty i18nKey] > '${key}'`);
//         return;
//       }

//       // Key exists?
//       if (!validKeys.includes(key)) {
//         if (!perFile[filePath]) perFile[filePath] = [];
//         perFile[filePath].push(`[i18nKey not defined] > '${key}'`);
//       };

//       // Namespace is valid?
//       if (expectedNS.every(ns => !key.startsWith(ns))) {
//         if (!perFile[filePath]) perFile[filePath] = [];
//         perFile[filePath].push(`[Invalid namespace] > '${key}'`);
//       }
//       // Non-namespaced key
//       else if (!key.includes(":")) {
//         if (!perFile[filePath]) perFile[filePath] = [];
//         perFile[filePath].push(`[Non-namespaced key] > '${key}'`);
//       }
//     });
//   });

//   const totalBadKeys = Object.values(perFile).flat().length;

//   assert(totalBadKeys === 0,
//     `Issues with keys of <Trans />: ${JSON.stringify(perFile, null, 2)}`,
//     "Key syntax in <Trans /> is valid"
//   );
// }

// /** Checks if the <Trans /> tags have valid syntax */
// function TestInFileTransSyntax() {
//   const perFile: { [key: string]: string[] } = {};

//   // @ts-expect-error - This test runs on tsx so it's not dependant on tsconfig
//   const transTagRegex = /<Trans.*?\/>(?!\s*\}\})(?!,)/gmus;

//   const files = glob.sync(appFiles, { ignore: ["src/scripts/**/*"] });

//   const values: { [key in typeof uniqueLocales as string]: Record<string, string> } = {};
//   uniqueLocales.forEach(locale => {
//     values[locale] = {};
//     expectedNS.forEach(namespace => {
//       const flattened = getFlattenedLocaleFile(locale, namespace);
//       Object.assign(values[locale], flattened);
//     });
//   });

//   files.forEach(filePath => {
//     const content = fs.readFileSync(filePath, "utf-8");

//     const transTags = content.matchAll(transTagRegex) || [];

//     Array.from(transTags).forEach(call => {
//       const [matchTrans] = call;
//       const collapsedWhitespace = matchTrans.replace(/\s+/g, " ");

//       const i18nKeyStringMatch = collapsedWhitespace.match(/\si18nKey=["'](.*?)["']/);
//       const i18nKeyVarMatch = collapsedWhitespace.match(/\si18nKey=\{(.*?)\}/);

//       if (i18nKeyVarMatch) {
//         return; // Skip if it's a variable
//       }

//       // Missing key
//       if (!i18nKeyStringMatch) {
//         if (!perFile[filePath]) perFile[filePath] = [];
//         perFile[filePath].push(`[Missing i18nKey] > '${matchTrans}'`);
//         return;
//       }

//       const componentsMatch = collapsedWhitespace.match(/components=\{\{(.*?)\}\}/);

//       // Value of key
//       const i18nKey = i18nKeyStringMatch[1];
//       uniqueLocales.forEach(locale => {
//         const value = values[locale][i18nKey];
//         if (!value) {
//           if (!perFile[filePath]) perFile[filePath] = [];
//           perFile[filePath].push(`[Undefined i18nKey] > '${collapsedWhitespace}'`);
//         }

//         // Is it using components?
//         const componentsInValue = /<.*?>/.test(value);
//         const componentsInTag = componentsMatch && componentsMatch[1] !== "null" && componentsMatch[1] !== "undefined";
//         if (componentsInTag && !componentsInValue) {
//           if (!perFile[filePath]) perFile[filePath] = [];
//           perFile[filePath].push(`[Missing components in value] > '${collapsedWhitespace}'`);
//         }
//         if (!componentsInTag && componentsInValue) {
//           if (!perFile[filePath]) perFile[filePath] = [];
//           perFile[filePath].push(`[Missing components in tag] > '${collapsedWhitespace}'`);
//         }
//       });
//     });
//   });

//   const totalBadKeys = Object.values(perFile).flat().length;

//   assert(totalBadKeys === 0,
//     `Syntax issues in <Trans />: ${JSON.stringify(perFile, null, 2)}`,
//     "Valid syntax in <Trans />"
//   );
// }

/** The Swedish Regex */
// const swedishRegex = /(?<!\/\/|\*|\/\*)(?:åtgärd|åtgärden|åtgärder|åtgärderna|målbana|målbanan|målbanor|målbanorna|färdplan|färdplanen|färdplaner|färdplansversion|färdplansversionen|färdplansversioner|effekt|effekten|effekter|effekterna|Skapa|Redigera|Radera|Ta bort|Lägg till|Spara|Avbryt|Sök|Välj|Visa|Sortera|Sök bland|Välj en|Ingen angiven|Skapa ny|Det finns inga|Vill du|Utvalda|Alla|Externa resurser|Relevanta aktörer|Kostnadseffektivitet|Beskrivning|Sverige|Sveriges|[åäöÅÄÖ])[\W]/gm;

/* 
 ***********
 * Helpers *
 ***********
 */

/** Structure is is `{ Locales: { "namespace:key.keyN": value } }` */
function getAllJSONFlattened(): Record<string, Record<string, string>> {
  const perLocale: Record<string, Record<string, string>> = Object.fromEntries(uniqueLocales.map(locale => [locale, {}]));
  allPermutations.map(([locale, namespace]) => {
    const nsData = JSON.parse(fs.readFileSync(path.join(localesDir, locale, `${namespace}.json`), "utf-8"));
    const flattened = flattenTree(nsData);
    const prefixed = Object.fromEntries(Object.entries(flattened)
      .map(([key, value]) => [`${namespace}:${key}`, value])
    );
    perLocale[locale] = { ...perLocale[locale], ...prefixed };
  })
  return perLocale;
}

/** Get every file where t might be implemented as an array of objects storing the file path and their content as text */
function getAllTSXFiles() {
  const allTSXPaths = glob.sync("src/**/*.{tsx,ts}", { ignore: ["src/scripts/**/*"] });
  const allTSX = allTSXPaths.map(filePath => {
    const content = fs.readFileSync(filePath, "utf-8");
    return { filePath, content };
  });
  return allTSX;
}

/** Returns a flattened object with the structure `{ "key1.key2.keyN": value }` */
function flattenTree(obj: object) {
  const result: Record<string, string> = {};

  const recurse = (obj: object, prefix = "") => {
    for (const [key, value] of Object.entries(obj)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object") {
        recurse(value, newPrefix);
      }
      else {
        result[newPrefix] = value;
      }
    }
  };

  recurse(obj);

  return result;
}