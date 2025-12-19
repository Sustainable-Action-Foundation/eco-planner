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

  try {
    const commitHashes: unknown = JSON.parse(fs.readFileSync("src/lib/commitHash.json").toString());

    if (
      typeof commitHashes !== "object"
      || commitHashes === null

      // Either long or short hash must be present
      || (
        !("shortHash" in commitHashes) && !("longHash" in commitHashes)
      )
      || ("shortHash" in commitHashes && typeof commitHashes.shortHash !== "string")
      || ("longHash" in commitHashes && typeof commitHashes.longHash !== "string")
    ) {
      throw new Error("Invalid commit hash file format");
    }

    if ("shortHash" in commitHashes && typeof commitHashes.shortHash === "string") {
      body.shortHash = commitHashes.shortHash;
    }
    if ("longHash" in commitHashes && typeof commitHashes.longHash === "string") {
      body.longHash = commitHashes.longHash;
    }
  }
  catch (e) {
    console.error("Failed to read commit hash file:", e);
  }

  return new NextResponse(
    JSON.stringify(body),
    { status: 200, statusText: "OK" }
  );
}