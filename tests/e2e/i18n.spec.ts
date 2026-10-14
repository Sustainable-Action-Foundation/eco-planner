import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import { allNamespaces, localeAliases, Locales, uniqueLocales } from "../../i18n.config";
import { withLock } from "../lib/lock";

/*
 * The sidebar language switcher and the /tests/locale page. The browsers start
 * in cimode (keys instead of text); expectations for the real languages are
 * read from the locale files, never written out as prose here.
 */

type Tree = { [key: string]: string | Tree };

function localeFile(locale: string, namespace: string): Tree {
  return JSON.parse(readFileSync(path.join(cwd(), "public/locales", locale, `${namespace}.json`), "utf-8")) as Tree;
}

/** A plain (no nesting, no interpolation) string of a locale file */
function localeString(locale: string, namespace: string, key: string): string {
  const value = key.split(".").reduce<string | Tree>((node, part) => (node as Tree)[part], localeFile(locale, namespace));
  if (typeof value !== "string" || value.includes("$t(") || value.includes("{{")) throw new Error(`${locale} ${namespace}:${key} is not a plain string`);
  return value;
}

/** Number of leaf keys over every namespace of a locale, as the /tests/locale page flattens them */
function keyCount(locale: string): number {
  const count = (node: Tree): number => Object.values(node).reduce((sum, value) => sum + (typeof value === "string" ? 1 : count(value)), 0);
  return allNamespaces.reduce((sum, namespace) => sum + count(localeFile(locale, namespace)), 0);
}

/**
 * Switching tests hold this lock (mobile.spec.ts takes it too): the server's i18n
 * instance is one per process, so two pages rendering in different languages at
 * the same moment can get each other's text (an app bug); at least our own
 * browsers then don't race each other.
 */
const localeLock = "locale-switch";

/** The sidebar's language button label: the key in cimode, the locale's text otherwise */
const languageLabelKey = "sidebar.language";

function dialogButton(page: Page) {
  return page.getByTestId("language-switcher-dialog-button").filter({ visible: true });
}

/**
 * Picks a language in the sidebar dialog and waits for the server-rendered
 * sidebar label to come back in it (the switch sets a cookie and calls
 * router.refresh(), a full server render that is slow on a loaded server).
 */
async function chooseLanguage(page: Page, locale: Locales) {
  const option = page.getByTestId(`language-switcher-option-${localeAliases[locale]}`).filter({ visible: true });
  // The choice is stored in a cookie right away; a click lost to a still-hydrating page leaves it unset
  await expect(async () => {
    if (!await option.isVisible()) await dialogButton(page).click();
    await option.click({ timeout: 5_000 });
    expect((await page.context().cookies()).find(cookie => cookie.name === "locale")?.value).toBe(locale);
  }).toPass({ timeout: 30_000 });
  await expect(dialogButton(page)).toHaveText(localeString(locale, "components", languageLabelKey), { timeout: 60_000 });
}

