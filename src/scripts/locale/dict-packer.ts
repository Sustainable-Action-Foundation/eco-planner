import { colors } from "../lib/colors.ts";
import "../lib/console.ts";
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";
import { tsDictStripper } from "./ts-dict-stripper.ts";

export const nameModifiers = {
  file: {
    prefix: "",
    suffix: "",
  },
  dir: {
    prefix: "",
    suffix: "",
  }
}

const dictFileEnding = ".dict.ts";
const dictPaths = glob.sync(`src/**/*${dictFileEnding}`);

if (!dictPaths.length) {
  console.error("❗ No dict files found. This is likely not desired.");
  process.exit(1);
}

for (const filePath of dictPaths) {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const dict = tsDictStripper(fileContent);

}