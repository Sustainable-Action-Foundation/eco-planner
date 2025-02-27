import path from 'path';
import { findSubDict, getDictObjectFromJsonFile, KeyNameHandler, packagedDictionaryPath, saveDictObjectAsJsonFile } from './dictUtils';

function unpackDicts(): void {
  console.log("Unpacking packaged dictionary...");

  const packagedDictionary: { [key: string]: string | object } = getDictObjectFromJsonFile(packagedDictionaryPath);

  // TODO - can this be improved/refactored so that paths dont have to be processed after this function is called? (referring to the removal of the last key of the path aswell as removal of duplicates)
  function findSubDictPaths(inDict: { [key: string]: string | object }): string[] {
    const paths: string[] = [];
    for (const key of Object.keys(inDict)) {
      // If the value is an object and the key is formatted as a file or folder name
      if (typeof inDict[key] === "object" && (KeyNameHandler.keyIsFileOrFolderName(key))) {
        const subDictPaths: string[] = findSubDictPaths(inDict[key] as { [key: string]: string | object });
        for (const subDictPath of subDictPaths) {
          paths.push(path.join(key, subDictPath));
        }
      }
      else if ((paths.includes(key) == false)) {
        paths.push(key);
      }
    }
    return paths;
  }

  let subDictPaths: string[] = findSubDictPaths(packagedDictionary);

  // Remove the last key from the path as it is the first key of each file
  // This is done to only get the path (including the file name) of the sub dictionaries
  for (let i: number = 0; i < subDictPaths.length; i++) {
    const splitPath: string[] = subDictPaths[i].split(path.sep);
    subDictPaths[i] = splitPath.slice(0, splitPath.length - 1).join(path.sep);
  }

  // Remove duplicates that are created by the recursive function
  subDictPaths = subDictPaths.filter((item, index) => subDictPaths.indexOf(item) === index)

  for (let filePath of subDictPaths) {
    const pathParts: string[] = filePath.split(path.sep);

    const subDict: { [key: string]: string | object } = findSubDict(packagedDictionary, pathParts, pathParts.length);

    // Convert pathParts from keys to folder/file names
    for (let i: number = 0; i < pathParts.length; i++) {
      pathParts[i] = KeyNameHandler.keyToFileOrFolderName(pathParts[i]);
    }

    const joinedPathParts: string = pathParts.join(path.sep);
    filePath = path.join("src", joinedPathParts);

    saveDictObjectAsJsonFile(subDict, filePath);
  }

  console.log("Done unpacking packaged dictionary.");
}

unpackDicts()
