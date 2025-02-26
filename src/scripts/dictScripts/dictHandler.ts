import fs from "fs";
import path from 'path';

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

export const collectedDictionaryPath: string = path.join('src', 'collectedDictionary.json');
export const dictFileEnding: string = '.dict.json';