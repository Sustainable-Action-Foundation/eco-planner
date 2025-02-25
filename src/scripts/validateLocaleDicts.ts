import fs from "node:fs";
import path from "node:path";
import { Locale } from "@/types.ts";
/** Matches paths ending in `.dict.json` */
const dictFileRegex = /\.dict\.json$/;
const strictLocale = [...new Set(Object.values(Locale))]; // Strips duplicates i.e. the default locale

/* Help command. Shows when no flags are given */
if (process.argv.includes("--help") || process.argv.length === 2) {
  console.info("Help:");
  console.info(`Validates the structure of locale dictionaries. Locale files are matched by the regex \x1b[32m${dictFileRegex}\x1b[0m.\n`);
  console.info("Flags:");
  console.info(" -f --file <file>:      Validate single file.");
  console.info(" -d --dir <directory>:  Validate all files in the directory recursively.");
  console.info(" -v --verbose:          Will list all files even if they have no problems.");
  console.info(" --help:                Display this help message.");

  process.exit(0);
}

// Other commands
const fileFlag = readFlag("-f", process.argv) || readFlag("--file", process.argv);
const dirFlag = readFlag("-d", process.argv) || readFlag("--dir", process.argv);
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
    problems.forEach(problem => console.error(" ❌", `\x1b[31m${problem}\x1b[0m\n`));
  }
  console.info(""); // Padding

  // Exit appropriately
  if (problems.length > 0) process.exit(1);
  process.exit(0);
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

  // Exit appropriately
  if (Object.values(fileProblems).length > 0) process.exit(1);
  process.exit(0);
};

function validateFile(filePath: string | null): string[] {
  // Falsy file path
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

  // File exists
  if (!fs.existsSync(filePath)) {
    console.error("File does not exist.");
    process.exit(1);
  }

  const problems = [];

  const fileContent = fs.readFileSync(filePath, "utf8");

  // JSON parse test
  try { JSON.parse(fileContent); } catch (e) {
    problems.push(`File is not a valid JSON, see error:\n\n ${e}`);
    return problems;
  }

  const data = JSON.parse(fileContent);

  problems.push(...validateDictObject(data));

  return problems;
}

function validateDirectory(dirPath: string | null): { [file: string]: string[] } {
  // Falsy dir path
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

  // Directory exists
  if (!fs.existsSync(dirPath)) {
    console.error("Directory does not exist.");
    process.exit(1);
  }

  // Per file problem tracker
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

  // No dict files found
  if (dictFiles.length === 0) {
    console.error(`No \x1b[32m${dictFileRegex}\x1b[0m files found.`);
    process.exit(1);
  }

  // Validate
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

export function validateDictObject(dict: object | string): string[] {
  const problems: string[] = [];

  if (typeof dict === "string") {
    if (dict === "") problems.push(`Empty string found. { ${dict} }`);
    if (dict.trim() === "") problems.push(`Whitespace only string found. { ${dict} }`);
    return problems;
  };
  // Else, it's an object

  const keys = Object.keys(dict);
  const values = Object.values(dict);

  if (keys.length === 0) {
    const found = `{ ${Object.entries(dict).map(([key, value]) => `"${key}":${typeof value === "string" ? `"${value}"` : value}`).join(", ")} }`;
    problems.push(`Found no entries in object. ${found}`);
    return problems;
  }

  // Branch check
  if (values.every(value => typeof value === "object")) {
    // Recursively check the children
    values.forEach(value => problems.push(...validateDictObject(value)));
    return problems;
  }

  // Mixed types, check
  const someStrings = values.some(value => typeof value === "string");
  const someObjects = values.some(value => typeof value === "object");
  const someArrays = values.some(value => Array.isArray(value));
  if (someStrings && (someObjects || someArrays)) {
    const found = `{ ${Object.entries(dict).map(([key, value]) => `\n  "${key}":${typeof value === "string" ? `"${value}"` : value}`).join(", ")} \n}`;
    problems.push(`Mixed types. Branch nodes may only contain other objects. Leaf nodes may only contain strings.\n  Found:\n${found}`);
    return problems;
  }

  // Leaf checks
  // Value type, check
  if (values.some(value => typeof value !== "string")) {
    const found = `{ ${Object.entries(dict).map(([key, value]) => `${key}: ${typeof value}`).join(", ")} }`;
    problems.push(`Leaf nodes can only contain \`Locale\` strings.\n   Found:\n    ${found}`);
  }
  // Number of locales, check
  if (keys.length !== strictLocale.length) {
    const expected = `{ ${strictLocale.map(locale => `"${locale}": string`).join(", ")} }`;
    const found = `{ ${Object.entries(dict).map(([key, value]) => `"${key}":${typeof value === "string" ? `"${value}"` : value}`).join(", ")} }`;
    problems.push(`Leaf node has the wrong amount of locales.\n   Expected:\n    ${expected}\n   Found:\n    ${found}`);
  }
  // Key locale, check
  if (keys.some(key => !strictLocale.includes(key as Locale))) {
    const expected = `[${strictLocale.map((key) => `"${key}"`).join(", ")}]`;
    const found = `[${keys.map((key) => `"${key}"`).join(", ")}]`;
    problems.push(`Leaf node has an invalid locale.\n   Expected:\n    ${expected}\n   Found:\n    ${found}`);
  }

  return problems;
}

function readFlag(flag: string, argArray: string[]): string | null {
  const index = argArray.indexOf(flag);
  if (index === -1) return null;
  return argArray[index + 1];
}