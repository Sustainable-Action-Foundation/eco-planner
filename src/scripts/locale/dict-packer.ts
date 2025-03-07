import "../lib/console.ts";
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";
import { tsDictMaker, tsDictStripper } from "./ts-dict-stripper.ts";
import { colors } from "../lib/colors.ts";


/* Package and Unpackage common config */
const dictFileEnding = ".dict.ts";
const dictSourceFolder = "src";
/** Where the packaged file will end up and where it is read from */
const packageDestination = "locale_package.json";
export const packageNameModifiers = {
  file: {
    prefix: "",
    suffix: "--file",
  },
  dir: {
    prefix: "",
    suffix: "--directory",
  }
};
const stripModifiers = (str: string) => str.replace(packageNameModifiers.file.prefix, "").replace(packageNameModifiers.file.suffix, "").replace(packageNameModifiers.dir.prefix, "").replace(packageNameModifiers.dir.suffix, "");
const dictPaths = glob.sync(`${dictSourceFolder}/**/*${dictFileEnding}`);


/* Flag validation */
const calledFromThisFile = import.meta.url === `file://${process.argv[1]}`; /* This is done since other files import values from this file everything here gets evaluated. */
const packageFlag = process.argv.includes("package") || process.argv.includes("pack");
const unpackageFlag = process.argv.includes("unpackage") || process.argv.includes("unpack");

if (calledFromThisFile && !packageFlag && !unpackageFlag) {
  console.warn(`⚠️  Missing command. Please provide the command \`package\` or \`unpackage\``);
  process.exit(1);
}
else if (calledFromThisFile && packageFlag && unpackageFlag) {
  console.warn(`⚠️  Conflicting commands. Please provide only one of the following: \`package\` or \`unpackage\``);
  process.exit(1);
}


/* Packaging handling */
if (packageFlag) {
  console.info(`📦 Packaging dictionaries...`);

  try {
    Package();
  }
  catch (error) {
    console.error(`❌ Packaging dictionaries failed.`, error);
    process.exit(1);
  }

  console.info(`📦 Packaging dictionaries done!`);
  process.exit(0);
}

/* Unpacking handling */
if (unpackageFlag) {
  console.info(`📦 Unpacking dictionaries...`);

  try {
    Unpackage();
  }
  catch (error) {
    console.error(`❌ Unpacking dictionaries failed.`, error);
    process.exit(1);
  }

  console.info(`📦 Unpacking dictionaries done!`);
  process.exit(0);
}


/* Packaging logic */
function Package() {
  if (!dictPaths.length) {
    console.warn("⚠️  No dict files found. This is likely not desired.");
    process.exit(1);
  }

  // Reset package
  if (!fs.existsSync(packageDestination)) fs.rmSync(packageDestination, { force: true });
  fs.writeFileSync(packageDestination, "{}", "utf-8");

  for (const filePath of dictPaths) {

    /** Encode all the parts of the file path to this dict. */
    const pathComponents = filePath.split(/[/\\]/gm)
      .map(component => {

        // If it has file ending, add prefix and suffix
        if (component.endsWith(dictFileEnding)) {
          return `${packageNameModifiers.file.prefix}${component.replace(dictFileEnding, "")}${packageNameModifiers.file.suffix}`;
        }

        // Else it's a directory, add prefix and suffix
        return `${packageNameModifiers.dir.prefix}${component}${packageNameModifiers.dir.suffix}`;
      })
      .filter(Boolean);

    const rawDict = fs.readFileSync(filePath, "utf-8");
    try {
      tsDictStripper(rawDict, filePath);
    } catch (error) {
      console.warn(`⚠️  Error stripping dict at`, colors.gray(filePath), error);
      process.exit(1);
    }
    const dict = tsDictStripper(rawDict, filePath);
    const packageContent = JSON.parse(fs.readFileSync(packageDestination, "utf-8"));

    // Walk the tree
    let currentPackage = packageContent;
    for (const component of pathComponents) {
      if (!currentPackage[component]) currentPackage[component] = {};
      currentPackage = currentPackage[component];
    }

    // Populate tree
    for (const [key, value] of Object.entries(dict)) {
      currentPackage[key] = value;
    }

    // Write to package
    fs.writeFileSync(packageDestination, JSON.stringify(packageContent, null, 2), "utf-8");
  }
}

/* Unpacking logic */
function Unpackage() {
  // Check if package exists
  if (!fs.existsSync(packageDestination)) {
    console.warn(`⚠️  Package not found at`, colors.gray(packageDestination));
    process.exit(1);
  }

  // Try parse
  try {
    JSON.parse(fs.readFileSync(packageDestination, "utf-8"))
  }
  catch (error) {
    console.warn(`⚠️  Package is not valid JSON.`, error);
    process.exit(1);
  }

  const packageContent = JSON.parse(fs.readFileSync(packageDestination, "utf-8"));

  // Walk the package
  walkPackage(packageContent, "./"); // Walks from root since package structure assumes the same
}

/* Unpacking helpers */
function walkPackage(packageContent: any, currentPath: string) {
  Object.entries(packageContent).forEach(([key, value]) => {
    const keyType = isFileOrDir(key);

    if (keyType === "file") {
      const filePath = path.join(currentPath, stripModifiers(key) + dictFileEnding);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  File`, colors.gray(filePath), `does not exist. Creating file...`);
      }

      fs.writeFileSync(filePath, tsDictMaker(value as object), "utf-8");
    }
    else if (keyType === "dir") {
      const dirPath = path.join(currentPath, stripModifiers(key));

      // Check if dir exists
      if (!fs.existsSync(dirPath)) {
        console.warn(`⚠️  Directory`, colors.gray(dirPath), `does not exist. Creating directory...`);
        fs.mkdirSync(dirPath, { recursive: true });
      }

      walkPackage(value, dirPath);
    }
  });
};
function isFileOrDir(key: string): "file" | "dir" | "none" {
  if (key.startsWith(packageNameModifiers.file.prefix) && key.endsWith(packageNameModifiers.file.suffix)) return "file";
  if (key.startsWith(packageNameModifiers.dir.prefix) && key.endsWith(packageNameModifiers.dir.suffix)) return "dir";
  return "none";
}