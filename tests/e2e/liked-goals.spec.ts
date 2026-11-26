import type { APIRequestContext } from "playwright/test";
import { expect, test } from "../lib/fixtures";
import { createGoal, createIteration, createRoadmap, deleteRoadmap, memberContext, requestAs } from "../lib/api";
import { useTableView, visible } from "../lib/forms";
import { memberSlug } from "../../scripts/prisma/seed/places";
import { iterationPath } from "../../src/functions/versionSlug";

/*
 * "Show only liked goals" on a roadmap version: the goal tree keeps its
 * branches but only for goals someone in scope liked, each with its like
 * count; the scope (my own, my org, its area, its county, everyone) and the
 * filter itself live in `?likes=`, so the filtered tree can be linked.
 */

test("the goal tree narrows to liked goals, per scope, and the address carries it", async ({ browser, admin, sandbox, playwright, baseURL }) => {
  test.slow();
  const likedBranch = `Liked ${sandbox.label}`;
  const emptyBranch = `Empty ${sandbox.label}`;
  const countyBranch = `County ${sandbox.label}`;
  const leafA = `Leaf A ${sandbox.label}`;
  const leafB = `Leaf B ${sandbox.label}`;
  const leafC = `Leaf C ${sandbox.label}`;
  const unliked = `Unliked ${sandbox.label}`;

  // A public roadmap so members of the place orgs can see its goals
  const roadmapId = await createRoadmap(admin, sandbox.orgId, { name: `Liked tree ${sandbox.label}`, access: { sharing: "PUBLIC", grants: [] } });
  const nils = await requestAs(playwright, baseURL, memberSlug("Nils Forsberg")); // Bodens kommun
  const lars = await requestAs(playwright, baseURL, memberSlug("Lars Niia")); // Kiruna kommun, same county
  const context = await memberContext(browser, "Maja Sandberg"); // Bodens kommun
  const like = async (request: APIRequestContext, goalId: string) => {
    const response = await request.post("/api/goal-like", { data: { goalId } });
    expect(response.status(), await response.text()).toBe(200);
  };
  try {
    const iterationId = await createIteration(admin, roadmapId);
    const goalA = await createGoal(admin, iterationId, { name: leafA, indicatorParameter: `${likedBranch}\\Inner\\A` });
    await createGoal(admin, iterationId, { name: leafB, indicatorParameter: `${likedBranch}\\Inner\\B` });
    const goalC = await createGoal(admin, iterationId, { name: leafC, indicatorParameter: `${countyBranch}\\C` });
    await createGoal(admin, iterationId, { name: unliked, indicatorParameter: `${emptyBranch}\\X` });
    await like(context.request, goalA);
    await like(nils, goalA);
    await like(lars, goalA);
    await like(lars, goalC);

    const page = await context.newPage();
    const path = iterationPath(roadmapId, 1);
    const main = visible(page, "main");
    const toggle = main.getByTestId("liked-only-toggle");
    const scopes = main.getByTestId("liked-goals-scope");
    const currentScope = scopes.locator('[aria-current="true"]');
    const branch = (name: string) => main.locator("details").filter({ has: page.locator("> summary", { hasText: name }) });
    const leaf = (name: string) => main.getByRole("link", { name });
    const likeCount = (name: string) => leaf(name).getByTestId("goal-like-count");
    const filteredOn = (scope: string | null) => page.waitForURL(url => url.pathname === path && url.searchParams.get("likes") === scope);

    // The whole tree: every branch, collapsed, and no scope to choose
    await page.goto(path);
    await visible(page, 'input[name="table"][value="TREE"]').check();
    await expect(branch(likedBranch)).toBeVisible();
    await expect(branch(emptyBranch)).toBeVisible();
    await expect(branch(countyBranch)).toBeVisible();
    await expect(leaf(leafA)).toBeHidden();
    await expect(toggle).not.toBeChecked();
    await expect(scopes).toHaveCount(0);

    // Only liked: the org's likes by default. The liked goal shows with its count in its branches,
    // opened; its unliked sibling and the branches without a liked goal are gone
    await toggle.check();
    await filteredOn("org");
    await expect(currentScope).toHaveAttribute("data-scope", "ORG");
    await expect(leaf(leafA)).toBeVisible();
    await expect(likeCount(leafA)).toHaveText("2");
    await expect(branch(likedBranch).first().getByTestId("branch-liked-count").first()).toHaveText("1");
    await expect(leaf(leafB)).toHaveCount(0);
    await expect(branch(emptyBranch)).toHaveCount(0);
    await expect(branch(countyBranch)).toHaveCount(0);

    // The search keeps working inside the selection, and survives a change of scope
    const search = main.locator('input[type="search"]');
    await search.fill("no such goal");
    await expect(leaf(leafA)).toHaveCount(0);
    await search.fill(leafA);
    await expect(leaf(leafA)).toBeVisible();

    // The county pools Kiruna's likes: one more on the shared goal, and Kiruna's own goal appears
    await scopes.locator('[data-scope="COUNTY"]').click();
    await filteredOn("county");
    await expect(currentScope).toHaveAttribute("data-scope", "COUNTY");
    await expect(likeCount(leafA)).toHaveText("3");
    await expect(search).toHaveValue(leafA);
    await search.fill("");
    await expect(likeCount(leafC)).toHaveText("1");
    await expect(branch(emptyBranch)).toHaveCount(0);

    // My own likes
    await scopes.locator('[data-scope="MINE"]').click();
    await filteredOn("mine");
    await expect(likeCount(leafA)).toHaveText("1");
    await expect(leaf(leafC)).toHaveCount(0);

    // The address is the state: a link to a scope opens the tree filtered on it, and a reload keeps it
    await page.goto(`${path}?likes=area`);
    await expect(toggle).toBeChecked();
    await expect(currentScope).toHaveAttribute("data-scope", "AREA");
    await expect(likeCount(leafA)).toHaveText("2");
    await expect(leaf(leafC)).toHaveCount(0);
    await page.reload();
    await expect(toggle).toBeChecked();
    await expect(likeCount(leafA)).toHaveText("2");

    // The table lists the same selection, with the likes in a column
    await useTableView(page);
    const table = visible(page, "#goalTable");
    await expect(table.getByRole("link", { name: leafA })).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(table.getByTestId("goal-like-count")).toHaveText("2");
    await visible(page, 'input[name="table"][value="TREE"]').check();

    // Away to the goal and back: the kept copy of the page still shows what its address says
    await leaf(leafA).click();
    await page.waitForURL(/\/goal\/[0-9a-f-]{36}$/);
    await page.goBack();
    await filteredOn("area");
    await expect(toggle).toBeChecked();
    await expect(likeCount(leafA)).toHaveText("2");

    // Off again: the whole tree, collapsed as it was left
    await toggle.uncheck();
    await filteredOn(null);
    await expect(scopes).toHaveCount(0);
    await expect(branch(emptyBranch)).toBeVisible();
    await expect(branch(countyBranch)).toBeVisible();
    await expect(leaf(leafA)).toBeHidden();
  }
  finally {
    await Promise.all([nils.dispose(), lars.dispose(), context.close()]);
    // Cascades the goals and their likes
    await deleteRoadmap(admin, roadmapId);
  }
});
