
/** Extracts a json object out of a `.dict.ts` file, disregarding the TypeScript code */
export function tsDictStripper(fileContent: string): object {

  const dict = fileContent
    /* Remove import/export statement and the closing `);` */
    .replaceAll(/^import.*\r?\n.*\((?=\{)|(?<=\})\);/gmu, "")
    /* Strip out `[locale]` */
    .replaceAll(/(?<!.*".*)(?<=\})\[locale\](?!.*".*)/gmu, "")
    /* Remove trailing commas */
    .replaceAll(/(?:(?<="\w*":\s"[^"]*")|(?<=\})),(?=\r?\n\s*\})/gmu, "");

  return JSON.parse(dict);
}

/** Creates a `.dict.ts` file from a json object */
export function tsDictMaker(dict: object): string {

  const formatContent = (content: string): string => {
    const indent = "  ";
    let indentDepth = 0;
    return content
      /* Add trailing commas */
      .replaceAll(/(?<=[^\w\\])(?=\}[^\w\\])/gmu, ",") /** Regex: finds empty string that is succeeded by `}`. Does not allow leading or trailing non-word or `\`. TODO: find a more robust discrimination method. */
      /* Add space between `:` and values */
      .replaceAll(/(?<=[,{]"\w*":)(?=["{])/gmu, " ") /** Regex: finds empty strings that are preceded by (`,` or `{`) and `"anyWord"` and `:` it also needs to be succeeded by a `{` or `"` to discriminate as well as possible. TODO: find a more robust discrimination method. */
      /* Re-add line breaks */
      .replaceAll(/(?<=[}"],|:\s?\{)(?=\W)(?!\s*[\wåäö])/gmu, "\n") /** Regex: finds empty strings that are preceded by (`}` or `"`) and `,` it also cannot be succeeded by a letter or `å` or `ä` or `ö`. That last part is not optimal since it is language dependant. TODO: find a better regex. */
      /* Add `[locale]` to each leaf */
      .replaceAll(/(?<="\w{2}": "[^"]*",\r?\n\})/gmu, "[locale]")
      /* Indent */
      .split("\n").map(line => {
        if (line.includes("}")) indentDepth--;
        const newLine = indent.repeat(indentDepth) + line;
        if (line.includes("{")) indentDepth++;
        return newLine;
      }).join("\n");
  }

  const templateTSON = (content: string) => `
import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => (${formatContent(content)});
  `.trim();

  return templateTSON(JSON.stringify(dict));
}