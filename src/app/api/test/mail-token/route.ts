import getUserHash from "@/functions/getUserHash";
import { connection } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Test-only: the token the verification and password-reset mails would carry
 * for `?email=`, so the suite can complete those flows without outbound mail
 * (see the stub in `@/mailClient`). Exists only under TEST_ENVIRONMENT=testing;
 * everywhere else every request is a 404.
 */
export async function GET(request: NextRequest) {
  // Without this the env check below finishes before any request data is read, so with
  // Cache Components `next build` prerenders the handler: the image is built without
  // TEST_ENVIRONMENT, and the 404 would be baked in for the test stack too
  await connection();
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
