import path from 'path';
import { collectedDictionaryPath, getObjectFromJson } from './dictHandler';

function unpackCollectedDictionary() {
  console.log("Unpacking collected dictionary...");

  const collectedDictionary = getObjectFromJson(collectedDictionaryPath);

  function findSubDictPaths(inDict: { [key: string]: string | object }): string[] {
    function findSubDictPathsRecursively(inDictRec: { [key: string]: string | object }): string[] {
      let paths: string[] = [];
      for (let key of Object.keys(inDictRec)) {
        if (typeof inDictRec[key] === 'object' && (key[0] != key[0].toLowerCase())) { // TODO - this does not work as it should on '[action_Id]'
          let subPaths = findSubDictPathsRecursively(inDictRec[key] as { [key: string]: string | object });
          for (let subPath of subPaths) {
            paths.push(path.join(key, subPath));
          }
          // paths.push(key);
          // paths = paths.concat(findSubDictPathsRecursively(inDictRec[key] as { [key: string]: string | object }));
        }
        else {
          if ((paths.includes(key) == false)) {
            paths.push(key);
          }
        }
      }
      return paths;
    };

    let returnSubDictPaths = findSubDictPathsRecursively(inDict);
    for (let i = 0; i < returnSubDictPaths.length; i++) {
      let splitPath: string[] = returnSubDictPaths[i].split(path.sep);
      console.log(splitPath);
      // returnSubDictPaths[i] = splitPath.join(path.sep);
      // returSubDictPaths[i] = CaseHandler.macroToCamel(returSubDictPaths[i]);
    }
    return returnSubDictPaths;
  }

  let subDictPaths = findSubDictPaths(collectedDictionary as { [key: string]: string | object });
}

unpackCollectedDictionary();
