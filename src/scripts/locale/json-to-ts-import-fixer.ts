import fs from "node:fs";
import { glob } from "glob";
import { colors } from "../lib/colors";

/*
 * This script converts imports of the old `.dict.json` files to the new `.dict.ts` files.
 * 
 * To fix the order of the dict and locale declarations the find and replace tool in vscode is used.
 *  1. Include only the files that you wan't to replace e.g. the `src` folder.
 * 
 *  2. Enter this regex (with the regex option disabled): `(.*const\sdict.*)(?=\n.*const\slocale)(?:\n(.*$))`
 * 
 *  3. Replace with: `$2\n$1`
 * 
 *  4. Replace all
 * 
 * To fix the trailing  from the old dict files use the following regex:
 *  1. Make sure you include and exclude fields are set appropriately. before proceeding.
 * 
 *  2. Enter: `dict[.[].*(\[locale\])`
 * 
 *  3. Replace with: $1
 * 
 *  4. Replace all
 * 
 *  5. If that didn't do it, try `[locale]` without regex mode but be careful with this one. Exclude dict files.
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

const filePaths = glob.sync(`src/**/*${pageFileEnding}`);
if (!filePaths.length) {
  console.warn(colors.yellow("❗️ No files found to convert. This is likely not desired."));
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

    fs.writeFileSync(filePath, content);
  }
  catch (error) {
    console.error(colors.red(`❌ Failed to convert file: ${colors.gray(filePath)}\n  ${colors.red(error as string)}\n`));
    problems = true;
  }
}

if (matchCount === 0) {
  console.warn(""); // Padding
  console.warn(colors.yellow("❗️ No import statements found to convert. This is likely not desired."));
  console.warn(""); // Padding
  process.exit(1);
}

if (problems) {
  console.warn(""); // Padding
  console.warn(colors.yellow("❗️ There were problems converting the files. See the errors above."));
  console.warn(""); // Padding
  process.exit(1);
}
else {
  console.info(""); // Padding
  console.info("✔️  All locale importing files converted successfully!");
  console.info(""); // Padding
}