import { expect } from "playwright/test";
import type { Page } from "playwright/test";

/**
 * The start page's org switcher: chips for a few orgs, a select above the chip limit (see maxOrgChips in the start page).
 * Found by shape rather than by its server-rendered aria-label, whose language doesn't reliably follow cimode.
 */
export function orgSwitcher(page: Page) {
  return page.locator("main > nav").filter({ visible: true }).filter({ has: page.locator('select, a[href^="/?org="]') }).first();
}

/** The landing href (`/?org=<id>`) of the named org, read from its chip or its select option */
export async function orgLandingHref(page: Page, name: string): Promise<string> {
  // count() doesn't wait, so let the switcher render before deciding which shape it has
  await orgSwitcher(page).locator("select, a").first().waitFor();
  const select = orgSwitcher(page).locator("select");
  if (await select.count()) {
    const value = await select.locator("option", { hasText: name }).getAttribute("value");
    expect(value).toBeTruthy();
    return `/?org=${value}`;
  }
  const href = await orgSwitcher(page).getByRole("link", { name }).getAttribute("href");
  expect(href).toBeTruthy();
  return href ?? "/";
}
