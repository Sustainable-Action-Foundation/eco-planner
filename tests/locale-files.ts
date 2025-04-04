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
const localeAliases: Record<Locales, string> = { [Locales.enSE]: "English", [Locales.svSE]: "Svenska", };

/** All namespaces */
const namespaces = ["common", "forms", "components", "graphs", "pages", "email", "test",];

/** Where the locale files are located relative to project root */
const localesDir = "public/locales";

/** Every combo of locale and ns in a 2d array */
const allPermutations: string[][] = uniqueLocales.flatMap(locale => namespaces.map(namespace => [locale, namespace]));

/** Every NS file per locale with their flattened key-values */
const allData = getAllDataFlattened();

/* 
 * Exceptions
 */

/** Almost always prefer having nested $t() calls to common in namespaces over using duplicate values. Exceptions to that need to be here. */
const exemptedCommonKeysRef = ["common:tsx.", "common:placeholder."]; // Things that shouldn't always be referenced
/** When checking if a value may be a duplicate of a common value, values starting with any of these strings will be skipped.  */
const exemptedCommonValuesRef = []; // More fine grained option to the above one (useful for language specific exemptions)
/** To prevent recurring false positives, exempt these keys */
const exemptedKeysUsingCommonValues = ["pages:info.info_body", "components:confirm_delete.confirmation"];


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
  const enKeys = Object.keys(allData[Locales.default]);

  // Track both types of missing keys
  const missingInOthers: Record<string, string[]> = {};
  const missingInEnglish: Record<string, string[]> = {};

  uniqueLocales.forEach((locale) => {
    const keys = Object.keys(allData[locale]);
    const missingOther = enKeys.filter(key => !keys.includes(key));
    const missingEng = keys.filter(key => !enKeys.includes(key));

    if (missingOther.length > 0) missingInOthers[locale] = missingOther;
    if (missingEng.length > 0) missingInEnglish[locale] = missingEng;
  });

  test("Missing keys in non-english locales", () => expect(Object.keys(missingInOthers).length, `Missing keys in other locales: ${JSON.stringify(missingInOthers, null, 2)}`).toBe(0));
  test("Missing keys in english", () => expect(Object.keys(missingInEnglish).length, `Missing keys in english: ${JSON.stringify(missingInEnglish, null, 2)}`).toBe(0));
});

