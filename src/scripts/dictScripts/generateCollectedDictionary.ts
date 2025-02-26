import { glob } from "glob";
import path from "path";
import CaseHandler from "./caseHandler";
import { getObjectFromJson, saveDictAsJson, findSubDict, collectedDictionaryPath, dictFileEnding } from "./dictHandler";

// TODO - implement locale dict type?
function generateCollectedDictionary(): void {
  console.log("Generating collected dictionary...");

  function createKey(dict: { [key: string]: string | object }, key: string): void {
    if (!(key in dict)) {
      dict[key] = {};
    }
  }

  const outDict: { [key: string]: string | object } = {};

  const filePaths: string[] = glob.sync("src/**/*"+dictFileEnding);

  for (const filePath of filePaths) {
    const relativePath: string = path.relative('src', filePath);
    const pathParts: string[] = relativePath.split(path.sep);

    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i].endsWith(dictFileEnding)) {
        // This line decides what the key for the dict file will look like
        pathParts[i] = CaseHandler.camelToMacro(pathParts[i].split(dictFileEnding)[0]);

        const subDict: { [key: string]: string | object } = findSubDict(outDict, pathParts, i);
        createKey(subDict, pathParts[i]);
        subDict[pathParts[i]] = getObjectFromJson(filePath);
      }
      else {
        // This line decides what the key for the folder will look like
        pathParts[i] = CaseHandler.camelToPascalSnake(pathParts[i]);

        const subDict: { [key: string]: string | object } = findSubDict(outDict, pathParts, i);
        createKey(subDict, pathParts[i]);
      }
    }
  }

  saveDictAsJson(outDict, collectedDictionaryPath);
}

generateCollectedDictionary();
