import { glob } from "glob";
import { dictFileEnding, getObjectFromJson, saveDictAsJson } from "./dictHandler";

export default function formatDicts(): void {
  console.log("Formatting dict files...");

  const filePaths: string[] = glob.sync("src/**/*" + dictFileEnding);

  for (const filePath of filePaths) {
    saveDictAsJson(getObjectFromJson(filePath), filePath);
  }

  console.log("Done formatting dict files.");
}

formatDicts()
