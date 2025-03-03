import path from "node:path";
import fs from "node:fs";
import { glob } from "glob";

/**
 * This script is used to convert the old `.dict.json` files to the new `.dict.ts` files.
 * It adds a bit of code to the top of the file to export the body which is made of the old json data.
 */

const fileEndings = {
  old: ".dict.json",
  new: ".dict.ts",
}
const dictPaths = glob.sync(`src/**/*${fileEndings.old}`).map(file => path.resolve(file));

/** 
 * Finds the leaf objects in the json data to append the `[locale]` suffix to.
 */
const leafObjectFinderRegex = /(?:"(?:.*)":)\s*(?:"[^"]*")[^:}]*}/g;

const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
}

const formatContent = (content: string): string => {
  return content
    .split("\n")
    .map((line, i) => { // Pad start
      if (i === 0) return line;
      return line.padStart(line.length + 0);
    })
    .join("\n")
    .replaceAll(leafObjectFinderRegex, match => match + "[locale]")
    .replace(/\n/g, "\n") // Make whitespace consistent
}

const templateTSON = (content: string) => `
import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => (${formatContent(content)});
`.trim();

let problems = false;

/* Go through all files */
dictPaths.forEach(filePath => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const newContent = templateTSON(content);
    const newFilePath = filePath.replace(fileEndings.old, fileEndings.new);

    fs.renameSync(filePath, newFilePath);
    fs.writeFileSync(newFilePath, newContent);
  } catch (error) {
    console.error(colors.red(`❌ Failed to convert file: ${colors.gray(filePath)}\n  ${colors.red(error as string)}\n`));
    problems = true;
  }
});

if (!problems) {
  console.info("");
  console.info("✔️  All files converted successfully!");
  console.info("");
}
