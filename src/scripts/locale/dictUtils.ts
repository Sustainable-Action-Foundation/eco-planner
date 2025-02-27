import fs from "node:fs";
import path from "node:path";

export const packagedDictionaryPath: string = path.join("packagedDictionary.json");
export const dictFileEnding: string = ".dict.json";

/**
 * When packaging all dictionary files, the folder structure 
 * is maintained by using these prefixes and suffixes to 
 * differentiate folders and files from translation keys.
 */
export const [folderNamePrefix, folderNameSuffix] = ["", "-folder"];
export const [fileNamePrefix, fileNameSuffix] = ["", "-file"];

/**
 * This class is used to convert folder and file names to keys
 * and vice versa. The keys are used to represent the folders
 * and files in the packaged dictionary. The keys are used to
 * maintain the folder structure when packaging the dictionary.
 * @public
 */
export class KeyNameHandler {
  public static folderNameToKey(folderName: string): string {
    return folderNamePrefix + folderName + folderNameSuffix;
  }

  public static fileNameToKey(fileName: string): string {
    return fileNamePrefix + fileName.replace(dictFileEnding, fileNameSuffix);
  }

  public static keyToFileOrFolderName(key: string): string {
    if (key.endsWith(fileNameSuffix) && key.startsWith(fileNamePrefix)) {
      return key.replace(fileNamePrefix, "").replace(fileNameSuffix, dictFileEnding);
    }
    return key.replace(folderNamePrefix, "").replace(folderNameSuffix, "");
  }

  public static keyIsFolderName(key: string): boolean {
    return key.endsWith(folderNameSuffix) && key.startsWith(folderNamePrefix);
  }

  public static keyIsFileName(key: string): boolean {
    return key.endsWith(fileNameSuffix) && key.startsWith(fileNamePrefix);
  }

  public static keyIsFileOrFolderName(key: string): boolean {
    return this.keyIsFileName(key) || this.keyIsFolderName(key);
  }
}

/**
 * Reads a JSON file with UTF-8 encoding and returns the parsed JSON object.
 * fs.readFileSync is used to read the file.
 * @param filePath 
 * @returns
 */
export function getDictObjectFromJsonFile(filePath: string): { [key: string]: string | object } {
  const jsonData: string = fs.readFileSync(filePath, { encoding: "utf8" });
  return JSON.parse(jsonData) as { [key: string]: string | object };
}

/**
 * Saves a dictionary object as a JSON file with 2 space indentation, UTF-8 encoding and CRLF End of Line Sequence.
 * fs.writeFileSync is used to write the file.
 * @param dict 
 * @param filePath 
 */
export function saveDictObjectAsJsonFile(dict: object, filePath: string): void {
  // Stringify and replace all line breaking characters with \n to make sure the files are using CRLF
  fs.writeFileSync(filePath, JSON.stringify(dict, null, 2).replace(/\n/g, "\u000d\u000a"), { encoding: "utf8" });
}

export function findSubDict(inDict: { [key: string]: string | object }, keys: string[], depth: number): { [key: string]: string | object } {
  let outDict: { [key: string]: string | object } = inDict;
  for (let i: number = 0; i < depth; i++) {
    if (typeof outDict[keys[i]] === "object") {
      outDict = outDict[keys[i]] as { [key: string]: string | object };
    }
  }
  return outDict
}
