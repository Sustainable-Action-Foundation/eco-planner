import type { APIRequestContext } from "playwright/test";
import { expect, test } from "../lib/fixtures";
import { createGoal, createIteration, createRoadmap, deleteRoadmap, flightPayload, orgIdByName, requestAs, Seed } from "../lib/api";
import { memberSlug } from "../../scripts/prisma/seed/places";

/*
 * /api/goal-like: POST likes, DELETE unlikes, both `{ goalId }`, both idempotent,
 * both for signed-in users who can see the goal. The likes rank goals on the org
 * landing (`/?org=<id>&likes=ORG|AREA|COUNTY`), checked here with one landing read
 * (county scope) on a goal of our own; the ranking logic itself is a page concern.
 */

type LikeBody = { liked: boolean, likeCount: number, message: string };

async function like(request: APIRequestContext, goalId: string, method: "post" | "delete", expected = 200): Promise<LikeBody> {
  const response = await request[method]("/api/goal-like", { data: { goalId } });
  expect(response.status(), `${method.toUpperCase()} /api/goal-like -> ${await response.text()}`).toBe(expected);
  return await response.json() as LikeBody;
}

/**
 * The like count the landing at `url` shows for the goal (the props of its
 * `LikeGoalButton` in the RSC payload), or null when the goal is not listed.
 */
async function landingLikeCount(request: APIRequestContext, url: string, goalId: string): Promise<number | null> {
  const payload = await flightPayload(request, url);
  const match = payload.match(new RegExp(`"goalId":"${goalId}","liked":(?:true|false),"likeCount":(\\d+)`));
  return match ? Number(match[1]) : null;
}

test("liking and unliking are idempotent and report the count", async ({ admin, sandbox, playwright, baseURL }) => {
  const goalId = await createGoal(admin, sandbox.iterationId, { name: `Liked ${sandbox.label}` });
  const anita = await requestAs(playwright, baseURL, Seed.anita.username, Seed.anita.password);
  try {
    expect(await like(anita, goalId, "post")).toMatchObject({ liked: true, likeCount: 1 });
    expect(await like(anita, goalId, "post"), "a second like does not double count").toMatchObject({ liked: true, likeCount: 1 });
    expect(await like(admin, goalId, "post"), "another user's like adds up").toMatchObject({ liked: true, likeCount: 2 });
    expect(await like(anita, goalId, "delete")).toMatchObject({ liked: false, likeCount: 1 });
    expect(await like(anita, goalId, "delete"), "unliking twice is fine").toMatchObject({ liked: false, likeCount: 1 });
    expect(await like(admin, goalId, "delete")).toMatchObject({ liked: false, likeCount: 0 });
  }
  finally {
    await anita.dispose();
  }
});

test("a like needs a session, a body and a visible goal", async ({ admin, sandbox, playwright, baseURL }) => {
  const goalId = await createGoal(admin, sandbox.iterationId, { name: `Unlikeable ${sandbox.label}` });
  const anonymous = await requestAs(playwright, baseURL);
  const orgless = await requestAs(playwright, baseURL, Seed.orgless.username, Seed.orgless.password);
  try {
    for (const method of ["post", "delete"] as const) {
      const response = await anonymous[method]("/api/goal-like", { data: { goalId } });
      expect(response.status(), `anonymous ${method}: ${await response.text()}`).toBe(401);
      expect(response.headers()["location"]).toBe("/login");
    }
    for (const data of [{}, { goalId: "" }, { goalId: 1 }, [], "nope"]) {
      const response = await admin.post("/api/goal-like", { data });
      expect(response.status(), `${JSON.stringify(data)} -> ${await response.text()}`).toBe(400);
    }
    await like(admin, "00000000-0000-0000-0000-000000000000", "post", 404);
    // The sandbox roadmap is ORG-shared: a user outside the org cannot see, hence not like, the goal
    await like(orgless, goalId, "post", 404);
    await like(orgless, goalId, "delete", 404);
  }
  finally {
    await Promise.all([anonymous.dispose(), orgless.dispose()]);
  }
});

test("the org landing counts likes in the org's county", async ({ admin, sandbox, playwright, baseURL }) => {
  // A public goal so members of the place orgs can see it
  const roadmapId = await createRoadmap(admin, sandbox.orgId, { name: `Public ${sandbox.label}`, access: { sharing: "PUBLIC", grants: [] } });
  const maja = await requestAs(playwright, baseURL, memberSlug("Maja Sandberg"), Seed.memberPassword); // Bodens kommun (Norrbotten)
  const lars = await requestAs(playwright, baseURL, memberSlug("Lars Niia"), Seed.memberPassword); // Kiruna kommun (Norrbotten)
  try {
    const iterationId = await createIteration(admin, roadmapId);
    const goalId = await createGoal(admin, iterationId, { name: `Scoped ${sandbox.label}` });
    const bodenId = await orgIdByName(maja, "Bodens kommun");

    await like(lars, goalId, "post");
    await like(maja, goalId, "post");
    // Both likes come from orgs placed in Norrbotten, so the county list counts both.
    // Polled: the first landing read after the likes was observed to still serve the cached list
    await expect.poll(() => landingLikeCount(maja, `/?org=${bodenId}&likes=county`, goalId), { message: "county like count on Boden's landing", timeout: 30_000 }).toBe(2);
  }
  finally {
    await Promise.all([maja.dispose(), lars.dispose()]);
    // Cascades the goal and its likes
    await deleteRoadmap(admin, roadmapId);
  }
});
