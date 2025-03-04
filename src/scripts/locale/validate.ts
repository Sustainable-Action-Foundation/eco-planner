import { colors } from "../lib/colors.ts";
import "../lib/console.ts";
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";
import { Locale } from "src/types.ts";
import { tsDictStripper } from "./ts-dict-stripper.ts";
/** Only the unique values of the Locale Enum */
const strictLocale = [...new Set(Object.values(Locale))];


/* Filters */
/** How it finds the files to validate */
const dictFileEnding = ".dict.ts";
/** Only these keys are allowed in leaf nodes, mainly this is the Locale keys */
const allowedLeafKeys = [...strictLocale, /** "description" */];
/** Matches keys to discriminate pure number keys. */
const disallowedKeysRegex = /^[0-9]+$/;
/** Raise concern on keys with any of these substrings. */
const disallowedKeySubstrings: string[] = [].filter(Boolean);
/** Raise concern on keys with any of these prefixes. */
const disallowedKeyPrefixes: string[] = [].filter(Boolean);
/** Raise concern on keys with any of these suffixes. */
const disallowedKeySuffixes: string[] = [].filter(Boolean);


const showHelp = () => {
  console.info("ℹ️ Help:");
  console.info(`Validates the structure of locale dictionaries. Locale files found by their file ending:`, `${colors.green(dictFileEnding)}\n`);
  console.info("Flags:");
  console.info(`${colors.green(" -f --file <file>:     ")}`, `Validate single file.`);
  console.info(`${colors.green(" -d --dir <directory>: ")}`, `Validate all files in the directory recursively.`);
  console.info(`${colors.green(" -? -h --help:         ")}`, `Display this help message.`);
  console.info(""); // Padding
}


/* Help command */
if (process.argv.includes("--help") || process.argv.includes("-h") || process.argv.includes("-?") || process.argv.length === 2 /* When run, it always receives 2 base args */) {
  showHelp();
  process.exit(0);
}


/* Save flags */
const fileFlag = readFlag("-f") || readFlag("--file");
const dirFlag = readFlag("-d") || readFlag("--dir");


/* Filter flags */
if (!fileFlag && !dirFlag) {
  console.error("❌ No file or directory specified.");
  showHelp();
  process.exit(1);
}
if (fileFlag && dirFlag) {
  console.error("❌ Cannot specify both file and directory.");
  showHelp();
  process.exit(1);
}


/* Handle file operation */
if (fileFlag) {
  console.info(` ℹ️ Validating file`, colors.gray(`(${fileFlag})`));

  const problems = validateFile(fileFlag);

  // Log problems
  if (problems.length === 0) {
    console.info(`✔️  No problems found`, colors.gray(`(${fileFlag})`));

  } else {
    console.error(`❗ Problems found in`, colors.gray(`(${fileFlag})`));
    problems.forEach(problem => console.error(` ❌ ${problem}\n`));
  }

  // Exit appropriately
  if (problems.length > 0) process.exit(1);
  process.exit(0);
}


/* Handle directory operation */
if (dirFlag) {
  console.info(` ℹ️ Validating directory and its children`, colors.gray(`(./${dirFlag}/**/*${dictFileEnding})`));

  const perFileProblems = validateDirectory(dirFlag);

  // Log problems
  Object.entries(perFileProblems).forEach(([file, problems]: [string, string[]]) => {
    if (problems.length) {
      console.error(`❗ Problems found in`, colors.gray(`(${file})`));
      problems.forEach(problem => console.error(` ❌ ${problem}\n`));
    }
  });

  // Exit appropriately
  const problematicFileCount = Object.values(perFileProblems).filter(fileProblems => fileProblems.length !== 0).length;
  if (problematicFileCount) {
    process.exit(1)
  }
  else {
    console.info("✔️  No problems found in any file of", colors.gray(`(./${dirFlag}/**/*${dictFileEnding})`));
    process.exit(0);
  }
};


/** Returns all problems found in a single file */
function validateFile(filePath: string | null): string[] {
  // Falsy file path
  if (!filePath) {
    console.error("❗ No file specified.");
    process.exit(1);
  }

  // Resolve path
  if (!path.isAbsolute(filePath)) {
    filePath = path.resolve(filePath);
    if (!filePath) {
      console.error("❗ Could not resolve path.");
      process.exit(1);
    }
  }

  // File exists
  if (!fs.existsSync(filePath)) {
    console.error("❗ File does not exist.");
    process.exit(1);
  }

  const problems: string[] = [];

  const fileContent = fs.readFileSync(filePath, "utf-8");

  problems.push(...validateDictObject(tsDictStripper(fileContent)));

  return problems;
}

