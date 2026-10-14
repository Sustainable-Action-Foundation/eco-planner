import path from "node:path";
import { cwd } from "node:process";
import { expect, test } from "../lib/fixtures";
import { createGoal, createIteration, createRoadmap, deleteRoadmap } from "../lib/api";
import { useTableView, visible } from "../lib/forms";
import { iterationPath } from "../../src/functions/versionSlug";

/*
 * Tree views: the roadmap version page groups its goals by the branches of
 * their indicator parameters (collapsible, remembered per version), and the
 * start page nests a roadmap under its parent roadmap.
 */

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

test.describe("Tree views", () => {
  test.use({ storageState: adminFile });

  test("Goal tree expands its branches, switches to the table and back", async ({ page, admin, sandbox }) => {
    const branch = `Tree ${sandbox.label}`;
    const leafA = `Leaf A ${sandbox.label}`;
    const leafB = `Leaf B ${sandbox.label}`;
    const single = `Single ${sandbox.label}`;
    await createGoal(admin, sandbox.iterationId, { name: leafA, indicatorParameter: `${branch}\\Inner\\A` });
    await createGoal(admin, sandbox.iterationId, { name: leafB, indicatorParameter: `${branch}\\Inner\\B` });
    await createGoal(admin, sandbox.iterationId, { name: single, indicatorParameter: `Lonely ${sandbox.label}` });

    await page.goto(iterationPath(sandbox.roadmapId, 1));
    await visible(page, 'input[name="table"][value="TREE"]').check();
    const main = visible(page, "main");
    const outer = main.locator("details").filter({ has: page.locator("summary", { hasText: branch }) }).first();
    const inner = outer.locator("details").filter({ has: page.locator("summary", { hasText: "Inner" }) });
    const lonely = main.locator("details").filter({ has: page.locator("summary", { hasText: `Lonely ${sandbox.label}` }) });

    // Collapsed branches hide their leaves; a goal without a path gets a branch of its own parameter
    await expect(outer).toBeVisible();
    await expect(lonely).toBeVisible();
    await expect(main.getByRole("link", { name: leafA })).toBeHidden();
    await outer.locator("> summary").click();
    await expect(inner).toBeVisible();
    await expect(main.getByRole("link", { name: leafA })).toBeHidden();
    await inner.locator("> summary").click();
    await expect(main.getByRole("link", { name: leafA })).toBeVisible();
    await expect(main.getByRole("link", { name: leafB })).toBeVisible();
    await lonely.locator("> summary").click();
    await expect(main.getByRole("link", { name: single })).toBeVisible();

    // The table lists every goal regardless of branches
    await useTableView(page);
    const table = visible(page, "#goalTable");
    await expect(table.getByRole("link", { name: leafA })).toBeVisible();
    await expect(table.getByRole("link", { name: leafB })).toBeVisible();
    await expect(table.getByRole("link", { name: single })).toBeVisible();
    await expect(main.locator("details").filter({ has: page.locator("summary", { hasText: branch }) })).toHaveCount(0);

    // Back in the tree the opened branches are remembered for this version
    await visible(page, 'input[name="table"][value="TREE"]').check();
    await expect(main.getByRole("link", { name: leafA })).toBeVisible();
    await expect(main.getByRole("link", { name: single })).toBeVisible();

    // A leaf links to its goal
    await main.getByRole("link", { name: leafA }).click();
    await page.waitForURL(/\/goal\/[0-9a-f-]{36}$/);
    await expect(visible(page, "h1").filter({ hasText: leafA })).toBeVisible({ timeout: 20_000 });
  });

  test("A child roadmap nests under its parent on the start page", async ({ page, admin, sandbox }) => {
    test.slow();
    const childName = `Child ${sandbox.label}`;
    const childId = await createRoadmap(admin, sandbox.orgId, { name: childName, parentRoadmapId: sandbox.roadmapId });
    try {
      await createIteration(admin, childId);

      const tree = visible(page, "main nav");
      const parentNode = tree.locator("li").filter({ has: page.locator("> details > summary", { hasText: `Sandbox ${sandbox.label}` }) }).first();
      // Another worker's delete may leave the landing stale for one render (deletes revalidate with `max`)
      await expect(async () => {
        await page.goto(`/?org=${sandbox.orgId}`);
        await expect(parentNode).toBeVisible({ timeout: 20_000 });
      }).toPass({ timeout: 120_000 });
      const childLink = parentNode.getByTestId("roadmap-tree-version").filter({ hasText: childName });

      // The child is a nested row, hidden until the parent is expanded, and not a top-level row
      await expect(childLink).toBeHidden();
      await expect(tree.locator("> ul > li").filter({ hasText: childName }).filter({ hasNot: page.locator("details") })).toHaveCount(0);
      // The summary row is mostly the parent's own link; toggle on the caret
      await parentNode.locator("> details > summary svg").first().click();
      await expect(childLink).toBeVisible();
      await expect(childLink).toHaveAttribute("href", iterationPath(childId, 1));
      await childLink.click();
      await page.waitForURL(new RegExp(`${iterationPath(childId, 1)}$`));
      await expect(visible(page, "h1").filter({ hasText: childName })).toBeVisible({ timeout: 20_000 });
    }
    finally {
      await deleteRoadmap(admin, childId);
    }
  });
});
