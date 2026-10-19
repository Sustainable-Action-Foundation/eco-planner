import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";
import { expect, test } from "../lib/fixtures";
import { createGoal, createIteration, createRoadmap, deleteRoadmap } from "../lib/api";
import { openCreate, pickIterationInActionForm, reloadUntil, submitForm, visible } from "../lib/forms";

/*
 * Documents in the browser: the attachments section of an object page (upload,
 * download link, remove with a confirm) as an editor and as an anonymous visitor,
 * and the file picker of the create forms, whose files are sent once the object
 * exists. The stack under test has a bucket (see docker/compose.testing.yaml).
 */

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

/** The attachments section of the page that is actually shown (hidden routes stay mounted) */
function section(page: Page) {
  return page.getByTestId("attachments").filter({ visible: true });
}

function rows(page: Page) {
  return section(page).getByTestId("attachment-row");
}

/** A small text file for the file inputs */
function textFile(name: string, content: string) {
  return { name, mimeType: "text/plain", buffer: Buffer.from(content) };
}

/** Resolves with the statuses of the upload requests made while `action` runs, until the page settles on `url` */
async function uploadsDuring(page: Page, action: () => Promise<void>, url: RegExp): Promise<number[]> {
  const statuses: number[] = [];
  const listener = (response: { url: () => string, status: () => number, request: () => { method: () => string } }) => {
    if (new URL(response.url()).pathname === "/api/attachment" && response.request().method() === "POST") statuses.push(response.status());
  };
  page.on("response", listener);
  try {
    await action();
    await page.waitForURL(url, { timeout: 30_000 });
  }
  finally {
    page.off("response", listener);
  }
  return statuses;
}

/**
 * Picks the sandbox version in the action form's version select. The form's option list is
 * cached, and the sandbox was created moments ago, so the first render may predate it.
 */
async function pickSandboxInActionForm(page: Page, label: string) {
  const option = visible(page, "#iterationId").locator("option").filter({ hasText: `Sandbox ${label}` });
  await reloadUntil(page, () => expect(option).not.toHaveCount(0, { timeout: 5_000 }));
  await pickIterationInActionForm(page, `Sandbox ${label}`);
}

