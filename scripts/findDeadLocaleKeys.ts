import { colors } from "./lib/colors.ts";
import {
  collectUsedKeys,
  filteredLocales,
  getAllJSONFlattened,
  getAllTSXFiles,
  stripPluralSuffix,
} from "./lib/localeKeyScan.ts";

/**
 * Reports locale keys that are defined in `public/locales` but never referenced by the
 * app (dead keys), plus keys with empty values. These are cleanup candidates, not bugs,
 * so this is a manual report rather than a test; breaking checks live in
 * `tests/unit/locale-files.test.ts`.
 *
 * Run via: `yarn check:locales`
 */

/** Keys starting with any of these are never reported as dead. `_` is for description keys. */
const exemptedDeadKeys: string[] = ["_"];

const allJSON = getAllJSONFlattened();
const allTSX = getAllTSXFiles();

let totalDead = 0;
let totalEmpty = 0;

filteredLocales.forEach(locale => {
  const flattenedLocale = allJSON[locale];
  const usedKeys = collectUsedKeys(allTSX, flattenedLocale);

  const deadKeys = Object.keys(flattenedLocale)
    .filter(key => !exemptedDeadKeys.some(exemptedKey => key.startsWith(exemptedKey)))
    .filter(key => !usedKeys.has(stripPluralSuffix(key)));

  const emptyKeys = Object.entries(flattenedLocale)
    .filter(([, value]) => value.trim() === "")
    .map(([key]) => key);

  totalDead += deadKeys.length;
  totalEmpty += emptyKeys.length;

  console.info(colors.bold(`\n${locale}`));

  if (deadKeys.length === 0) {
    console.info(colors.green("  No dead keys"));
  }
  else {
    console.info(colors.yellow(`  Dead keys (${deadKeys.length}):`));
    // Group by namespace for readability
    const perNS = Object.groupBy(deadKeys, key => key.split(":")[0]);
    Object.entries(perNS).forEach(([ns, keys]) => {
      console.info(colors.dim(`    ${ns}:`));
      keys?.forEach(key => console.info(`      ${key}`));
    });
  }

  if (emptyKeys.length === 0) {
    console.info(colors.green("  No empty values"));
  }
  else {
    console.info(colors.yellow(`  Empty values (${emptyKeys.length}):`));
    emptyKeys.forEach(key => console.info(`    ${key}`));
  }
});

console.info(`\n${colors.bold("Summary:")} ${totalDead} dead key${totalDead === 1 ? "" : "s"}, ${totalEmpty} empty value${totalEmpty === 1 ? "" : "s"} across ${filteredLocales.length} locales`);
console.info(colors.dim("Dead = defined in a locale file but never referenced by a t() call, key prop, or nested $t(). Verify before deleting; keys only ever used via variables are invisible to this scan."));
