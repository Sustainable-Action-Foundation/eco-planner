import path from "node:path";
import { cwd } from "node:process";
import type { Page, Request } from "playwright/test";
import { expect, test } from "../lib/fixtures";
import { deleteRoadmap, Seed, uniqueLabel } from "../lib/api";
import { visible } from "../lib/forms";

/*
 * One test per toast kind, each on the form that produces it. Toast headings
 * and the client-side messages are translated in the browser, so under cimode
 * they are stable keys. Whatever a test creates it deletes again.
 */

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

type ToastKind = "success" | "warning" | "error";

/** A toast of the kind (errors are alerts, the others statuses), by its translated heading */
function toast(page: Page, kind: ToastKind) {
  return page.getByTestId("toast-list").locator(`dialog[role="${kind === "error" ? "alert" : "status"}"]`).filter({ hasText: `toasts.${kind}` });
}

/** Records the requests a page sends to an API route with a method */
function recordRequests(page: Page, apiPath: string, method: string): Request[] {
  const requests: Request[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname === apiPath && request.method() === method) requests.push(request);
  });
  return requests;
}

/** Fills the roadmap create form's required inputs except the description */
async function fillRoadmapBasics(page: Page, name: string) {
  await page.goto("/roadmap/create");
  await visible(page, "#name").fill(name);
  await visible(page, "#type").selectOption("LOCAL");
  await visible(page, "#actor").fill(name);
  await visible(page, "#org").selectOption({ label: Seed.orgName });
}

test.describe("Toasts", () => {
  test.use({ storageState: adminFile });

  test("success: creating a roadmap", async ({ page, admin }, testInfo) => {
    const label = uniqueLabel(testInfo);
    await fillRoadmapBasics(page, `Toast roadmap ${label}`);
    await visible(page, ".tiptap").first().fill(`Description ${label}`);

    const [response] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === "/api/roadmap" && response.request().method() === "POST"),
      visible(page, "#submit-button").click(),
    ]);
    expect(response.status()).toBe(201);
    const { id } = await response.json() as { id: string };
    try {
      await expect(toast(page, "success")).toBeVisible();
      // The success path moves on to the new roadmap's first version
      await expect(page).toHaveURL(`/roadmap/${id}/iteration/create`, { timeout: 30_000 });
    }
    finally {
      await deleteRoadmap(admin, id);
    }
  });

  test("warning: a roadmap without a description is held back", async ({ page }, testInfo) => {
    const posts = recordRequests(page, "/api/roadmap", "POST");
    await fillRoadmapBasics(page, `Toast roadmap ${uniqueLabel(testInfo)}`);

    // The description lives in a hidden input, so the form's own handler catches it, not native validation
    await visible(page, "#submit-button").click();
    await expect(toast(page, "warning")).toBeVisible();
    await expect(toast(page, "warning")).toContainText("roadmap.description_required");
    await expect(page).toHaveURL("/roadmap/create");
    expect(posts).toEqual([]);
  });

  test("error: a goal year without a value is refused before sending", async ({ page, sandbox }) => {
    const posts = recordRequests(page, "/api/goal", "POST");
    await page.goto(`/goal/create?iterationId=${sandbox.iterationId}`);
    await visible(page, 'input[name="DATA_SERIES_TYPE"][value="MANUAL"]').check();
    await visible(page, "#indicatorParameter").fill(`Toast\\${sandbox.label}`);
    await visible(page, "#indicatorParameter").blur();

    // A year without a value passes native validation but makes no usable series
    const year = visible(page, '#goal-dataseries [data-row="0"][data-column="1"] input');
    await year.focus();
    await year.fill("2020");
    await visible(page, "#submit-button").click();

    await expect(toast(page, "error")).toBeVisible();
    await expect(toast(page, "error")).toContainText("goal.errors.");
    // The submit button comes back for another try, and nothing was sent
    await expect(visible(page, "#submit-button")).toBeEnabled();
    expect(posts).toEqual([]);
  });
});
