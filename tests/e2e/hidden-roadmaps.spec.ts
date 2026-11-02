import path from "node:path";
import { cwd } from "node:process";
import { expect, test } from "../lib/fixtures";
import { visible } from "../lib/forms";

/*
 * Hiding a roadmap from its menu on the org landing: it leaves the list, its
 * page says it is hidden, and "show hidden" brings it back for its editors.
 */

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

test.describe("Hidden roadmaps", () => {
  test.use({ storageState: adminFile });

  test("hide from the landing menu, gone from the list, badge on the page, back with show hidden", async ({ page, sandbox }) => {
    test.slow();
    const name = `Sandbox ${sandbox.label}`;
    const landing = `/?org=${sandbox.orgId}`;
    const tree = visible(page, "main nav");
    const row = tree.locator("li").filter({ has: page.getByRole("link", { name }) }).first();

    // Another worker's write may leave the landing stale for one render
    await expect(async () => {
      await page.goto(landing);
      await expect(row).toBeVisible({ timeout: 20_000 });
    }).toPass({ timeout: 120_000 });

    // The row's menu offers hiding (managers only) and the sharing settings
    await row.getByTestId("controls-menu-button").click();
    const menu = row.locator("dialog[open]");
    await expect(menu.getByTestId("roadmap-sharing-link")).toHaveAttribute("href", `/roadmap/${sandbox.roadmapId}/edit#sharing`);
    await menu.getByTestId("hide-roadmap").click();
    await visible(page, "dialog[open]").getByTestId("hide-roadmap-confirm").click();

    // Gone from the list
    await expect(async () => {
      await page.goto(landing);
      await expect(visible(page, "main nav").first()).toBeAttached({ timeout: 20_000 });
      await expect(row).toHaveCount(0, { timeout: 5_000 });
    }).toPass({ timeout: 120_000 });

    // Still reachable, and marked hidden
    await page.goto(`/roadmap/${sandbox.roadmapId}`);
    await expect(visible(page, "h1").filter({ hasText: name })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("visibility-badge-hidden").filter({ visible: true })).toBeVisible();
    await expect(page.getByTestId("show-roadmap").filter({ visible: true })).toBeVisible();

    // "Show hidden" on the landing brings it back, badge included
    await page.goto(landing);
    await page.getByTestId("show-hidden-roadmaps").filter({ visible: true }).click();
    await page.waitForURL(/showHidden=true/);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.getByTestId("visibility-badge-hidden")).toBeVisible();

    // And showing it again from the roadmap page puts it back for good
    await page.goto(`/roadmap/${sandbox.roadmapId}`);
    await page.getByTestId("show-roadmap").filter({ visible: true }).click();
    await visible(page, "dialog[open]").getByTestId("hide-roadmap-confirm").click();
    await expect(page.getByTestId("hide-roadmap").filter({ visible: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("visibility-badge-hidden").filter({ visible: true })).toHaveCount(0);
  });
});
