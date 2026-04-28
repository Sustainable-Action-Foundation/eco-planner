import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/require-await
export async function GET() {
  const body = { sha: process.env.COMMIT_SHA };

  if (!body.sha) {
    return new NextResponse(
      JSON.stringify(body),
      { status: 500, statusText: "Internal Server Error" },
    );
  }

  return new NextResponse(
    JSON.stringify(body),
    { status: 200, statusText: "OK" },
  );
}