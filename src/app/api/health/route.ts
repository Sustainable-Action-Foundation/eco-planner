import { NextResponse } from "next/server";
import fs from "node:fs";

// eslint-disable-next-line @typescript-eslint/require-await
export async function GET() {
  const body = { shortHash: process.env.GIT_SHORT_HASH, longHash: process.env.GIT_LONG_HASH };

  if (body.shortHash && body.longHash) {
    return new NextResponse(
      JSON.stringify(body),
      { status: 200, statusText: "OK" }
    );
  }

  // If hash is not set in env, try to get it from file
  if (!body.shortHash && !body.longHash) {
    try {
      const parsedVersion: unknown = JSON.parse(fs.readFileSync("src/lib/commitHash.json", "utf-8"));

      // Set hashes if they are properly formatted
      if (parsedVersion instanceof Object && !(parsedVersion instanceof Array)) {
        if ("shortHash" in parsedVersion && typeof parsedVersion.shortHash === "string") {
          body.shortHash = parsedVersion.shortHash;
        }
        if ("longHash" in parsedVersion && typeof parsedVersion.longHash === "string") {
          body.longHash = parsedVersion.longHash;
        }

        if (!body.shortHash && !body.longHash) {
          throw new Error("Commit hash file does not contain valid hashes");
        }
      } else {
        throw new Error("Invalid commit hash file format");
      }
    } catch (e) {
      if (process.env.TEST_ENVIRONMENT !== "testing") {
        console.error("No commit hash in environment and failed to read commit hash file:", e);
      } else {
        // Silently ignore missing commit hash, as it is expected during local tests and clogs console output
      }
    }
  }

  if ("shortHash" in body && typeof body.shortHash === "string") {
    body.shortHash = body.shortHash;
  }
  if ("longHash" in body && typeof body.longHash === "string") {
    body.longHash = body.longHash;
  }

  return new NextResponse(
    JSON.stringify(body),
    { status: 200, statusText: "OK" }
  );
}