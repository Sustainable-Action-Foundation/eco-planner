
/** Extracts a json object out of a `.dict.ts` file, disregarding the TypeScript code */
export function tsDictStripper(fileContent: string): object {

  const dict = fileContent
    /* Remove import/export statement and the closing `);` */
    .replaceAll(/^import.*\r?\n.*\((?=\{$)|(?<=\})\);/gm, "")
    /* Strip out `[locale]` */
    .replaceAll(/(?<!.*".*)(?<=\})\[locale\](?!.*".*)/gm, "")
    /* Remove trailing commas */
    .replaceAll(/(?:(?<="\w*":\s"[^"]*")|(?<=\})),(?=\r?\n\s*\})/gm, "");

  return JSON.parse(dict);
}

/** Creates a `.dict.ts` file from a json object */
export function tsDictMaker(dict: object): string {

  const formatContent = (content: string): string => {
    const indent = "  ";
    let indentDepth = 0;
    return content
      /* Add trailing commas */
      .replaceAll(/(?<=[^\w\\])(?=\}[^\w\\])/gm, ",")
      /* Add space between `:` and values */
      .replaceAll(/(?<="\w*":)/gm, " ")
      /* Re-add line breaks */
      .replaceAll(/(?<=[}"],|\{)/gm, "\n")
      /* Add `[locale]` to each leaf */
      .replaceAll(/(?<="\w{2}": "[^"]*",\r?\n\})/gm, "[locale]")
      /* Indent */
      .split("\n")
      .map(line => {
        if (line.includes("}")) indentDepth--;
        const newLine = indent.repeat(indentDepth) + line;
        if (line.includes("{")) indentDepth++;
        return newLine;
      })
      .join("\n");
  }

  const templateTSON = (content: string) => `
import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => (${formatContent(content)});
  `.trim();

  return templateTSON(JSON.stringify(dict));
}