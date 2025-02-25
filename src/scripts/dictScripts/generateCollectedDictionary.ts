import { glob } from "glob";
import path from "path";
import CaseHandler from "./CaseHandler";
import { getObjectFromJson, saveDictAsJson, collectedDictionaryPath, dictFileEnding } from "./dictHandler";

// TODO - implement locale dict type?
function generateCollectedDictionary() {
  console.log("Generating collected dictionary...");

  function createKey(dict: { [key: string]: string | object }, key: string): void {
    if (!(key in dict)) {
      dict[key] = {};
    }
  }

  function findSubDict(inDict: { [key: string]: string | object }, keys: string[], i: number): object {
    let outDict = inDict;
    for (let j = 0; j < i; j++) {
      if (typeof outDict[keys[j]] === 'object') {
        outDict = outDict[keys[j]] as { [key: string]: string | object };
      }
    }
    return outDict
  }

  const outDict: { [key: string]: string | object } = {};

  const filePaths = glob.sync("src/**/*"+dictFileEnding);


  for (const filePath of filePaths) {
    const relativePath = path.relative('src', filePath);
    const pathParts = relativePath.split(path.sep);

    for (let i = 0; i < pathParts.length; i++) {

      if (pathParts[i].endsWith(dictFileEnding)) {
        // This line decides what the key for the dict file will look like
        pathParts[i] = CaseHandler.camelToMacro(pathParts[i].split(dictFileEnding)[0]);

        const subDict = findSubDict(outDict, pathParts, i) as { [key: string]: string | object };
        createKey(subDict, pathParts[i]);
        subDict[pathParts[i]] = getObjectFromJson(filePath);
      }
      else {
        // This line decides what the key for the folder will look like
        pathParts[i] = CaseHandler.camelToPascalSnake(pathParts[i]);

        const subDict = findSubDict(outDict, pathParts, i) as { [key: string]: string | object };
        createKey(subDict, pathParts[i]);
      }
    }
  }

  saveDictAsJson(outDict, collectedDictionaryPath);
}

generateCollectedDictionary();
