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
import { uniqueLocales } from "i18n.config.ts";
import { glob } from "glob";

const localesDir = "public/locales";

// Do all locale languages exist?
const localeDirs = glob.sync(`${localesDir}/*/`);
const localeNames = localeDirs.map((dir) => dir.split(/\/|\\/g).at(-1));
const exactMatch = localeNames.every((name) => uniqueLocales[name as keyof typeof uniqueLocales]);
console.assert(exactMatch, "All locale directories do not match supported locales");

// const files: {
//   [key in keyof typeof uniqueLocales]?: string[]
// } = {};

// glob.sync("public/locales/*/").forEach((dir) => {
//   const locale = dir.split(/\/|\\/g).at(-1) as Locales;
//   files[locale] = glob.sync(`${dir}*.json`);
// });

// console.dir(files);