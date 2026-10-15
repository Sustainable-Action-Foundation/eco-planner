import { connection } from "next/server";
import type { NextRequest } from "next/server";
import { testOutbox } from "@/mailClient";
import { normalizeEmail } from "@/functions/email";

/**
 * Test-only: the last mail the stubbed mail client "sent" to `?email=`, so the
 * suite can follow login links, whose tokens are random and hashed at rest (unlike
 * the recomputable verify/reset hashes behind /api/test/mail-token). Exists only
 * under TEST_ENVIRONMENT=testing; everywhere else every request is a 404.
 */
export async function GET(request: NextRequest) {
  // Without this the env check below finishes before any request data is read, so with
  // Cache Components `next build` prerenders the handler and bakes the 404 in
  await connection();
  if (process.env.TEST_ENVIRONMENT !== "testing") {
    return Response.json({ message: "Not found" }, { status: 404 });
  }

  const email = normalizeEmail(request.nextUrl.searchParams.get("email") ?? "");
  if (!email) {
    return Response.json({ message: "email is required" }, { status: 400 });
  }

  const mail = testOutbox.get(email);
  if (!mail) {
    return Response.json({ message: "No mail for this address" }, { status: 404 });
  }
  return Response.json(mail, { status: 200 });
}
