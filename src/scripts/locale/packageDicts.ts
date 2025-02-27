import { glob } from "glob";
import path from "path";
import { dictFileEnding, findSubDict, getDictObjectFromJsonFile, KeyNameHandler, packagedDictionaryPath, saveDictObjectAsJsonFile } from "./dictUtils";

function packageDicts(): void {
  console.info(""); // Padding
  console.info(" \x1b[34mℹ️\x1b[0m Packaging dictionaries...");

  function createKey(dict: { [key: string]: string | object }, key: string): void {
    if (!(key in dict)) {
      dict[key] = {};
    }
  }

  const outDict: { [key: string]: string | object } = {};

  const rootFolderPath: string = "src"
  const filePaths: string[] = glob.sync(rootFolderPath + "/**/*" + dictFileEnding);

  for (const filePath of filePaths) {
    const relativePath: string = path.relative(rootFolderPath, filePath);
    const pathParts: string[] = relativePath.split(path.sep);

    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i].endsWith(dictFileEnding)) {
        // This line decides what the key for the dict file will look like
        pathParts[i] = KeyNameHandler.fileNameToKey(pathParts[i]);

        const subDict: { [key: string]: string | object } = findSubDict(outDict, pathParts, i);
        createKey(subDict, pathParts[i]);
        subDict[pathParts[i]] = getDictObjectFromJsonFile(filePath);
      }
      else {
        // This line decides what the key for the folder will look like
        pathParts[i] = KeyNameHandler.folderNameToKey(pathParts[i]);

        const subDict: { [key: string]: string | object } = findSubDict(outDict, pathParts, i);
        createKey(subDict, pathParts[i]);
      }
    }
  }

  saveDictObjectAsJsonFile(outDict, packagedDictionaryPath);
  console.info("✔️  Done packaging dictionaries.")
  console.info(""); // Padding
}

packageDicts()
