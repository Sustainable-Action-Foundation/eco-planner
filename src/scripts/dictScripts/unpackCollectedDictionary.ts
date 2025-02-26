import path from 'path';
import CaseHandler from './caseHandler';
import { collectedDictionaryPath, dictFileEnding, findSubDict, getObjectFromJson, saveDictAsJson } from './dictHandler';

function unpackCollectedDictionary() {
  console.log("Unpacking collected dictionary...");

  const collectedDictionary = getObjectFromJson(collectedDictionaryPath);

  // TODO - can this be improved/refactored?
  function findSubDictPaths(inDict: { [key: string]: string | object }): string[] {
    const paths: string[] = [];
    for (const key of Object.keys(inDict)) {
      // If the value is an object and the key is formatted as a file or folder name
      if (typeof inDict[key] === 'object' && (key[0] == key[0].toUpperCase())) {
        const subDictPaths = findSubDictPaths(inDict[key] as { [key: string]: string | object });
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

  let subDictPaths = findSubDictPaths(collectedDictionary as { [key: string]: string | object });

  // Remove the last key from the path as it is the first key of each file
  // This is done to only get the path (including the file name) of the sub dictionaries
  for (let i = 0; i < subDictPaths.length; i++) {
    const splitPath: string[] = subDictPaths[i].split(path.sep);
    subDictPaths[i] = splitPath.slice(0, splitPath.length - 1).join(path.sep);
  }

  // Remove duplicates that are created by the recursive function
  subDictPaths = subDictPaths.filter((item, index) => subDictPaths.indexOf(item) === index)

  for (let filePath of subDictPaths) {
    const pathParts = filePath.split(path.sep);

    const subDict = findSubDict(collectedDictionary as { [key: string]: string | object }, pathParts, pathParts.length) as { [key: string]: string | object };

    // Convert pathParts from keys to folder/file names
    for (let i = 0; i < pathParts.length; i++) {
      pathParts[i] = CaseHandler.snakeToCamel(pathParts[i].toLowerCase());
    }

    const joinedPathParts = pathParts.join(path.sep);
    filePath = path.join('src', joinedPathParts + dictFileEnding);

    saveDictAsJson(subDict, filePath);
  }
}

unpackCollectedDictionary();
