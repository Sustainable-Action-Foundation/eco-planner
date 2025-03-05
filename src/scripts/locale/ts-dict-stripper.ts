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