import getUserHash from "@/functions/getUserHash";
import type { NextRequest } from "next/server";

/**
 * Test-only: the token the verification and password-reset mails would carry
 * for `?email=`, so the suite can complete those flows without outbound mail
 * (see the stub in `@/mailClient`). Exists only under TEST_ENVIRONMENT=testing;
 * everywhere else every request is a 404.
 */
export async function GET(request: NextRequest) {
  if (process.env.TEST_ENVIRONMENT !== "testing") {
    return Response.json({ message: "Not found" }, { status: 404 });
  }

  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return Response.json({ message: "email is required" }, { status: 400 });
  }

  const hash = await getUserHash(email).catch(() => null);
  if (!hash) {
    return Response.json({ message: "No such user" }, { status: 404 });
  }

  return Response.json({ email, hash }, { status: 200 });
}
