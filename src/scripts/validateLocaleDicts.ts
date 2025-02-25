import fs from "node:fs";
import path from "node:path";
import { Locale } from "@/types.ts";
const strictLocale = Object.keys(Locale).filter(key => key !== "default");
/** Matches paths ending in `.dict.json` */
const dictFileRegex = /\.dict\.json$/;
console.log(dictFileRegex);

// Help command
if (process.argv.includes("--help")) {
  console.info("Validates the structure of locale dictionaries i.e. `.dict.json` files.");
  console.info("Flags: -f, -d, -v, --verbose, --help");
  console.info(" -f <file>:      Validate single file.");
  console.info(" -d <directory>: Validate all files in the directory recursively.");
  console.info(" -v --verbose:   Verbose");
  console.info(" --help:         Display this help message.");

  process.exit(0);
}

// Other commands
const fileFlag = process.argv.includes("-f") ? process.argv[process.argv.indexOf("-f") + 1] : null;
const dirFlag = process.argv.includes("-d") ? process.argv[process.argv.indexOf("-d") + 1] : null;
const verbose = process.argv.includes("-v") || process.argv.includes("--verbose");

if (!fileFlag && !dirFlag) {
  console.error("No file or directory specified.");
  process.exit(1);
}
if (fileFlag && dirFlag) {
  console.error("Cannot specify both file and directory.");
  process.exit(1);
}

if (fileFlag) {
  console.info(`\nValidating file \x1b[90m${fileFlag}\x1b[0m`);

  const problems = validateFile(fileFlag);

  if (problems.length === 0) {
    console.info(`✔️  No problems found \x1b[90m${fileFlag}\x1b[0m`);
  } else {
    console.error(`❗ Problems found in \x1b[90m${fileFlag}\x1b[0m`);
    problems.forEach(problem => console.error(" ❌", problem));
  }
  console.info(""); // Padding
}

if (dirFlag) {
  console.info(`\nValidating directory and its children \x1b[90m${dirFlag}\x1b[0m\n`);

  const fileProblems: { [file: string]: string[] } = validateDirectory(dirFlag);

  Object.entries(fileProblems).forEach(([file, problems]) => {
    if (problems.length === 0) {
      if (verbose) console.info(`✔️  No problems found in \x1b[90m${file}\x1b[0m`);
    } else {
      console.error(`❗ Problems found in \x1b[90m${file}\x1b[0m`);
      problems.forEach(problem => console.error(" ❌", `\x1b[31m${problem}\x1b[0m\n`));
      console.info(""); // Padding
    }
  });
  console.info(""); // Padding
};




function validateFile(filePath: string | null): string[] {
  if (!filePath) {
    console.error("No file specified.");
    process.exit(1);
  }

  // Resolve path
  if (!path.isAbsolute(filePath)) {
    filePath = path.resolve(filePath);
    if (!filePath) {
      console.error("Could not resolve path.");
      process.exit(1);
    }
  }

  if (!fs.existsSync(filePath)) {
    console.error("File does not exist.");
    process.exit(1);
  }

  const problems = [];

  const fileContent = fs.readFileSync(filePath, "utf8");

  try { JSON.parse(fileContent); } catch (e) {
    problems.push(`File is not a valid JSON, see error:\n\n ${e}`);
    return problems;
  }

  const data = JSON.parse(fileContent);

  problems.push(...validateDictObject(data));

  return problems;
}

function validateDirectory(dirPath: string | null): { [file: string]: string[] } {
  if (!dirPath) {
    console.error("No directory specified.");
    process.exit(1);
  }

  // Resolve path
  if (!path.isAbsolute(dirPath)) {
    dirPath = path.resolve(dirPath);
    if (!dirPath) {
      console.error("Could not resolve path.");
      process.exit(1);
    }
  }

  if (!fs.existsSync(dirPath)) {
    console.error("Directory does not exist.");
    process.exit(1);
  }

  const fileProblems: { [file: string]: string[] } = {};

  // Get all dict files in dir and sub dirs with absolute paths
  const dictFiles: { name: string, path: string }[] = [];
  const walk = (dir: string) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        walk(filePath);
      } else if (dictFileRegex.test(file)) {
        dictFiles.push({ name: file, path: filePath });
      }
    });
  }
  walk(dirPath);

  if (dictFiles.length === 0) {
    console.error("No `.dict.json` files found.");
    process.exit(1);
  }

  dictFiles.forEach(file => {
    const absoluteFilePath = file.path;
    const relativeFilePath = path.relative(process.cwd(), absoluteFilePath);

    const fileContent = fs.readFileSync(absoluteFilePath, "utf8");

    try { JSON.parse(fileContent); } catch (e) {
      fileProblems[relativeFilePath] = [`File is not a valid JSON, see error:\n\n ${e}`];
      return fileProblems;
    }

    const data = JSON.parse(fileContent);

    fileProblems[relativeFilePath] = validateDictObject(data);
  });

  return fileProblems;
}

/** 
 * Validate structure of a locale dictionary `.dict.json` recursively.
 * @param dict JSON object.
*/
export function validateDictObject(dict: object | string): string[] {
  const problems: string[] = [];

  if (typeof dict === "string") {
    if (dict === "") problems.push("Empty string found.");
    return problems;
  };
  // Else, it's an object

  const keys = Object.keys(dict);
  const values = Object.values(dict);

  if (keys.length === 0) {
    problems.push("Locale dict has no entries.");
    return problems;
  }

  // Branch check
  if (values.every(value => typeof value === "object")) {
    // Recursively check the children
    values.forEach(value => problems.push(...validateDictObject(value)));
    return problems;
  }

  // Mixed types, check
  // Only allowed types are objects and strings and strings may only have string siblings and objects may only have object siblings (not arrays or classes either)
  // const allStrings = values.every(value => typeof value === "string");
  const someStrings = values.some(value => typeof value === "string");
  const someObjects = values.some(value => typeof value === "object");
  const someArrays = values.some(value => Array.isArray(value));
  if (someStrings && (someObjects || someArrays)) {
    const found = `{ ${Object.entries(dict).map(([key, value]) => `"${key}":${typeof value === "string" ? `"${value}"` : value}`).join(", ")} }`;
    problems.push(`Mixed types. Branch nodes may only contain other objects. Leaf nodes may only contain strings.\n Found:\n  ${found}`);
    return problems;
  }

  // Leaf checks
  // Value type, check
  if (values.some(value => typeof value !== "string")) {
    problems.push(`Leaf nodes can only contain strings. e.g. \`{ Locale: string }\`.\n Found:\n  ${Object.entries(dict).map(([key, value]) => `${key}: ${typeof value}`).join(", ")}`);
  }
  // Number of locales, check
  if (keys.length !== strictLocale.length) {
    problems.push(`Leaf node has the wrong amount of locales.\n Expected:\n  ${strictLocale.length}\n Found:\n  ${keys.length}`);
  }
  // Key locale, check
  if (keys.some(key => !strictLocale.includes(key))) {
    const expected = `[${strictLocale.join(", ")}]`;
    const found = `[${keys.join(", ")}]`;
    problems.push(`Leaf node has an invalid locale.\n Expected:\n  ${expected}\n Found:\n  ${found}`);
  }

  return problems;
} 