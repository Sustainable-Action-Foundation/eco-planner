import fs from "node:fs";
import { glob } from "glob";

/** Used for logging */
const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
}

const pageFileEnding = ".tsx";
const dictFileEnding = {
  old: ".dict.json",
  new: ".dict.ts",
}


/** 
 * Finds the import statement that asserts type json to find the dict files
 * Group 0: the full match
 * Group 1: assigned name of import, usually `dict` or `parentDict`
 * Group 2: the path to the dict file including the file ending
 * Group 3: the rest of the import statement, usually `with` or `assert` followed by `{type: "json"}`
 */
const importRegex = /import\s([^\s]*)[^"']*["']([^"']*\.dict\.json)["'](.*[with|assert].*$)/gm;

const filePaths = glob.sync(`src/**/*${pageFileEnding}`);
if (!filePaths.length) {
  console.warn(colors.yellow("❗️ No files found to convert. This is likely not desired."));
  process.exit(1);
}

let problems = false;
let matchCount = 0;

for (const filePath of filePaths) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const matches = content.matchAll(importRegex);

    matches.forEach(match => {
      matchCount++;

      const [fullMatch, assignedName, dictPath, _end] = match;

      const newFullMatch = `import { ${assignedName} } from "${dictPath.replace(dictFileEnding.old, dictFileEnding.new)}";`;

      fs.writeFileSync(filePath, content.replace(fullMatch, newFullMatch));
    });
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
