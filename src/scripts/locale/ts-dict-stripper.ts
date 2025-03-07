import { colors } from "../lib/colors";

let safeCommentIndex = 0;
const safeCommentKey = "//comment";
const getSafeCommentKey = () => { safeCommentIndex++; return safeCommentKey + safeCommentIndex.toString(); };

/** 
 * Takes a `.dict.ts` file and converts it to a JSON object by stripping out the TypeScript syntax.
 * @param fileContent The string content of the `.dict.ts` file
 * @param filePath Optional path to the file for richer error messages
*/
export function tsDictStripper(fileContent: string, filePath?: string): object {

  try {
    return uriDecodeObject(JSON.parse(format(fileContent)));
  } catch (error) {
    console.error(`❌ Error stripping dict:`, colors.gray(filePath || ""), error);
    process.exit(1);
  }

  /** Strips away typescript syntax and formats to json */
  function format(content: string): string {
    return content
      /* Save functions in a safe format */
      .replaceAll(/\(.*\)\s?=>\s?`(.*)`(?=,?$)/gmu, (_fullMatch, functionBody) => `"${functionBody}"`)
      /* URI encode every key and value */
      .replaceAll(/(?<=^\s*").*(?=":)|(?<=^\s*".*":\s").*(?=")/gmu, match => encodeURIComponent(match))
      /* Save comments in a safe format */
      .replaceAll(/\/\/\s.*|\/\*\*?\s.*\s\*\//gmu, match => `"${getSafeCommentKey()}": "${encodeURIComponent(match)}",`)
      /* Remove import/export statement and the closing `);` */
      .replaceAll(/^import.*\r?\n.*\((?=\{)|(?<=\})\);/gmu, "")
      /* Strip out `[locale]` */
      .replaceAll(/(?<!.*".*)(?<=\})\[locale\](?!.*".*)/gmu, "")
      /* Remove trailing commas */
      .replaceAll(/(?:(?<="[^"]*":\s"[^"]*")|(?<=\})),(?=\r?\n\s*\})/gmu, "");
  }
}

/** 
 * Takes a JSON object and converts it to a `.dict.ts` file with the correct format
 */
export function tsDictMaker(dict: object): string {

  return typescriptWrapper(format(dict));

  /** Boilerplate bare minimum import and export code wrapping an object */
  function typescriptWrapper(content: string) {
    return `import { Locale } from "@/types.ts";\nexport const createDict = (locale: Locale) => (${content});`
  };

  /** Handles converting a json object to a string formatted as typescript */
  function format(content: object): string {
    const indent = "  ";
    let indentDepth = 0;
    return JSON.stringify(uriEncodeObject(content))
      /* Add trailing commas */
      .replaceAll(/(?=\})/gmu, ",")
      /* Add space between `:` and values */
      .replaceAll(/(?<=":)(?=["\{])/gmu, " ")
      /* Re-add line breaks */
      .replaceAll(/(?<=\{)|(?<=\},)|(?<=",)/gmu, "\n")
      /* Resolve comments */
      .replaceAll(new RegExp(`^\\s*"${encodeURIComponent(safeCommentKey)}\\d+":\\s"([^"]*)"`, "gmu"), (_fullMatch, commentBody) => decodeURIComponent(commentBody))
      /* Remove commas on comments */
      .replaceAll(/(?<=\/\*\*?.*\*\/|\/\/.*),/gmu, "")
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
      .replaceAll(/(?<=^\s*").*(?=":)|(?<=^\s*".*":\s").*(?=")/gmu, match => decodeURIComponent(match))
      /* Resolve functions */
      .replaceAll(/(?<="\w*":\s?)"(.*\$.*\{.*\}.*)"(?=,?)/gmu, (_fullMatch, functionBody) => {
        const placeholders = functionBody.matchAll(/(?<=\$\{)[^{}]*(?=\})/gmu);
        const args = [...placeholders].map(placeholder => `${placeholder}: string`).join(", ");
        return `(${args}) => \`${decodeURIComponent(functionBody)}\``;
      });
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