/** Returns all problems found in a directory and its children as an object to differentiate files */
function validateDirectory(dirPath: string | null): { [file: string]: string[] } {
  // Falsy dir path
  if (!dirPath) {
    console.error("❗ No directory specified.");
    process.exit(1);
  }

  // Resolve path
  if (!path.isAbsolute(dirPath)) {
    dirPath = path.resolve(dirPath);
    if (!dirPath) {
      console.error("❗ Could not resolve path.", colors.gray(`(${dirPath})`));
      process.exit(1);
    }
  }

  // Directory exists
  if (!fs.existsSync(dirPath)) {
    console.error("❗ Directory does not exist.", colors.gray(`(${dirPath})`));
    process.exit(1);
  }

  // Per file problem tracker
  const perFileProblems: { [file: string]: string[] } = {};

  // Get all files
  const dictFiles = glob.sync(`${dirPath}/**/*${dictFileEnding}`);

  // No dict files found
  if (dictFiles.length === 0) {
    console.error(`❗ No`, colors.green(`"${dictFileEnding}"`), `files found`);
    process.exit(1);
  }
  // Validate per file
  dictFiles.forEach((filePath) => {

    const fileContent = fs.readFileSync(filePath, "utf-8");

    perFileProblems[filePath] = validateDictObject(tsDictStripper(fileContent));
  });

  return perFileProblems;
}

/** Takes a JSON formatted object and return every found problem. */
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

  // Empty object, check
  if (keys.length === 0) {
    const found = dictToStringShallow(dict);
    problems.push(`Found no entries in object. ${found}`);
    return problems;
  }

  // Disallowed keys regex, check
  if (keys.some(key => disallowedKeysRegex.test(key))) {
    const found = dictToStringShallow(dict, true);
    problems.push(`Disallowed keys found. Keys may not be numbers. They have to match ${disallowedKeysRegex}. ${found}`);
  }
  // Disallowed substrings, check
  if (keys.some(key => disallowedKeySubstrings.some(substring => key.includes(substring)))) {
    const found = dictToStringShallow(dict, true);
    problems.push(`Disallowed substring, prefix or suffix found. Keys may not contain ${disallowedKeySubstrings}. ${found}`);
  }
  // Disallowed suffixes, check
  if (keys.some(key => disallowedKeySuffixes.some(suffix => key.endsWith(suffix)))) {
    const found = dictToStringShallow(dict, true);
    problems.push(`Disallowed suffix found. Keys may not end with ${disallowedKeySuffixes}. ${found}`);
  }
  // Disallowed prefixes, check
  if (keys.some(key => disallowedKeyPrefixes.some(prefix => key.startsWith(prefix)))) {
    const found = dictToStringShallow(dict, true);
    problems.push(`Disallowed prefix found. Keys may not start with ${disallowedKeyPrefixes}. ${found}`);
  }

  // Mixed types, check
  const someStrings = values.some(value => typeof value === "string");
  const someObjects = values.some(value => typeof value === "object");
  const someArrays = values.some(value => Array.isArray(value));
  if (someStrings && (someObjects || someArrays)) {
    const found = dictToStringShallow(dict, true);
    problems.push(`Mixed types. Branch nodes may only contain other objects. Leaf nodes may only contain strings.\n  Found:\n${found}`);
    return problems;
  }

  // Branch check
  if (values.every(value => typeof value === "object")) {
    // Recursively check the children
    values.forEach(value => problems.push(...validateDictObject(value)));
    return problems;
  }
  // Else, it's a leaf node

  // Leaf checks
  // Value type, check
  if (values.some(value => typeof value !== "string")) {
    const found = dictToStringShallow(dict);
    problems.push(`Leaf nodes can only contain \`allowedLeafKeys\`.\n   Found:\n    ${found}`);
  }
  // Number of locales, check
  if (keys.length !== allowedLeafKeys.length) {
    const expected = `{ ${allowedLeafKeys.map(key => `"${key}": string`).join(", ")} }`;
    const found = `{ ${keys.map(key => `"${key}": string`).join(", ")} }`;
    problems.push(`Leaf node has the wrong amount of locales.\n   Expected:\n    ${expected}\n   Found:\n    ${found}`);
  }
  // Key locale, check
  if (keys.some(key => !allowedLeafKeys.includes(key as Locale))) {
    const expected = `[${allowedLeafKeys.map((key) => `"${key}"`).join(", ")}]`;
    const found = `[${keys.map((key) => `"${key}"`).join(", ")}]`;
    problems.push(`Leaf node has an invalid locale. If it is, add it to the \`allowedLeafKeys\` in the \`validate.ts\` scripts}\n   Expected:\n    ${expected}\n   Found:\n    ${found}`);
  }

  return problems;
}

function readFlag(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1];
}

function dictToStringShallow(obj: object, linebreak: boolean = false): string {

  const keyValues = Object.entries(obj).map(([key, value]) => {
    if (typeof value === "string") return `"${key}": "${value}"`;
    return `"${key}": ${value}`;
  });

  if (linebreak) return `{\n  ${keyValues.join(", \n  ")}\n}`;

  return `{ ${keyValues.join(", ")} }`;
}