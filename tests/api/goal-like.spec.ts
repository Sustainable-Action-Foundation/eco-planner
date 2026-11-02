import type { APIRequestContext } from "playwright/test";
import { expect, test } from "../lib/fixtures";
import { createGoal, createIteration, createRoadmap, deleteRoadmap, flightPayload, orgIdByName, requestAs, Seed } from "../lib/api";
import { memberSlug } from "../../scripts/prisma/seed/places";

/*
 * /api/goal-like: POST likes, DELETE unlikes, both `{ goalId }`, both idempotent,
 * both for signed-in users who can see the goal. POST may carry `aspects` (the
 * kinds of rådighet, `LikeAspect`), which replace the like's set; DELETE drops them. The likes rank goals on the org
 * landing (`/?org=<id>&likes=ORG|AREA|COUNTY`), checked here with one landing read
 * (county scope) on a goal of our own; the ranking logic itself is a page concern.
 */

type LikeBody = { liked: boolean, likeCount: number, aspects: string[], message: string };

async function like(request: APIRequestContext, goalId: string, method: "post" | "delete", expected = 200, aspects?: unknown): Promise<LikeBody> {
  const response = await request[method]("/api/goal-like", { data: aspects === undefined ? { goalId } : { goalId, aspects } });
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
  const anita = await requestAs(playwright, baseURL, Seed.anita.username);
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
  const orgless = await requestAs(playwright, baseURL, Seed.orgless.username);
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
  const maja = await requestAs(playwright, baseURL, memberSlug("Maja Sandberg")); // Bodens kommun (Norrbotten)
  const lars = await requestAs(playwright, baseURL, memberSlug("Lars Niia")); // Kiruna kommun (Norrbotten)
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

test("aspects refine a like: replaced on each POST, kept without, gone with the like", async ({ admin, sandbox }) => {
  const goalId = await createGoal(admin, sandbox.iterationId, { name: `Aspects ${sandbox.label}` });

  // Aspects on a goal not yet liked create the like: an aspect never exists without one
  expect(await like(admin, goalId, "post", 200, ["MARKET_POWER", "OWN_OPERATIONS", "OWN_OPERATIONS"]), "deduplicated, in display order")
    .toMatchObject({ liked: true, likeCount: 1, aspects: ["OWN_OPERATIONS", "MARKET_POWER"] });
  expect(await like(admin, goalId, "post"), "a plain like leaves the aspects as they are").toMatchObject({ likeCount: 1, aspects: ["OWN_OPERATIONS", "MARKET_POWER"] });
  expect(await like(admin, goalId, "post", 200, ["ENABLING"]), "the set is replaced").toMatchObject({ likeCount: 1, aspects: ["ENABLING"] });
  expect(await like(admin, goalId, "post", 200, []), "an empty list clears it, the like stays").toMatchObject({ liked: true, likeCount: 1, aspects: [] });

  await like(admin, goalId, "post", 200, ["INFLUENCE_UPWARD"]);
  expect(await like(admin, goalId, "delete")).toMatchObject({ liked: false, likeCount: 0, aspects: [] });
  expect(await like(admin, goalId, "post"), "a new like starts without the old aspects").toMatchObject({ liked: true, aspects: [] });

  // Unknown aspects and malformed lists are refused, and change nothing
  await like(admin, goalId, "post", 400, ["OWN_OPERATIONS", "NOT_AN_ASPECT"]);
  await like(admin, goalId, "post", 400, ["own_operations"]);
  await like(admin, goalId, "post", 400, "OWN_OPERATIONS");
  await like(admin, goalId, "post", 400, [1]);
  expect(await like(admin, goalId, "post")).toMatchObject({ liked: true, aspects: [] });
  await like(admin, goalId, "delete");
});

test("the landing counts aspects per goal and filters on one", async ({ admin, sandbox, playwright, baseURL }) => {
  const goalId = await createGoal(admin, sandbox.iterationId, { name: `Aspect ranking ${sandbox.label}` });
  const anita = await requestAs(playwright, baseURL, Seed.anita.username);
  try {
    await like(admin, goalId, "post", 200, ["OWN_OPERATIONS", "ENABLING"]);
    await like(anita, goalId, "post", 200, ["ENABLING"]);
    const landing = `/?org=${sandbox.orgId}`;
    const counts = async (url: string) => {
      const payload = await flightPayload(admin, url);
      const index = payload.indexOf(`data-goal-id":"${goalId}"`);
      if (index < 0) return null;
      // The row's aspect chips, up to its like button
      const row = payload.slice(index, payload.indexOf(`"goalId":"${goalId}"`, index));
      return [...row.matchAll(/"data-aspect":"([A-Z_]+)"/g)].map(match => match[1]).join(",");
    };
    await expect.poll(() => counts(landing), { message: "aspect chips on the sandbox org's landing", timeout: 30_000 }).toBe("OWN_OPERATIONS,ENABLING");
    expect(await counts(`${landing}&aspect=enabling`), "filtered on an aspect the goal has").toBe("OWN_OPERATIONS,ENABLING");
    expect(await counts(`${landing}&aspect=INFLUENCE_UPWARD`), "filtered on one it lacks").toBeNull();
  }
  finally {
    await Promise.all([like(admin, goalId, "delete"), like(anita, goalId, "delete")]);
    await anita.dispose();
  }
});
