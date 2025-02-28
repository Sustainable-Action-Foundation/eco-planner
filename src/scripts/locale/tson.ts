import path from "node:path";
import fs from "node:fs";
import { glob } from "glob";
import { Locale } from "@/types";
// import { createDict } from "./.dict.ts";

// const dict = createDict(Locale.en);
// console.log(dict.scaleFactor);

// process.exit(0);

const fileEndings = {
  old: ".dict.json",
  new: ".dict.ts",
}
const dictPaths = glob.sync(`src/**/*${fileEndings.old}`).map(file => path.resolve(file));

const localeStrings = [...new Set(Object.values(Locale))];


const formatContent = (content: string): string => {
  return content
    .split("\n")
    .map((line, i) => { // Pad start
      if (i === 0) return line;
      return line.padStart(line.length + 0);
    })
    .join("\n")
    /** 
     * Regex finds an instance of any of the locale strings, followed by a new line that has a closing bracket on it.
     * This is done to find leaf objects that will need the [locale] suffix. The suffix is added to the closing bracket.
    */
    .replace(new RegExp(`"(${localeStrings.join("|")})":\\s*"[^"]*"\\s*\\n\\s*}`, "g"), (match) => {
      return match.replace(/\n*}/, `}[locale]`);
    })
    .replace(/\n/g, "\n") // Make whitespace consistent
}

const templateTSON = (content: string) => `
import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => (${formatContent(content)});
`.trim();

const newTSON = fs.readFileSync(dictPaths[0], "utf-8");
fs.writeFileSync(path.join("src/scripts/locale", fileEndings.new), templateTSON(newTSON));