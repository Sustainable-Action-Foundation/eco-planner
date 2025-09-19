import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/require-await
export async function GET() {
  return new NextResponse(null, { status: 200, statusText: "OK" });
}