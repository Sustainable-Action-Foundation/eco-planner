import { expect } from "playwright/test";
import type { Locator, Page } from "playwright/test";
import { orgIdByName } from "./api";

/**
 * The start page's org switcher: chips for a few orgs, a searchable select (`#org-switcher`) above the chip limit (see maxOrgChips in the start page).
 * Found by shape rather than by its server-rendered aria-label, whose language doesn't reliably follow cimode.
 */
export function orgSwitcher(page: Page) {
  return page.locator("main > nav").filter({ visible: true }).filter({ has: page.locator('#org-switcher, a[href^="/?org="]') }).first();
}

/** The switcher's control(s): the select's toggle, or the chips */
export function orgSwitcherControls(page: Page): Locator {
  return orgSwitcher(page).locator("#org-switcher, a");
}

/** One entry per view: the select's options (in the DOM while it is closed too), or the chips */
export function orgSwitcherEntries(page: Page): Locator {
  return orgSwitcher(page).locator("#org-switcher-dialog-listbox li, a");
}

/** The landing href (`/?org=<id>`) of the named org, read from its chip or, for the select, off the page's payload */
export async function orgLandingHref(page: Page, name: string): Promise<string> {
  // count() doesn't wait, so let the switcher render before deciding which shape it has
  await orgSwitcherControls(page).first().waitFor();
  if (await orgSwitcher(page).locator("#org-switcher").count()) {
    return `/?org=${await orgIdByName(page.request, name)}`;
  }
  const href = await orgSwitcher(page).getByRole("link", { name }).getAttribute("href");
  expect(href).toBeTruthy();
  return href ?? "/";
}
