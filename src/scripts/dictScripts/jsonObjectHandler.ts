import fs from "fs";

export function getObjectFromJson(filePath: string): object {
  const jsonData = fs.readFileSync(filePath, { encoding: 'utf8' });
  return JSON.parse(jsonData);
}

export function saveDictAsJson(dict: object, filePath: string): void {
  fs.writeFileSync(filePath, JSON.stringify(dict, null, 2));
}
