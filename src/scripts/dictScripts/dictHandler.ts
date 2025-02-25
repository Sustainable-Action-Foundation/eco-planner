import fs from "fs";
import path from 'path';

export function getObjectFromJson(filePath: string): object {
  const jsonData = fs.readFileSync(filePath, { encoding: 'utf8' });
  return JSON.parse(jsonData);
}

export function saveDictAsJson(dict: object, filePath: string): void {
  fs.writeFileSync(filePath, JSON.stringify(dict, null, 2));
}

export function findSubDict(inDict: { [key: string]: string | object }, keys: string[], i: number): object {
  let outDict = inDict;
  for (let j = 0; j < i; j++) {
    if (typeof outDict[keys[j]] === 'object') {
      outDict = outDict[keys[j]] as { [key: string]: string | object };
    }
  }
  return outDict
}

export const collectedDictionaryPath = path.join('src', 'collectedDictionary.json');
export const dictFileEnding = '.dict.json';