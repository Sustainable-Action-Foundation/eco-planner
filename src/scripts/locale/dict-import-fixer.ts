import { colors } from "../lib/colors.ts";
import "../lib/console.ts";
import fs from "node:fs";
import { glob } from "glob";

/*
 * This script converts imports of the old `.dict.json` files to the new `.dict.ts` files.
 * It also fixes the declaration of the `dict` object to use the new `createDict` function.
 * As well as swapping the order of the `dict` and `locale` declarations. And also removes the `[locale]` access.
 */

const pageFileEnding = ".tsx";
const dictFileEnding = {
  old: ".dict.json",
  new: ".dict.ts",
};

/** 
 * Finds the import statement that asserts type json to find the dict files
 * 
 * Group 0: the entire import statement
 * 
 * Group 1: the path to the dict file including the file ending
 */
const importRegex = /import\s[^\s]*[^"']*["']([^"']*\.dict\.json)["'].*[with|assert].*$/gm;
/** 
 * Finds the declaration of the `dict` object
 * 
 * Group 0: the entire declaration
 * 
 * Group 1: the eventual property accesses e.g. `dict["key"]` or `dict.key` minus the `dict` part
 */
const declarationRegex = /(?:const|let)\sdict\s=\s[^.[;]*(.*);$/gm;
/** 
 * Finds the declaration of the `locale` object after the `dict` object to swap their order.
 * 
 * Group 0: the entire declaration
 * 
 * Group 1: the dict declaration
 * 
 * Group 2: the locale declaration
 */
const declarationOrderRegex = /(.*const\sdict.*)(?=\r?\n.*const\slocale)(?:\r?\n(.*))/gm;
/** 
 * Finds the `[locale]` that was used to access the dict object.
 */
const localeAccessRegex = /\[locale\]/gm;


/* Gather files */
const filePaths = glob.sync([`src/**/*${pageFileEnding}`, `!src/scripts/locale/**/*` /* Don't modify this file or other locale related scripts */]);
if (!filePaths.length) {
  console.warn("❗️ No files found to convert. This is likely not desired.");
  process.exit(1);
}

let problems = false;
let matchCount = 0;

for (const filePath of filePaths) {
  try {
    let content = fs.readFileSync(filePath, "utf-8");

    /* Import replacer */
    const importMatches = content.matchAll(importRegex);
    importMatches.forEach(match => {
      matchCount++;

      const [fullMatch, dictPath] = match;

      const newFullMatch = `import { createDict } from "${dictPath.replace(dictFileEnding.old, dictFileEnding.new)}";`;

      content = content.replace(fullMatch, newFullMatch);
    });

    /* Declaration replacer */
    const declarationMatches = content.matchAll(declarationRegex);
    declarationMatches.forEach(match => {
      matchCount++;

      const [fullMatch, propertyAccesses] = match;

      const newFullMatch = `const dict = createDict(locale)${propertyAccesses};`;

      content = content.replace(fullMatch, newFullMatch);
    });

    /* Declaration order fix */
    const declarationOrderMatches = content.matchAll(declarationOrderRegex);
    declarationOrderMatches.forEach(match => {
      matchCount++;

      const [fullMatch, dictDeclaration, localeDeclaration] = match;

      const newFullMatch = `${localeDeclaration}\n${dictDeclaration}`;
      content = content.replace(fullMatch, newFullMatch);
    });

    /* Locale access fix */
    content = content.replaceAll(localeAccessRegex, "");

    fs.writeFileSync(filePath, content);
  }
  catch (error) {
    console.error(`❌ Failed to convert file:`, `(${colors.gray(filePath)})\n`, `  ${error}\n`);
    problems = true;
  }
}

if (matchCount === 0) {
  console.warn(""); // Padding
  console.warn("❗️ No import statements found to convert. This is likely not desired.");
  console.warn(""); // Padding
  process.exit(1);
}

if (problems) {
  console.warn(""); // Padding
  console.warn("❗️ There were problems converting the files. See the errors above.");
  console.warn(""); // Padding
  process.exit(1);
}
else {
  console.info(""); // Padding
  console.info("✔️  All locale importing files converted successfully!");
  console.info(""); // Padding
}