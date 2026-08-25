import fs from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import { expect, test } from "playwright/test";

import { CuratedHistoricalCategory, getCuratedHistoricalCatalog } from "../../src/lib/curatedHistoricalData";
import { ExternalDataset } from "../../src/lib/api/utility";
import type { TFunction } from "i18next";

/** Identity t: entries carry their literal i18n keys so they can be checked against the locale files. */
const identityT = ((key: string) => key) as TFunction;

const catalog = getCuratedHistoricalCatalog(identityT);

test.describe("Curated historical data catalog", () => {
  test("has entries with unique keys", () => {
    expect(catalog.length).toBeGreaterThan(0);
    const keys = catalog.map(entry => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("entries are well-formed", () => {
    for (const entry of catalog) {
      expect(Object.values(CuratedHistoricalCategory), `category of "${entry.key}"`).toContain(entry.category);
      expect(ExternalDataset.getDatasetByAlternateName(entry.dataset), `dataset of "${entry.key}"`).toBeTruthy();
      expect(entry.tableId, `tableId of "${entry.key}"`).not.toBe("");
      if (entry.unit !== null) {
        expect(entry.unit, `unit of "${entry.key}"`).not.toBe("");
      }
    }
  });

  test("selections leave Region to be injected per geo area", () => {
    for (const entry of catalog) {
      const variableCodes = entry.selection.map(item => item.variableCode);
      expect(variableCodes, `selection of "${entry.key}"`).not.toContain("Region");
      // Every pxWeb query needs a content code; without one the fetch returns nothing
      expect(variableCodes, `selection of "${entry.key}"`).toContain("ContentsCode");
    }
  });

  test("entry names and descriptions are literal keys defined in every locale", () => {
    // The locale key scanner only covers .tsx files, so the catalog's .ts keys are checked here
    const localesDir = path.join(cwd(), "public/locales");
    const locales = fs.readdirSync(localesDir);
    expect(locales.length).toBeGreaterThan(0);

    const keysToCheck = catalog.flatMap(entry => [entry.name, entry.description]);
    for (const key of keysToCheck) {
      expect(key).toMatch(/^pages:home\.curated_historical\./);
    }

    for (const locale of locales) {
      const pages = JSON.parse(fs.readFileSync(path.join(localesDir, locale, "pages.json"), "utf-8")) as Record<string, unknown>;
      for (const key of keysToCheck) {
        const keyPath = key.replace(/^pages:/, "").split(".");
        let value: unknown = pages;
        for (const segment of keyPath) {
          expect(value, `"${key}" in ${locale}`).toBeInstanceOf(Object);
          value = (value as Record<string, unknown>)[segment];
        }
        expect(typeof value, `"${key}" in ${locale}`).toBe("string");
        expect(value, `"${key}" in ${locale}`).not.toBe("");
      }
    }
  });
});