/** Do all the keys follow snake case? */
test("Keys are snake_case", () => {
  const perLocale: Record<string, string[]> = Object.fromEntries(uniqueLocales.map(locale => [locale, []]));

  uniqueLocales.forEach((locale) => {
    const keys = Object.keys(allData[locale]);
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
    const commonTranslations = Object.fromEntries(Object.entries(allData[locale])
      .filter(([key,]) => key.startsWith("common:"))
      .filter(([key,]) => !exemptedCommonKeysRef.some(exemptedKey => key.startsWith(exemptedKey)))
      .filter(([, value]) => !exemptedCommonValuesRef.some(exemptedValue => value.startsWith(exemptedValue)))
      .map(([key, value]) => [key, { key, value, pattern: wordPatterns.map(pattern => new RegExp(pattern(escape(value)), "gm")) }])
    );

    const namespacesToCheck = namespaces.filter(ns => ns !== "common");

    const everyOtherTranslation = Object.fromEntries(Object.entries(allData[locale])
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

// /** Are all the nested keys used in locale files defined? */
// function TestJSONNestedKeysDefined() {
//   const perLocale: { [key: string]: { [key: string]: string[] } }
//     = Object.fromEntries(uniqueLocales.map(locale => [locale, {}]));

//   uniqueLocales.forEach((locale) => {
//     const allKeys = expectedNS.flatMap((namespace) => getFlattenedKeys(locale, namespace));

//     expectedNS.forEach((namespace) => {
//       // Skip checking common namespace
//       if (namespace === "common") return

//       const values = getFlattenedValues(locale, namespace).join("\n");

//       const tCalls = getAllNestedTCalls(values);

//       tCalls.forEach(call => {
//         /**
//          * match = $t([key])
//          * key = [key]
//          */
//         const [match, key] = call;

//         // Skip if key is defined
//         if (allKeys.includes(key)) return;

//         /**
//          * key could look like this:
//          * "key, { "count": count }"
//          */
//         const [keyArg, tOptions] = key.split(/\s?,\s?/gm);

//         // Skip if key is defined
//         if (allKeys.includes(keyArg)) return;

//         // If it has a count arg, skip if base key is defined
//         if (tOptions?.includes("\"count\"")) {
//           // Find count versions of base key
//           const countVersionKeys = keyCountModifiers.map(mod => keyArg + mod);
//           if (countVersionKeys.some(countKey => allKeys.includes(countKey))) return;
//         }

//         if (!perLocale[locale][namespace]) perLocale[locale][namespace] = [];
//         perLocale[locale][namespace].push(`[${key}] > '${match}'`);
//       });
//     });
//   });

//   const totalBadKeys = Object.values(getFlattenedObject(perLocale)).length;

//   assert(totalBadKeys === 0,
//     `Nested keys not defined: ${JSON.stringify(perLocale, null, 2)}\nUse ctrl+shift+f in vscode to find the perpetrators.`,
//     "All nested keys seem to be defined"
//   );
// }

// /** Are all the nested keys used in locale files correctly formatted? */
// function TestJSONKeysSyntax() {
//   const perLocale: { [key: string]: { [key: string]: string[] } }
//     = Object.fromEntries(uniqueLocales.map(locale => [locale, {}]));

//   uniqueLocales.forEach((locale) => {
//     expectedNS.forEach((namespace) => {
//       // Skip checking common namespace
//       if (namespace === "common") return

//       const values = getFlattenedValues(locale, namespace).join("\n");

//       /** Every instance where $t() is called */
//       const emptyTCalls = values.matchAll(/\$t\(\)/gm) || [];
//       emptyTCalls.forEach(call => {
//         const [, key] = call;
//         if (!perLocale[locale][namespace]) perLocale[locale][namespace] = [];
//         perLocale[locale][namespace].push(`[Empty $t() call] > '${key}'`);
//       });

//       /** Every instance where $t(...  No closing ")" */
//       const noClosingTCalls = values.matchAll(/\$t\([^)]*(?!.*\))/gm) || [];
//       noClosingTCalls.forEach(call => {
//         const [match] = call;
//         if (!perLocale[locale][namespace]) perLocale[locale][namespace] = [];
//         perLocale[locale][namespace].push(`[$t() never closed] > '${match}'`);
//       });

//       /** Every instance where t(...) is called. No dollar sign. */
//       const noDollarTCalls = values.matchAll(/[^$]t\([^)]*\)/gm) || [];
//       noDollarTCalls.forEach(call => {
//         const [match] = call;
//         if (!perLocale[locale][namespace]) perLocale[locale][namespace] = [];
//         perLocale[locale][namespace].push(`[Missing $t] > '${match}'`);
//       });

//       /** Every instance where $.(...) is called. Anything but t as the function name. */
//       const noTNameTCalls = values.matchAll(/\$[^t]?\([^)]*\)/gm) || [];
//       noTNameTCalls.forEach(call => {
//         const [match] = call;
//         if (!perLocale[locale][namespace]) perLocale[locale][namespace] = [];
//         perLocale[locale][namespace].push(`[$t() must be t] > '${match}'`);
//       });

//       /** Every instance where $t... is called. No "()" */
//       const noOpeningTCallas = values.matchAll(/\$t[^()]{0,20}(?!\(|\))/gm) || [];
//       noOpeningTCallas.forEach(call => {
//         const [match] = call;
//         if (!perLocale[locale][namespace]) perLocale[locale][namespace] = [];
//         perLocale[locale][namespace].push(`[$t() never opened] > '${match}'`);
//       });

//       /** Every instance where $t(...) is called. The regular valid calls */
//       const validTCalls = values.matchAll(/\$t\(([^\)]+)\)/gm) || [];
//       validTCalls.forEach(call => {
//         const [, key] = call;

//         // Missing ":" and is a namespace indicating missing ":"
//         if (!key.includes(":") && expectedNS.some(ns => key.startsWith(ns))) {
//           if (!perLocale[locale][namespace]) perLocale[locale][namespace] = [];
//           perLocale[locale][namespace].push(`[Missing ':'] > '${key}'`);
//         }
//         // Invalid namespace
//         else if (expectedNS.every(ns => !key.startsWith(ns))) {
//           if (!perLocale[locale][namespace]) perLocale[locale][namespace] = [];
//           perLocale[locale][namespace].push(`[Invalid namespace] > '${key}'`);
//         }

//         /**
//          * Key may be = "key, { "count": count }"
//          */
//         const keyArg = key.split(",")[0];
//         const tOptions = key.replace(keyArg, "").replace(/\s*,\s*/m, "");
//         if (tOptions) {
//           const args = tOptions
//             .trim()
//             // Remove surrounding curly brackets
//             .replace(/^\{/m, "")
//             .replace(/\}$/m, "")
//             .split(",")
//             .map(arg => arg.trim())

//           // Are any of the names missing surrounding quotes?
//           const missingQuotes = args
//             .map(arg => arg.split(":")[0])
//             .filter(arg => !arg.startsWith("\"") || !arg.endsWith("\""));

//           if (missingQuotes.length > 0) {
//             if (!perLocale[locale][namespace]) perLocale[locale][namespace] = [];
//             perLocale[locale][namespace].push(`[Missing quotes in tOptions] > '${key}'`);
//           }
//         }
//       });
//     });
//   });

//   const totalBadKeys = Object.values(getFlattenedObject(perLocale)).length;

//   assert(totalBadKeys === 0,
//     `Nested keys with syntax issues: ${JSON.stringify(perLocale, null, 2)}\nUse ctrl+shift+f in vscode to find the perpetrators.`,
//     "Nested key syntax looks good"
//   );
// }

// /** Variable syntax in the JSON files i.e. {{var}}, {{var, formatter}} syntax */
// function TestJSONVariableSyntax() {
//   const perLocale: { [key: string]: { [key: string]: string[] } }
//     = Object.fromEntries(uniqueLocales.map(locale => [locale, {}]));

//   uniqueLocales.forEach((locale) => {
//     expectedNS.forEach((namespace) => {
//       const values = getFlattenedValues(locale, namespace);

//       values.forEach(value => {
//         let count = 0;
//         for (let i = 0; i < value.length; i++) {
//           const char = value[i];

//           if (char === "{") count++;
//           if (char === "}") count--;

//           if (count < 0) {
//             if (!perLocale[locale][namespace]) perLocale[locale][namespace] = [];
//             perLocale[locale][namespace].push(`[Missing '{'] > '${value}'`);
//             break;
//           }
//         }
//       });
//     });
//   });

//   const totalBad = Object.values(getFlattenedObject(perLocale)).length;

//   assert(totalBad === 0,
//     `Variable syntax issues: ${JSON.stringify(perLocale, null, 2)}\nUse ctrl+shift+f in vscode to find the perpetrators.`,
//     "Variable syntax looks good"
//   );
// }

// /** Shows any keys in root of their ns file which only has a string as a value instead of an object */
// function TestJSONOrphanInRoot() {
//   const perFile: { [key: string]: string[] } = {};

//   const exemptedNS = ["common", "test"];

//   const files = glob.sync(`${localesDir}/*/*.json`);
//   files.forEach(filePath => {
//     if (exemptedNS.some(ns => filePath.endsWith(ns) + ".json")) return; // Skip exempted namespaces

//     const content = fs.readFileSync(filePath, "utf-8");

//     try { JSON.parse(content); }
//     catch (e) {
//       assert(false,
//         `Failed to parse ${filePath} with error ${e}`,
//         ""
//       );
//     }

//     const data = JSON.parse(content);
//     const keys = Object.keys(data);

//     keys.forEach(key => {
//       const value = data[key];
//       if (typeof value === "string") {
//         if (!perFile[filePath]) perFile[filePath] = [];
//         perFile[filePath].push(`[Orphan key] > '${key}'`);
//       }
//     });
//   });

//   const totalBad = Object.values(perFile).flat().length;

//   assertWarn(totalBad === 0,
//     `Avoid orphan keys in root of namespace files. Use nested objects instead: ${JSON.stringify(perFile, null, 2)}`,
//     "No orphan keys found in root of namespace files"
//   );
// }

// /** Checks if a file that is likely server or client side is using the wrong import method of t() */
// function TestInFileImportSides() {
//   const perFile: { [key: string]: string[] } = {};

//   const files = glob.sync(appFiles, { ignore: ["src/scripts/**/*"] });

//   const serverT = [
//     "@/lib/i18nServer",
//   ];
//   const clientT = [
//     "react-i18next",
//     "useTranslation",
//     "<Trans",
//   ];
//   const severIndications = [
//     "use server",
//     // "next/server",
//     // "next/headers",
//     // "accessChecker",
//   ];
//   const clientIndications = [
//     "use client",
//     // "useEffect",
//     // "useMemo",
//     // "useState",
//     // "useRef",
//   ];
//   const assumedServerSideFiles: string[] = [
//     "page.tsx",
//     "layout.tsx",
//   ];
//   const assumedClientSideFiles: string[] = [
//   ];

//   files.forEach(filePath => {
//     const content = fs.readFileSync(filePath, "utf-8");
//     const lines = content.split(/\r?\n$/gm);

//     let isClient = false;
//     let isServer = false;
//     let usingClientT = false;
//     let usingServerT = false;

//     lines.forEach(line => {
//       if (serverT.some(t => line.includes(t))) {
//         usingServerT = true;
//       }
//       if (clientT.some(t => line.includes(t))) {
//         usingClientT = true;
//       }

//       if (severIndications.some(t => line.includes(t))) {
//         isServer = true;
//       }
//       if (clientIndications.some(t => line.includes(t))) {
//         isClient = true;
//       }
//     });

//     // Ignore files not using translation functions
//     const isTranslated = usingClientT || usingServerT;
//     if (!isTranslated) return;

//     // Add assumed
//     if (assumedServerSideFiles.some(file => filePath.endsWith(file)) && !isClient) {
//       isServer = true;
//     }
//     if (assumedClientSideFiles.some(file => filePath.endsWith(file)) && !isServer) {
//       isClient = true;
//     }

//     // Both server and client code
//     if (isClient && isServer) {
//       if (!perFile[filePath]) perFile[filePath] = [];
//       perFile[filePath].push("Found both server and client side code");
//     }

//     // Both server and client translations
//     if (usingClientT && usingServerT) {
//       if (!perFile[filePath]) perFile[filePath] = [];
//       perFile[filePath].push("Found both server and client side i18n imports");
//     }

//     // Server side file using client side translations
//     if (isClient && !usingClientT) {
//       if (!perFile[filePath]) perFile[filePath] = [];
//       perFile[filePath].push("Client side file using server side translations");
//     }

//     // Server side file using client side translations
//     if ((isServer || !isClient) && !usingServerT) {
//       if (!perFile[filePath]) perFile[filePath] = [];
//       perFile[filePath].push("Server side file using client side translations");
//     }

//     // Ambiguous file
//     if (!isServer && !isClient) {
//       if (!perFile[filePath]) perFile[filePath] = [];
//       perFile[filePath].push("Ambiguous file");
//     }
//   });

//   const totalBad = Object.values(perFile).flat().length;

//   assert(totalBad === 0,
//     `Translation functions are being used incorrectly. Non marked files are assumed to be server side: ${JSON.stringify(perFile, null, 2)}`,
//     "Translation functions are being used correctly"
//   );
// }

// /** Checks if all t() calls in the tsx have a defined namespace  */
// function TestInFileNamespaceUse() {
//   const perFile: { [key: string]: string[] } = {};

//   const files = glob.sync(appFiles, { ignore: ["src/scripts/**/*"] });

//   files.forEach(filePath => {
//     const content = fs.readFileSync(filePath, "utf-8");

//     const tCalls = getAllInFileTCalls(content);

//     tCalls.forEach(call => {
//       const [, key] = call;

//       // Non-namespaced key
//       if (!key.includes(":")) {
//         if (!perFile[filePath]) perFile[filePath] = [];
//         perFile[filePath].push(`[Non-namespaced key] > '${key}'`);
//       }
//       // Invalid namespace
//       else if (expectedNS.every(ns => !key.startsWith(ns))) {
//         if (!perFile[filePath]) perFile[filePath] = [];
//         perFile[filePath].push(`[Invalid namespace] > '${key}'`);
//       }
//     });
//   });

//   const totalBad = Object.values(perFile).flat().length;

//   assert(totalBad === 0,
//     `Non-namespaced keys found in t() calls: ${JSON.stringify(perFile, null, 2)}`,
//     "All t() calls are namespaced"
//   );
// }

// /** Checks if all t() calls in the tsx are using defined keys */
// function TestInFileKeysDefined() {
//   const perFile: { [key: string]: string[] } = {};

//   const files = glob.sync(appFiles, { ignore: ["src/scripts/**/*"] });

//   files.forEach(filePath => {
//     const content = fs.readFileSync(filePath, "utf-8");

//     const tCalls = getAllInFileTCalls(content);

//     tCalls.forEach(call => {
//       const [, key] = call;

//       const validKeys = expectedNS.flatMap((namespace) => getFlattenedKeys(Locales.default, namespace));

//       if (!validKeys.includes(key)) {
//         if (!perFile[filePath]) perFile[filePath] = [];
//         perFile[filePath].push(`[Undefined key] > '${key}'`);
//       }
//     });
//   });

//   const totalBad = Object.values(perFile).flat().length;

//   assert(totalBad === 0,
//     `Undefined keys found in t() calls: ${JSON.stringify(perFile, null, 2)}`,
//     "All t() calls have defined keys"
//   );
// }

// /** Checks whether a file is consistent with namespaces and first level keys */
// function TestInFileNamespaceConsistency() {
//   const perFile: { [key: string]: Record<string, number> } = {};

//   const files = glob.sync(appFiles, { ignore: ["src/scripts/**/*"] })
//     .filter(file => !mixedNamespacesExemptedFiles.some(exemptedFile => file.includes(exemptedFile))); // Ignore exempted files

//   files.forEach(filePath => {
//     const content = fs.readFileSync(filePath, "utf-8");

//     const tCalls = getAllInFileTCalls(content);

//     const nsAndKeys: Record<string, number> = {};

//     tCalls.forEach(call => {
//       const [, key] = call;
//       // Skip the common keys that are explicitly allowed but still catches som stragglers
//       if (mixedNamespacesExemptedKeys.some(exemptedKey => key.startsWith(exemptedKey))) return;

//       // namespace:key1.keyN.keyN => namespace:key1
//       const namespaceAndLowerKey = key.match(/[^:]+:[^.]+/)?.[0];
//       if (!namespaceAndLowerKey) return;

//       // Hardcoded namespace exceptions
//       const namespace = key.match(/[^:]+/)?.[0];
//       if (namespace === "test") return;

//       // Skip the common keys that are explicitly allowed but still catches som stragglers
//       if (mixedNamespacesExemptedKeys.some(exemptedKey => namespaceAndLowerKey.startsWith(exemptedKey))) return;

//       // Increment the count of this namespace + key
//       if (!nsAndKeys[namespaceAndLowerKey]) nsAndKeys[namespaceAndLowerKey] = 0;
//       nsAndKeys[namespaceAndLowerKey]++;
//     });

//     // If there are more than one namespace, add it
//     if (Object.values(nsAndKeys).length > 1) {
//       perFile[filePath] = nsAndKeys;
//     }
//   });

//   const totalBad = Object.values(perFile).flat().length;

//   assertWarn(totalBad === 0,
//     `Inconsistent namespace use in t() calls. Avoid mixing namespaces: ${JSON.stringify(perFile, null, 2)}`,
//     "All t() calls are consistent with namespaces and first level keys"
//   );
// }

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


/* 
 ***********
 * Helpers *
 ***********
 */

/** Structure is is `{ Locales: { "namespace:key.keyN": value } }` */
function getAllDataFlattened(): Record<string, Record<string, string>> {
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