import fs from 'fs';
import { execSync } from "child_process";

/**
 * This script generates a json file containing the short and long commit hashes of the current commit.
 * The file is used to display the commit hash of the current build in the information page and link to the commit on GitHub.
 * The output is saved in src/lib/commitHash.json
 */
async function getBuildInfo() {
  const info: { shortHash?: string, longHash?: string } = {}

  // Try getting commit hashes
  try {
    const shortHash = execSync('git rev-parse --short HEAD')?.toString().trim();
    const longHash = execSync('git rev-parse HEAD')?.toString().trim();

    console.log(`The current commit hash is: ${shortHash || "no short hash"} (${longHash || "no long hash"})`)
    info.shortHash = shortHash;
    info.longHash = longHash;
  } catch {
    console.log("Failed to get commit hashes")
  }

  if (info.shortHash || info.longHash) {
    // Try to write info to file
    try {
      fs.writeFileSync('src/lib/commitHash.json', JSON.stringify(info));
      console.log("Commit hash info updated");
    } catch {
      console.log("Failed to write commit hashes to file");
    }
  } else {
    console.log("No commit hashes found; file untouched");
  }
}

getBuildInfo();