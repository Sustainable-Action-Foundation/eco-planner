import { colors } from "../lib/colors";

/** 
 * Takes a `.dict.ts` file and converts it to a JSON object by stripping out the TypeScript syntax.
 * @param fileContent The string content of the `.dict.ts` file
 * @param filePath Optional path to the file for richer error messages
 */
export function tsDictStripper(fileContent: string, filePath?: string): object {

  const dict = fileContent
    /* URI encode every key and value */
    .replaceAll(/(?<=^\s*").*(?=":)|(?<=^\s*".*":\s").*(?=")/gmu, match => encodeURIComponent(match))
    /* Remove import/export statement and the closing `);` */
    .replaceAll(/^import.*\r?\n.*\((?=\{)|(?<=\})\);/gmu, "")
    /* Strip out `[locale]` */
    .replaceAll(/(?<!.*".*)(?<=\})\[locale\](?!.*".*)/gmu, "")
    /* Remove trailing commas */
    .replaceAll(/(?:(?<="\w*":\s"[^"]*")|(?<=\})),(?=\r?\n\s*\})/gmu, "");

  try {
    JSON.parse(dict);
  } catch (error) {
    console.error(`❌ Error parsing dict:`, colors.gray(filePath || ""), error);
    process.exit(1);
  }

  return uriDecodeObject(JSON.parse(dict));
}

/** 
 * Takes a JSON object and converts it to a `.dict.ts` file with the correct format
 */
export function tsDictMaker(dict: object): string {

  return templateTSON(JSON.stringify(uriEncodeObject(dict)));

  function formatContent(content: string): string {
    const indent = "  ";
    let indentDepth = 0;
    return content
      /* Add trailing commas */
      .replaceAll(/(?=\})/gmu, ",")
      /* Add space between `:` and values */
      .replaceAll(/(?<=":)(?=["\{])/gmu, " ")
      /* Re-add line breaks */
      .replaceAll(/(?<=\{)|(?<=\},)|(?<=",)/gmu, "\n")
      /* Add `[locale]` to each leaf */
      .replaceAll(/(?<="\w*":\s"[^"]*",\r?\n\})(?=,)/gmu, "[locale]")
      /* Indent */
      .split("\n").map(line => {
        if (line.includes("}")) indentDepth--;
        const newLine = indent.repeat(indentDepth) + line;
        if (line.includes("{")) indentDepth++;
        return newLine;
      }).join("\n")
      /* URI decode every key and value */
      .replaceAll(/(?<=^\s*").*(?=":)|(?<=^\s*".*":\s").*(?=")/gmu, match => decodeURIComponent(match));
  };

  function templateTSON(content: string) {
    return `
import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => (${formatContent(content)});
  `.trim()
  };
}

/** URI decode every key and value */
function uriEncodeObject(obj: object) {
  const newObj: Record<string, string | object> = {};
  for (const [key, value] of Object.entries(obj)) {
    newObj[encodeURIComponent(key)] = typeof value === "object" ? uriEncodeObject(value) : encodeURIComponent(value);
  }
  return newObj;
};

/** URI encode every key and value */
function uriDecodeObject(obj: object) {
  const newObj: Record<string, string | object> = {};
  for (const [key, value] of Object.entries(obj)) {
    newObj[decodeURIComponent(key)] = typeof value === "object" ? uriDecodeObject(value) : decodeURIComponent(value);
  }
  return newObj;
};