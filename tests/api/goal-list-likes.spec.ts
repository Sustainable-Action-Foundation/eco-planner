import type { APIRequestContext } from "playwright/test";
import { expect, test } from "../lib/fixtures";
import { createGoal, createIteration, createRoadmap, deleteRoadmap, flightObjectAt, flightPayload, orgIdByName, requestAs, Seed } from "../lib/api";
import { memberSlug } from "../../scripts/prisma/seed/places";
import { iterationPath } from "../../src/functions/versionSlug";

/*
 * `?likes=` on a roadmap version page (`/roadmap/<id>/v<n>?likes=mine|org|area|county|all`)
 * narrows its goal list to liked goals. Whose likes a viewer may count follows
 * what they can see elsewhere: their own and everyone's when signed in, and
 * the scopes of an org they belong to (its members, its area, its county), as
 * on that org's landing page. Read here off the props the page hands its goal
 * list.
 */

type Likes = {
  active: string | null,
  options: { filter: string, name: string | null, href: string }[],
  counts: Record<string, number>,
  onHref: string,
  offHref: string,
};

/** The `likes` prop of the page's goal list; null when the page hands none (anonymous visitors) */
async function goalListLikes(request: APIRequestContext, url: string): Promise<Likes | null> {
  const payload = await flightPayload(request, url);
  const marker = '"likes":{"active":';
  const at = payload.indexOf(marker);
  if (at < 0) return null;
  const json = flightObjectAt(payload, at + '"likes":'.length);
  return json ? JSON.parse(json) as Likes : null;
}

