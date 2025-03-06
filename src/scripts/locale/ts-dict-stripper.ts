/** Extracts a json object out of a `.dict.ts` file, disregarding the TypeScript code */
export function tsDictStripper(fileContent: string): object {
  const startOfFile = /import.*\r?\n.*\({$/gm;
  const endOfFile = /\);\s?$/gm;

  const dict = fileContent
    .replace(startOfFile, "{")
    .replace(endOfFile, "")
    .replaceAll(/(?<="\w*":\s.*\r?\n\s+\})(\[locale\])/gm, "") // Strip `[locale]` from the file
    .replaceAll(/\,(?!\s*?[\{\[\"\'\w])/gm, ""); // Remove trailing commas

  return JSON.parse(dict);
}

export function tsDictMaker(dict: object): string {

  /**
   * Finds the leaf objects in the json data to append the `[locale]` suffix to.
   */
  const leafObjectFinderRegex = /"\w{2}":\s.*\r?\n\s+\}/gm;

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

  return templateTSON(dict.toString());
}