test.describe("Language switcher", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  // The switching test may first wait for the other browsers' switching tests (see localeLock)
  test.describe.configure({ timeout: 240_000 });

  test("starts in the test locale and offers every locale by its alias", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", Locales.test);

    await dialogButton(page).click();
    const options = page.getByTestId("language-switcher-options").filter({ visible: true });
    await expect(options).toBeVisible();

    // One option per locale, named by its alias; the test locale is checked but hidden from users
    for (const locale of uniqueLocales) {
      const option = page.getByTestId(`language-switcher-option-${localeAliases[locale]}`).filter({ visible: locale !== Locales.test });
      await expect(option).toHaveText(localeAliases[locale]);
      await expect(option).toHaveAttribute("data-checked", String(locale === Locales.test));
    }
    const shown = uniqueLocales.filter(locale => locale !== Locales.test).map(locale => localeAliases[locale]).sort((a, b) => a.localeCompare(b));
    await expect(options.locator("button").filter({ visible: true })).toHaveText(shown);
  });

  test("switching re-renders server and client text and remembers the choice", async ({ page, context }) => withLock(localeLock, async () => {
    await page.goto("/");
    const homeTitle = page.getByTestId("home-title").filter({ visible: true });
    await expect(homeTitle).toHaveText("home.title");

    await chooseLanguage(page, Locales.enSE);
    // The title is server-rendered: router.refresh() has to bring it over too
    await expect(homeTitle).not.toHaveText("home.title", { timeout: 30_000 });
    await expect(page.locator("html")).toHaveAttribute("lang", Locales.enSE);
    const englishTitle = await homeTitle.textContent();
    expect((await context.cookies()).find(cookie => cookie.name === "locale")?.value).toBe(Locales.enSE);

    await chooseLanguage(page, Locales.svSE);
    await expect(homeTitle).not.toHaveText(englishTitle ?? "", { timeout: 30_000 });
    await expect(homeTitle).not.toHaveText("home.title");

    // The cookie wins over the browser's accept-language on the next visit
    await page.reload();
    await expect(dialogButton(page)).toHaveText(localeString(Locales.svSE, "components", languageLabelKey));
    await expect(page.locator("html")).toHaveAttribute("lang", Locales.svSE);
  }));
});

test.describe("Translations test page", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  // The page renders every key twice (server and client) and re-renders it all on a switch
  test.describe.configure({ timeout: 240_000 });

  const translationTable = (page: Page) => page.getByTestId("translation-table");

  /** Every key renders once on the server and once on the client, none empty or unresolved */
  async function expectCompleteTranslations(page: Page, locale: Locales) {
    const table = translationTable(page);
    const rows = table.getByTestId("translation-row");
    await expect(rows).toHaveCount(keyCount(Locales.default));
    await expect(table.getByTestId("server")).toHaveCount(keyCount(Locales.default));
    await expect(table.getByTestId("client")).toHaveCount(keyCount(Locales.default));

    // The server column follows router.refresh(); wait for a known plain string before counting
    const probe = rows.filter({ has: page.getByTestId("key").getByText(`components:${languageLabelKey}`, { exact: true }) });
    await expect(probe.getByTestId("server")).toHaveText(localeString(locale, "components", languageLabelKey), { timeout: 60_000 });
    await expect(probe.getByTestId("client")).toHaveText(localeString(locale, "components", languageLabelKey));

    for (const column of ["server", "client"]) {
      const entries = await table.getByTestId(column).allTextContents();
      const broken = entries.flatMap((entry, i) => entry === "[EMPTY]" || entry === "[MISSING]" ? [`row ${i + 1}: ${entry}`] : []);
      expect(broken, `${column}-side translations in ${locale}`).toEqual([]);
    }
  }

  test("formatters transform their input", async ({ page }) => withLock(localeLock, async () => {
    await page.goto("/tests/locale");
    await chooseLanguage(page, Locales.enSE);
    const rows = page.getByTestId("formatter-table").getByTestId("formatter-row");
    await expect(rows.first()).toBeVisible();
    const pairs = await rows.evaluateAll(elements => elements.map(row => ({
      input: row.querySelector('[data-testid="input"]')?.textContent ?? "",
      output: row.querySelector('[data-testid="output"]')?.textContent ?? "",
    })));
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.filter(pair => pair.input === pair.output)).toEqual([]);
  }));

  test("every key resolves on the server and the client in each language", async ({ page }) => withLock(localeLock, async () => {
    await page.goto("/tests/locale");
    // The test locale resolves nothing by design: every row is the key itself
    await expect(translationTable(page).getByTestId("translation-row")).toHaveCount(keyCount(Locales.default));

    await chooseLanguage(page, Locales.enSE);
    await expectCompleteTranslations(page, Locales.enSE);

    await chooseLanguage(page, Locales.svSE);
    await expectCompleteTranslations(page, Locales.svSE);
  }));
});
