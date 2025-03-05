import { colors } from "../lib/colors.ts";
import "../lib/console.ts";
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";
import { tsDictStripper } from "./ts-dict-stripper.ts";


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
const dictPaths = glob.sync(`${dictSourceFolder}/**/*${dictFileEnding}`);


/* Flag validation */
const packageFlag = process.argv.includes("package");
const unpackageFlag = process.argv.includes("unpackage");
if (!packageFlag && !unpackageFlag) {
  console.warn(`⚠️  Missing command. Please provide the command \`package\` or \`unpackage\``);
  process.exit(1);
}
else if (packageFlag && unpackageFlag) {
  console.warn(`⚠️  Conflicting commands. Please provide only one of the following: \`package\` or \`unpackage\``);
  process.exit(1);
}

/* Package */
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

/* Unpackage */
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


function Package() {
  if (!dictPaths.length) {
    console.warn("❗ No dict files found. This is likely not desired.");
    process.exit(1);
  }

  // Ensure destination exists
  if (!fs.existsSync(packageDestination)) fs.writeFileSync(packageDestination, "{}", "utf-8");

  for (const filePath of dictPaths) {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const dict = tsDictStripper(fileContent);

    /**  */
    const pathComponents = filePath.split(/[/\\]/gm);
    console.debug(pathComponents);

    /** File name including the `prefix` and `suffix` */
    const fileName = `${packageNameModifiers.file.prefix}${path.basename(filePath).replace(dictFileEnding, "")}${packageNameModifiers.file.suffix}`;

    // Create a new entry in the package with this files entire path
    const packageContent = JSON.parse(fs.readFileSync(packageDestination, "utf-8"));

  }
}


function Unpackage() {

}