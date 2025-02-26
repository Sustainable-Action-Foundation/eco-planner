import fs from "fs";
import path from 'path';

export const collectedDictionaryPath: string = path.join('src', 'collectedDictionary.json');
export const dictFileEnding: string = '.dict.json';

export class KeyNameHandler {
  public static fileNameToKey(fileName: string): string {
    return "FILE--" + fileName.replace(dictFileEnding, '');
  }

  public static folderNameToKey(folderName: string): string {
    return "FOLDER--" + folderName;
  }

  public static keyToFileOrFolderName(key: string): string {
    if (key.startsWith("FILE--")) {
      return key.replace("FILE--", "") + dictFileEnding;
    }
    return key.replace("FOLDER--", "");
  }

  public static keyIsFile(key: string): boolean {
    return key.startsWith("FILE--");
  }

  public static keyIsFolder(key: string): boolean {
    return key.startsWith("FOLDER--");
  }

  public static keyIsFileOrFolder(key: string): boolean {
    return this.keyIsFile(key) || this.keyIsFolder(key);
  }
}

export function getObjectFromJson(filePath: string): { [key: string]: string | object } {
  const jsonData: string = fs.readFileSync(filePath, { encoding: 'utf8' });
  return JSON.parse(jsonData) as { [key: string]: string | object };
}

export function saveDictAsJson(dict: object, filePath: string): void {
  fs.writeFileSync(filePath, JSON.stringify(dict, null, 2));
}

export function findSubDict(inDict: { [key: string]: string | object }, keys: string[], depth: number): { [key: string]: string | object } {
  let outDict: { [key: string]: string | object } = inDict;
  for (let i: number = 0; i < depth; i++) {
    if (typeof outDict[keys[i]] === 'object') {
      outDict = outDict[keys[i]] as { [key: string]: string | object };
    }
  }
  return outDict
}

export function deleteCollectedDictionary(): void {
  fs.unlinkSync(collectedDictionaryPath);
}
