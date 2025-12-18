import { NextResponse } from "next/server";
import fs from "node:fs";

// eslint-disable-next-line @typescript-eslint/require-await
export async function GET() {
  const body = { commitHash: "MISSING" };

  try {
    const commitHashes: unknown = JSON.parse(fs.readFileSync("src/lib/commitHash.json").toString());

    if (
      typeof commitHashes !== "object"
      || commitHashes === null
      || !("longHash" in commitHashes)
      || typeof commitHashes["longHash"] !== "string"
    ) {
      throw new Error("Invalid commit hash file format");
    }

    body.commitHash = commitHashes.longHash;
  }
  catch (e) {
    console.error("Failed to read commit hash file:", e);
  }

  return new NextResponse(
    JSON.stringify(body),
    { status: 200, statusText: "OK" }
  );
}