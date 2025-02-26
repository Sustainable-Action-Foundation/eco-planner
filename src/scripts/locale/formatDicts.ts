import { glob } from "glob";
import { dictFileEnding, getObjectFromJson, saveDictAsJson } from "./dictHandler";

export default function formatDicts(): void {
  console.log("Formatting dict files...");

  const filePaths: string[] = glob.sync("src/**/*" + dictFileEnding);

  for (const filePath of filePaths) {
    console.log("Formatting: " + filePath + "...");
    saveDictAsJson(getObjectFromJson(filePath), filePath);
  }
}

formatDicts()
