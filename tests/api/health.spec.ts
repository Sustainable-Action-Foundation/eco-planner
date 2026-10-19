import { expect, test } from "playwright/test";

/*
 * /api/health: the container probe. 200 with the deployed commit's sha
 * (COMMIT_SHA) or a 500 without one; the test stack sets it, so a 500 here
 * means the build lost the env var.
 */
test("GET /api/health answers 200 with the commit sha", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json() as { sha?: unknown };
  expect(typeof body.sha, "sha").toBe("string");
  expect(body.sha as string).not.toBe("");
});

test("the probe needs no session and ignores methods it does not implement", async ({ request }) => {
  const response = await request.post("/api/health");
  expect(response.status()).toBe(405);
});
