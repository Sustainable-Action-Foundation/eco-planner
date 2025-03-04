import { colors } from "../lib/colors.ts";
const __console = { ...console };
const consoleColors = { log: colors.gray, info: colors.blue, error: (text: string) => colors.red(colors.bold(text)), warn: colors.yellow, debug: (text: string) => colors.cyanBright(colors.italic(text)) }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Object.keys(consoleColors).forEach(key => (console as any)[key] = (...args: any[]) => (__console as any)[key](...args.map((consoleColors as any)[key])));

import fs from "node:fs";
import path from "node:path";
import { fileNamePrefix, folderNamePrefix, fileNameSuffix, folderNameSuffix } from "./dictUtils.ts";
import { Locale } from "src/types.ts";
/** Only the unique values of the Locale Enum so remove dupes */
const strictLocale = [...new Set(Object.values(Locale))];

/** Matches paths ending in `.dict.ts` */
const dictFileRegex = /\.dict\.ts$/;

/* Filters */
/** Matches keys to discriminate pure number keys. */
const disallowedKeysRegex = /^[0-9]+$/;
/** Raise concern on keys with any of these substrings. */
const disallowedKeySubstrings: string[] = [];
/** Raise concern on keys with any of these prefixes. */
const disallowedKeyPrefixes: string[] = [fileNamePrefix, folderNamePrefix].filter(Boolean);
/** Raise concern on keys with any of these suffixes. */
const disallowedKeySuffixes: string[] = [fileNameSuffix, folderNameSuffix].filter(Boolean);


const showHelp = () => {
  console.info(" ℹ️ Help:");
  console.info(`Validates the structure of locale dictionaries. Locale files are matched by the regex ${colors.green(dictFileRegex.toString())}.\n`);
  console.info("Flags:");
  console.info(` -f --file <file>:      Validate single file.`);
  console.info(` -d --dir <directory>:  Validate all files in the directory recursively.`);
  console.info(` -v --verbose:          Will list all files even if they have no problems.`);
  console.info(` -? -h --help:          Display this help message.`);
  console.info(""); // Padding
}

/* Help command */
if (process.argv.includes("--help") || process.argv.includes("-h") || process.argv.includes("-?") || process.argv.length === 2 /* When run with tsx this script always receives 2 args */) {
  showHelp();
  process.exit(0);
}

/* Save flags */
const fileFlag = readFlag("-f", process.argv) || readFlag("--file", process.argv);
const dirFlag = readFlag("-d", process.argv) || readFlag("--dir", process.argv);
const verbose = process.argv.includes("-v") || process.argv.includes("--verbose");

/* Filter flags */
if (!fileFlag && !dirFlag) {
  console.error("❗ No file or directory specified.");
  showHelp();
  process.exit(1);
}
if (fileFlag && dirFlag) {
  console.error("❗ Cannot specify both file and directory.");
  process.exit(1);
}

/* Handle file operation */
if (fileFlag) {
  console.info(""); // Padding
  console.info(` ℹ️ Validating file ${colors.gray(fileFlag)}`);

  const problems = validateFile(fileFlag);

  /* Log problems */
  if (problems.length === 0) {
    console.info(`✔️  No problems found ${colors.gray(fileFlag)}`);

  } else {
    console.error(`❗ Problems found in ${colors.gray(fileFlag)}`);
    problems.forEach(problem => console.error(` ❌ ${problem}\n`));
  }
  console.info(""); // Padding

  /* Exit appropriately */
  if (problems.length > 0) process.exit(1);
  process.exit(0);
}

/* Handle directory operation */
if (dirFlag) {
  console.info(""); // Padding
  console.info(` ℹ️ Validating directory and its children ${colors.gray(dirFlag)}`);

  const perFileProblems = validateDirectory(dirFlag);

  /* Log problems */
  Object.entries(perFileProblems).forEach(([file, problems]) => {
    if (problems.length === 0) {
      if (verbose) console.info(`✔️  No problems found ${colors.gray(file)}`);
    } else {
      console.error(""); // Padding
      console.error(`❗ Problems found in ${colors.gray(file)}`);
      problems.forEach(problem => console.error(` ❌ ${problem}\n`));
      console.error(""); // Padding
    }
  });

  /* Exit appropriately */
  const problematicFileCount = Object.values(perFileProblems).filter(fileProblems => fileProblems.length !== 0).length;
  if (problematicFileCount > 0) process.exit(1);
  console.info("✔️  No problems found in any files.");
  console.info(""); // Padding
  process.exit(0);
};

function validateFile(filePath: string | null): string[] {
  // Falsy file path
  if (!filePath) {
    console.error("❗ No file specified.");
    process.exit(1);
  }

  // Resolve path
  if (!path.isAbsolute(filePath)) {
    filePath = path.resolve(filePath);
    if (!filePath) {
      console.error("❗ Could not resolve path.");
      process.exit(1);
    }
  }

  // File exists
  if (!fs.existsSync(filePath)) {
    console.error("❗ File does not exist.");
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
    console.error("❗ No directory specified.");
    process.exit(1);
  }

  // Resolve path
  if (!path.isAbsolute(dirPath)) {
    dirPath = path.resolve(dirPath);
    if (!dirPath) {
      console.error("❗ Could not resolve path.");
      process.exit(1);
    }
  }

  // Directory exists
  if (!fs.existsSync(dirPath)) {
    console.error("❗ Directory does not exist.");
    process.exit(1);
  }

  // Per file problem tracker
  const perFileProblems: { [file: string]: string[] } = {};

  // Get all dict files in dir and sub dirs with absolute paths TODO: Refactor to use glob if that is beneficial
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
    console.error(`❗ No ${colors.green(dictFileRegex.toString())} ${consoleColors.error("files found.")}`);
    process.exit(1);
  }

  // Validate
  dictFiles.forEach(file => {
    const absoluteFilePath = file.path;
    const relativeFilePath = path.relative(process.cwd(), absoluteFilePath);

    const fileContent = fs.readFileSync(absoluteFilePath, "utf8");

    // Invalid JSON, check
    try { JSON.parse(fileContent); } catch (e) {
      perFileProblems[relativeFilePath] = [`File is not a valid JSON, see error:\n\n${e}`];
      return perFileProblems;
    }

    const data = JSON.parse(fileContent);

    perFileProblems[relativeFilePath] = validateDictObject(data);
  });

  return perFileProblems;
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
    problems.push(`Mixed types. Branch nodes may only contain other objects. Leaf nodes may only contain strings.\n  Found:\n${found}`);
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
    problems.push(`Leaf nodes can only contain \`Locale\` strings.\n   Found:\n    ${found}`);
  }
  // Number of locales, check
  if (keys.length !== strictLocale.length) {
    const expected = `{ ${strictLocale.map(locale => `"${locale}": string`).join(", ")} }`;
    const found = dictToStringShallow(dict);
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

function dictToStringShallow(obj: object, linebreak: boolean = false): string {

  const keyValues = Object.entries(obj).map(([key, value]) => {
    if (typeof value === "string") return `"${key}": "${value}"`;
    return `"${key}": ${value}`;
  });

  if (linebreak) return `{\n  ${keyValues.join(", \n  ")}\n}`;

  return `{ ${keyValues.join(", ")} }`;
}