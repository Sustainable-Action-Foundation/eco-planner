import fs from "node:fs";
import { glob } from "glob";
import { dictFileEnding } from "./dictHandler.ts";

formatDicts();

function formatDicts(): void {
  console.info(""); // Padding
  console.info("\x1b[34mℹ️\x1b[0m Formatting locale files...");

  const filePaths: string[] = glob.sync("src/**/*" + dictFileEnding);

  for (const filePath of filePaths) {
    // JSON parsing may fail in case of invalid JSON files
    try {
      const fileContent = fs.readFileSync(filePath, { encoding: "utf8" });

      let data = JSON.parse(fileContent);
      data = JSON.stringify(data, null, 2);

      /** Make sure all line breaks are CRLF */
      data = data.replace(/\n/g, "\u000d\u000a");

      fs.writeFileSync(filePath, data, { encoding: "utf8" });

    } catch (error) {
      console.error(`\n ❌ Error formatting file \x1b[30m${filePath}\x1b[0m. See error:\n\x1b[31m${error}\x1b[0m\n`);
    }
  }

  console.info("✔️ Done formatting locale files.");
  console.info(""); // Padding
}