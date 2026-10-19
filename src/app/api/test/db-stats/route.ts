import { connection, NextResponse } from "next/server";
import { getDbStats } from "@/lib/prisma/dbStats";

/**
 * Cumulative, process-global Prisma query counters for the query-budget e2e canary.
 * Never touches the DB. Only served outside production or in the docker test stack.
 */
export async function GET() {
  // Opt out of prerendering; the counters are live process state
  await connection();

  if (process.env.NODE_ENV === "production" && process.env.TEST_ENVIRONMENT !== "testing") {
    return new NextResponse(null, { status: 404, statusText: "Not Found" });
  }

  const { queries, dbMs } = getDbStats();
  return NextResponse.json(
    { queries, dbMs },
    { headers: { "Cache-Control": "no-store" } },
  );
}
