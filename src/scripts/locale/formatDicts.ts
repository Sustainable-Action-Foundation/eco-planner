import { glob } from "glob";
import { dictFileEnding, getDictObjectFromJsonFile, saveDictObjectAsJsonFile } from "./dictUtils";

formatDicts();

function formatDicts(): void {
  console.info(""); // Padding
  console.info(" \x1b[34mℹ️\x1b[0m Formatting locale files...");

  const filePaths: string[] = glob.sync("src/**/*" + dictFileEnding);

  for (const filePath of filePaths) {
    // JSON parsing may fail in case of invalid JSON files
    try {
      const dict: { [key: string]: string | object } = getDictObjectFromJsonFile(filePath);
      saveDictObjectAsJsonFile(dict, filePath);

    } catch (error) {
      console.error(""); // Padding
      console.error(` ❌ Error formatting file \x1b[30m${filePath}\x1b[0m. See error:\n\x1b[31m${error}\x1b[0m`);
      console.error(""); // Padding
    }
  }

  console.info("✔️  Done formatting locale files.");
  console.info(""); // Padding
}