test.describe("Attachments", () => {
  test.use({ storageState: adminFile });

  test("Upload, download and remove on a goal page", async ({ page, admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Documented ${sandbox.label}` });
    const name = "Åtgärdsrapport 2026.txt";
    const content = `rapport ${sandbox.label}`;

    await page.goto(`/goal/${goalId}`);
    await expect(section(page)).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    await expect(section(page)).toContainText("attachments.empty");

    await section(page).getByTestId("attachment-input").setInputFiles(textFile(name, content));
    const [uploadResponse] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === "/api/attachment" && response.request().method() === "POST"),
      section(page).getByTestId("attachment-upload").click(),
    ]);
    expect(uploadResponse.status()).toBe(200);

    const row = rows(page).first();
    await expect(rows(page)).toHaveCount(1);
    await expect(row).toContainText(name);
    await expect(row).toContainText("admin");

    // The link redirects to a short-lived file link; the page's request context carries the session
    const href = await row.getByRole("link", { name }).getAttribute("href");
    expect(href).toMatch(/^\/api\/attachment\//);
    const download = await page.request.get(href ?? "");
    expect(download.status()).toBe(200);
    expect(await download.text()).toBe(content);

    // Removing asks for a confirmation first
    page.once("dialog", dialog => void dialog.accept());
    const [removeResponse] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === "/api/attachment" && response.request().method() === "DELETE"),
      row.getByTestId("attachment-delete").click(),
    ]);
    expect(removeResponse.status()).toBe(200);
    await expect(rows(page)).toHaveCount(0);
    await expect(section(page)).toContainText("attachments.empty");
  });

  test("Anonymous visitors see a public goal's documents but no upload form", async ({ browser, admin, sandbox }) => {
    const roadmapId = await createRoadmap(admin, sandbox.orgId, { name: `Public ${sandbox.label}`, access: { sharing: "PUBLIC", grants: null } });
    try {
      const iterationId = await createIteration(admin, roadmapId);
      const goalId = await createGoal(admin, iterationId, { name: `Open ${sandbox.label}` });
      const upload = await admin.post("/api/attachment", { multipart: { objectId: goalId, file: textFile("Öppet underlag.txt", "public") } });
      expect(upload.status(), await upload.text()).toBe(200);

      // Contexts from the browser fixture inherit the describe's storage state; an empty one makes this visitor anonymous
      const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      try {
        const anonPage = await anonymous.newPage();
        await anonPage.goto(`/goal/${goalId}`);
        await expect(rows(anonPage)).toHaveCount(1);
        await expect(rows(anonPage).first()).toContainText("Öppet underlag.txt");
        await expect(section(anonPage).getByTestId("attachment-input")).toHaveCount(0);
        await expect(section(anonPage).getByTestId("attachment-delete")).toHaveCount(0);
      }
      finally {
        await anonymous.close();
      }
    }
    finally {
      await deleteRoadmap(admin, roadmapId);
    }
  });

  test("Documents picked in the action form are attached to the new action", async ({ page, sandbox }) => {
    test.slow();
    const name = `Documented action ${sandbox.label}`;

    await page.goto("/");
    await openCreate(page, "action");
    await page.waitForURL(/\/action\/create/);
    await pickSandboxInActionForm(page, sandbox.label);
    await visible(page, "#actionName").fill(name);
    await page.getByTestId("action-attachment-input").filter({ visible: true }).setInputFiles([
      textFile("Underlag A.txt", "a"),
      textFile("Underlag B.txt", "b"),
    ]);

    // The action is created first, then each file is sent to it, then the page shows the action
    const uploads = await uploadsDuring(page, async () => {
      expect(await submitForm(page, "/api/action", "POST")).toBe(201);
    }, /\/action\/[0-9a-f-]{36}$/);
    expect(uploads).toEqual([200, 200]);

    await expect(visible(page, "h1").filter({ hasText: name })).toBeVisible({ timeout: 20_000 });
    await expect(rows(page)).toHaveCount(2);
    const names = await rows(page).allTextContents();
    expect(names.some(text => text.includes("Underlag A.txt"))).toBe(true);
    expect(names.some(text => text.includes("Underlag B.txt"))).toBe(true);
  });

  test("A refused file stops the action form before anything is created", async ({ page, sandbox }) => {
    await page.goto("/");
    await openCreate(page, "action");
    await page.waitForURL(/\/action\/create/);
    await pickSandboxInActionForm(page, sandbox.label);
    await visible(page, "#actionName").fill(`Refused action ${sandbox.label}`);
    await page.getByTestId("action-attachment-input").filter({ visible: true }).setInputFiles({ name: "setup.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });

    let created = 0;
    page.on("request", request => {
      if (new URL(request.url()).pathname === "/api/action" && request.method() === "POST") created++;
    });
    await visible(page, "#submit-button").click();

    await expect(page.getByRole("alert").filter({ hasText: "attachments.type_not_allowed" })).toBeVisible();
    await expect(page).toHaveURL(/\/action\/create/);
    expect(created).toBe(0);
  });

  test("Documents picked in the version form are attached to the new version", async ({ page, sandbox }) => {
    test.slow();
    await page.goto(`/roadmap/${sandbox.roadmapId}/iteration/create`);
    // The sandbox roadmap has no parent, so the form asks for no target version; only the status is required
    await visible(page, "#publish").check();
    await page.getByTestId("roadmap-iteration-attachment-input").filter({ visible: true }).setInputFiles(textFile("Versionsunderlag.txt", "v2"));

    const uploads = await uploadsDuring(page, async () => {
      expect(await submitForm(page, "/api/roadmap-iteration", "POST")).toBe(201);
    }, new RegExp(`/roadmap/${sandbox.roadmapId}/v2$`));
    expect(uploads).toEqual([200]);

    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Versionsunderlag.txt");
  });
});
