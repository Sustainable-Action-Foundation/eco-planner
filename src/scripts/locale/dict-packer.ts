import { colors } from "../lib/colors.ts";
import "../lib/console.ts";
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";
import { tsDictStripper } from "./ts-dict-stripper.ts";


/** Package and Unpackage common config */
const dictFileEnding = ".dict.ts";
const dictSourceFolder = "src";
export const nameModifiers = {
  file: {
    prefix: "",
    suffix: "",
  },
  dir: {
    prefix: "",
    suffix: "",
  }
};
const dictPaths = glob.sync(`${dictSourceFolder}/**/*${dictFileEnding}`);


/** Flag validation */
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

/** Package */
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

/** Unpackage */
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

}


function Unpackage() {

}


// if (!dictPaths.length) {
//   console.error("❗ No dict files found. This is likely not desired.");
//   process.exit(1);
// }

// for (const filePath of dictPaths) {
//   const fileContent = fs.readFileSync(filePath, "utf-8");
//   const dict = tsDictStripper(fileContent);

//   const pathParts = filePath.split(/[/\\]/gm);
//   const fileName = pathParts.pop();

// }