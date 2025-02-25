
import { Locale } from "@/types.ts";
import fs from "node:fs";
import path from "node:path";
const strictLocale = Object.keys(Locale).filter(key => key !== "default");
const problems: string[] = [];

// Help command
if (process.argv.includes("--help")) {
  console.info("Validates the structure of locale dictionaries i.e. .dict.json files.");
  console.info("Flags: -f, -d, --help");
  console.info(" -f <file>: Validate single file.");
  console.info(" -d <directory>: Validate all files in the directory recursively.");
  console.info(" --help: Display this help message.");

  process.exit(0);
}

// Other commands
const fileIndex = process.argv.indexOf("-f");
const dirIndex = process.argv.indexOf("-d");

// Argument checks
if (fileIndex === -1 && dirIndex === -1) {
  console.error("No file or directory specified.");
  process.exit(1);
}
if (fileIndex !== -1 && dirIndex !== -1) {
  console.error("Cannot specify both file and directory.");
  process.exit(1);
}

// If file flag is used
if (fileIndex !== -1) {
  const file = process.argv[fileIndex + 1];

  if (!file) {
    console.error("No file specified.");
    process.exit(1);
  }
  // Has to be absolute
  if (!path.isAbsolute(file)) {
    console.error("File path has to be absolute.");
    process.exit(1);
  }

  if (!fs.existsSync(file)) {
    console.error("File does not exist.");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(file, "utf8"));

  console.info(`Validating file:\n ${file}\n`);

  validateDictFile(data);

  if (problems.length === 0) {
    console.info("✔️  No problems found.");
  } else {
    console.error(`Problems found in: ${path.basename(file)}`);
    problems.forEach(problem => console.error(" ❌", problem));
  }
  console.warn(""); // Padding
}

/** 
 * Validate structure of a locale dictionary `.dict.json` recursively.
 * @param dict JSON object.
*/
export function validateDictFile(dict: object | string) {

  if (typeof dict === "string") {
    if (dict === "") problems.push("Empty string found.");
    return;
  };
  // Else, it's an object

  const keys = Object.keys(dict);
  const values = Object.values(dict);

  if (keys.length === 0) {
    problems.push("Locale dict has no entries.");
    return;
  }

  // Branch check
  if (values.every(value => typeof value === "object")) {
    // Recursively check the children
    values.forEach(value => validateDictFile(value));
    return;
  }
  if (values.some(value => typeof value === "object") && values.some(value => typeof value === "string")) {
    problems.push("Mixed types found in the locale dict. Branch nodes may only contain other objects. Leaf nodes may only contain strings.");
    return;
  }

  // Leaf checks
  // Value type, check
  if (values.some(value => typeof value !== "string")) {
    problems.push(`Leaf nodes can only contain strings. e.g. \`{ Locale: string }\`. Found: ${Object.entries(dict).map(([key, value]) => `${key}: ${typeof value}`).join(", ")}`);
  }
  // Number of locales, check
  if (keys.length !== strictLocale.length) {
    problems.push(`Leaf node has the wrong amount of locales. Expected: ${strictLocale.length}, Found: ${keys.length}`);
  }
  // Key locale, check
  if (keys.some(key => !strictLocale.includes(key))) {
    const expected = `[${strictLocale.join(", ")}]`;
    const found = `[${keys.join(", ")}]`;
    problems.push(`Leaf node has an invalid locale. Expected: ${expected}. Found: ${found}`);
  }
} 