test("whose likes count follows what the viewer may see elsewhere", async ({ admin, sandbox, playwright, baseURL }) => {
  test.slow();
  // A public roadmap so members of the place orgs can see its goals
  const roadmapId = await createRoadmap(admin, sandbox.orgId, { name: `Liked list ${sandbox.label}`, access: { sharing: "PUBLIC", grants: [] } });
  const anonymous = await requestAs(playwright, baseURL);
  const maja = await requestAs(playwright, baseURL, memberSlug("Maja Sandberg")); // Bodens kommun
  const nils = await requestAs(playwright, baseURL, memberSlug("Nils Forsberg")); // Bodens kommun
  const lars = await requestAs(playwright, baseURL, memberSlug("Lars Niia")); // Kiruna kommun, same county
  const anita = await requestAs(playwright, baseURL, Seed.anita.username); // Sustainable Action, no area
  const orgless = await requestAs(playwright, baseURL, Seed.orgless.username);
  const like = async (request: APIRequestContext, goalId: string) => {
    const response = await request.post("/api/goal-like", { data: { goalId } });
    expect(response.status(), await response.text()).toBe(200);
  };
  try {
    const iterationId = await createIteration(admin, roadmapId);
    const shared = await createGoal(admin, iterationId, { name: `Shared ${sandbox.label}` });
    const kirunaOnly = await createGoal(admin, iterationId, { name: `Kiruna ${sandbox.label}` });
    const unlisted = await createGoal(admin, iterationId, { name: `Unlisted ${sandbox.label}`, listing: "UNLISTED" });
    await createGoal(admin, iterationId, { name: `Nobody ${sandbox.label}` });
    await like(maja, shared);
    await like(maja, unlisted);
    await like(nils, shared);
    await like(lars, shared);
    await like(lars, kirunaOnly);
    await like(anita, shared);

    const path = iterationPath(roadmapId, 1);
    const counts = async (request: APIRequestContext, query: string) => (await goalListLikes(request, `${path}${query}`))?.counts;

    // A member of an org placed in a municipality: her own, the org, the municipality, the county, everyone
    await expect.poll(() => counts(maja, "?likes=org"), { message: "the org's likes", timeout: 30_000 }).toEqual({ [shared]: 2 });
    const org = await goalListLikes(maja, `${path}?likes=org`);
    expect(org?.active).toBe("ORG");
    expect(org?.options.map(option => option.filter)).toEqual(["MINE", "ORG", "AREA", "COUNTY", "ALL"]);
    expect(org?.options.map(option => option.name)).toEqual([null, "Bodens kommun", "Boden", "Norrbottens län", null]);
    expect(org?.options.map(option => option.href)).toEqual(["mine", "org", "area", "county", "all"].map(scope => `${path}?likes=${scope}`));
    expect(org?.offHref).toBe(path);
    expect(await counts(maja, "?likes=mine"), "an unlisted goal she can't see in the list isn't counted").toEqual({ [shared]: 1 });
    expect(await counts(maja, "?likes=area")).toEqual({ [shared]: 2 });
    expect(await counts(maja, "?likes=county"), "the county pools Kiruna's likes").toEqual({ [shared]: 3, [kirunaOnly]: 1 });
    expect(await counts(maja, "?likes=all")).toEqual({ [shared]: 4, [kirunaOnly]: 1 });
    expect(await counts(maja, "?likes=COUNTY"), "any case").toEqual({ [shared]: 3, [kirunaOnly]: 1 });

    // Without the param nothing is filtered or counted, and the way in is the viewer's default
    const off = await goalListLikes(maja, path);
    expect(off).toEqual({ active: null, options: [], counts: {}, onHref: `${path}?likes=org`, offHref: path });

    // ?org= picks among the viewer's own orgs only
    const foreign = await goalListLikes(maja, `${path}?likes=org&org=${sandbox.orgId}`);
    expect(foreign?.options.find(option => option.filter === "ORG")?.name, "an org she is not in is ignored").toBe("Bodens kommun");
    expect(foreign?.counts).toEqual({ [shared]: 2 });
    expect(foreign?.options.find(option => option.filter === "AREA")?.href, "the links keep the page's other params").toBe(`${path}?org=${sandbox.orgId}&likes=area`);

    // An org without an area has no area scopes; asking for one falls back to the org
    const unplaced = await goalListLikes(anita, `${path}?likes=county`);
    expect(unplaced?.active).toBe("ORG");
    expect(unplaced?.options.map(option => option.filter)).toEqual(["MINE", "ORG", "ALL"]);
    expect(unplaced?.counts).toEqual({ [shared]: 1 });

    // No org: no org scopes, and everyone's likes by default
    const alone = await goalListLikes(orgless, `${path}?likes=org`);
    expect(alone?.active).toBe("ALL");
    expect(alone?.options.map(option => option.filter)).toEqual(["MINE", "ALL"]);
    expect(alone?.counts).toEqual({ [shared]: 4, [kirunaOnly]: 1 });
    expect((await goalListLikes(orgless, path))?.onHref).toBe(`${path}?likes=all`);
    expect(await counts(orgless, "?likes=mine")).toEqual({});

    // An editor has the unlisted goal in the list, and its likes with it
    expect(await counts(admin, "?likes=all")).toEqual({ [shared]: 4, [kirunaOnly]: 1, [unlisted]: 1 });
    // The super admin may look from any org, as on the start page
    const bodenId = await orgIdByName(maja, "Bodens kommun");
    expect(await counts(admin, `?likes=org&org=${bodenId}`)).toEqual({ [shared]: 2, [unlisted]: 1 });

    // Anonymous visitors are shown no likes: no filter, a note instead
    const payload = await flightPayload(anonymous, `${path}?likes=all`);
    expect(payload).not.toContain('"likes":{"active":');
    expect(payload).not.toContain(`"${shared}":4`);
    expect(payload).toContain("liked-goals-login");
    expect(await flightPayload(anonymous, path), "no note without the param").not.toContain("liked-goals-login");
  }
  finally {
    await Promise.all([anonymous.dispose(), maja.dispose(), nils.dispose(), lars.dispose(), anita.dispose(), orgless.dispose()]);
    // Cascades the goals and their likes
    await deleteRoadmap(admin, roadmapId);
  }
});
