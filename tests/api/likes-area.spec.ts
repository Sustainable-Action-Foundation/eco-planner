import type { APIRequestContext } from "playwright/test";
import { expect, test } from "../lib/fixtures";
import { createGoal, createIteration, createRoadmap, deleteRoadmap, flightPayload, pageStatus, requestAs, Seed } from "../lib/api";
import { memberSlug } from "../../scripts/prisma/seed/places";

/*
 * /likes/<areaCode>: the likes overview of a municipality or county, pooling the
 * likes of every org placed there (a county includes its municipalities). Only
 * signed-in members of one of those orgs, and super admins, may open it.
 */

const boden = "2582";
const kiruna = "2584";
const norrbotten = "25";

test("the area overview is for members of the area's orgs", async ({ admin, playwright, baseURL }) => {
  const anonymous = await requestAs(playwright, baseURL);
  const maja = await requestAs(playwright, baseURL, memberSlug("Maja Sandberg")); // Bodens kommun
  const oskar = await requestAs(playwright, baseURL, memberSlug("Oskar Åkesson")); // Malmö stad
  const anita = await requestAs(playwright, baseURL, Seed.anita.username); // Sustainable Action, no area
  try {
    const login = await anonymous.get(`/likes/${boden}`, { maxRedirects: 0 });
    expect(login.status(), "anonymous visitors are sent to the login").toBe(307);
    expect(login.headers()["location"]).toContain(`/login?from=%2Flikes%2F${boden}`);

    expect(await pageStatus(maja, `/likes/${boden}`), "her own municipality").toBe(200);
    expect(await pageStatus(maja, `/likes/${norrbotten}`), "the county her municipality is in").toBe(200);
    expect(await pageStatus(maja, `/likes/${kiruna}`), "another municipality of the county").toBe(404);
    expect(await pageStatus(oskar, `/likes/${boden}`), "a member of an org elsewhere").toBe(404);
    expect(await pageStatus(oskar, `/likes/${norrbotten}`)).toBe(404);
    expect(await pageStatus(anita, `/likes/${boden}`), "a member of an org without an area").toBe(404);

    expect(await pageStatus(admin, `/likes/${kiruna}`), "super admins see every area").toBe(200);
    expect(await pageStatus(admin, "/likes/00"), "the nation has no overview").toBe(404);
    expect(await pageStatus(admin, "/likes/nope"), "unknown codes").toBe(404);
  }
  finally {
    await Promise.all([anonymous.dispose(), maja.dispose(), oskar.dispose(), anita.dispose()]);
  }
});

test("the county overview pools its municipalities' likes", async ({ admin, sandbox, playwright, baseURL }) => {
  // A public goal so members of the place orgs can see it
  const roadmapId = await createRoadmap(admin, sandbox.orgId, { name: `Area overview ${sandbox.label}`, access: { sharing: "PUBLIC", grants: [] } });
  const maja = await requestAs(playwright, baseURL, memberSlug("Maja Sandberg")); // Bodens kommun
  const lars = await requestAs(playwright, baseURL, memberSlug("Lars Niia")); // Kiruna kommun
  const like = async (request: APIRequestContext, goalId: string, aspects: string[]) => {
    const response = await request.post("/api/goal-like", { data: { goalId, aspects } });
    expect(response.status(), await response.text()).toBe(200);
  };
  /** The like count of the goal's row on the page, or null when the goal isn't listed */
  const likeCount = async (request: APIRequestContext, url: string, goalId: string) => {
    const match = (await flightPayload(request, url)).match(new RegExp(`"goalId":"${goalId}","liked":(?:true|false),"likeCount":(\\d+)`));
    return match ? Number(match[1]) : null;
  };
  try {
    const goalId = await createGoal(admin, await createIteration(admin, roadmapId), { name: `Pooled ${sandbox.label}` });
    await like(maja, goalId, ["OWN_OPERATIONS"]);
    await like(lars, goalId, ["OWN_OPERATIONS", "ENABLING"]);

    await expect.poll(() => likeCount(maja, `/likes/${norrbotten}`, goalId), { message: "both likes on the county overview", timeout: 30_000 }).toBe(2);
    expect(await likeCount(maja, `/likes/${boden}`, goalId), "only Boden's on Boden's").toBe(1);
    expect(await likeCount(maja, `/likes/${norrbotten}?aspect=ENABLING`, goalId), "kept when filtered on an aspect a like names").toBe(2);
    expect(await likeCount(maja, `/likes/${boden}?aspect=ENABLING`, goalId), "dropped when no like in scope names it").toBeNull();
  }
  finally {
    await Promise.all([maja.dispose(), lars.dispose()]);
    // Cascades the goal and its likes
    await deleteRoadmap(admin, roadmapId);
  }
});
