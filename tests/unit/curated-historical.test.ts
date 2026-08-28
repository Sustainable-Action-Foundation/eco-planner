import fs from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import { expect, test } from "playwright/test";

import { buildRegionSelection, CuratedHistoricalCatalogKey, CuratedHistoricalCategory, CuratedRegionKind, findRegionCodeByLabel, getCuratedHistoricalCatalog } from "../../src/lib/curatedHistoricalData";
import { ExternalDataset } from "../../src/lib/api/utility";
import { GeoAreaType } from "../../src/lib/prisma/generated";
import type { CuratedSource } from "../../src/lib/curatedHistoricalData";
import type { TFunction } from "i18next";

/** Identity t: entries carry their literal i18n keys so they can be checked against the locale files. */
const identityT = ((key: string) => key) as TFunction;

const catalogs = Object.values(CuratedHistoricalCatalogKey).map(key => getCuratedHistoricalCatalog(identityT, key, "area"));
const entries = catalogs.flatMap(catalog => catalog.entries);
const sources: { label: string, source: CuratedSource }[] = entries.flatMap(entry =>
  entry.series.flatMap(series =>
    Object.entries(series.sources).map(([level, source]) => ({ label: `${entry.key}/${series.key}@${level}`, source })),
  ),
);

test.describe("Curated historical data catalog", () => {
  test("catalogs have entries with unique keys", () => {
    for (const catalog of catalogs) {
      expect(catalog.entries.length, `entries of ${catalog.key}`).toBeGreaterThan(0);
      const keys = catalog.entries.map(entry => entry.key);
      expect(new Set(keys).size, `entry keys of ${catalog.key}`).toBe(keys.length);
    }
    // Entry keys are React keys within a section, but keeping them globally unique keeps the catalogs unambiguous
    const allKeys = entries.map(entry => entry.key);
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });

  test("entries are well-formed", () => {
    for (const entry of entries) {
      expect(Object.values(CuratedHistoricalCategory), `category of "${entry.key}"`).toContain(entry.category);
      if (entry.unit !== null) {
        expect(entry.unit, `unit of "${entry.key}"`).not.toBe("");
      }
      expect(entry.series.length, `series of "${entry.key}"`).toBeGreaterThan(0);
      const seriesKeys = entry.series.map(series => series.key);
      expect(new Set(seriesKeys).size, `series keys of "${entry.key}"`).toBe(seriesKeys.length);
      for (const series of entry.series) {
        expect(Object.keys(series.sources).length, `sources of "${entry.key}/${series.key}"`).toBeGreaterThan(0);
        for (const level of Object.keys(series.sources)) {
          expect(Object.values(GeoAreaType), `source level of "${entry.key}/${series.key}"`).toContain(level);
        }
      }
    }
  });

  test("sources are well-formed and leave the region to be injected per geo area", () => {
    for (const { label, source } of sources) {
      const dataset = ExternalDataset.getDatasetByAlternateName(source.dataset);
      expect(dataset, `dataset of ${label}`).toBeTruthy();
      expect(source.tableId, `tableId of ${label}`).not.toBe("");

      const variableCodes = source.selection.map(item => item.variableCode);
      expect(new Set(variableCodes).size, `duplicate variables in ${label}`).toBe(variableCodes.length);

      switch (source.region.kind) {
        case CuratedRegionKind.PxWebCode:
        case CuratedRegionKind.PxWebLabelPrefix: {
          expect(dataset?.api, `region kind vs api of ${label}`).toBe("PxWeb");
          expect(variableCodes, `selection of ${label}`).not.toContain(source.region.variableCode);
          break;
        }
        case CuratedRegionKind.Trafa: {
          expect(dataset?.api, `region kind vs api of ${label}`).toBe("Trafa");
          expect(variableCodes, `selection of ${label}`).not.toContain("reglan");
          expect(variableCodes, `selection of ${label}`).not.toContain("regkom");
          break;
        }
        case CuratedRegionKind.None: {
          break;
        }
        default: {
          throw new Error(`Unknown region kind in ${label}`);
        }
      }

      if (dataset?.api === "PxWeb") {
        // Every pxWeb query needs a content code; without one the fetch returns nothing
        expect(variableCodes.some(code => code === "ContentsCode" || code === "CONTENTS"), `content code in ${label}`).toBe(true);
      } else if (dataset?.api === "Trafa") {
        // The Trafa query builder reads the measure from the "metric" pseudo-variable
        expect(variableCodes, `metric in ${label}`).toContain("metric");
      }
    }
  });

  test("a Trafa source is not selected for a level its region kind cannot express", () => {
    for (const { label, source } of sources) {
      if (source.region.kind === CuratedRegionKind.None) {
        // A region-less source can only be correct for one level, the nation
        expect(label, `region-less source ${label}`).toMatch(new RegExp(`@${GeoAreaType.NATION}$`));
      }
    }
  });

  test("catalog titles, entry names and descriptions are literal keys defined in every locale", () => {
    // The locale key scanner only covers .tsx files, so the catalog's .ts keys are checked here
    const localesDir = path.join(cwd(), "public/locales");
    const locales = fs.readdirSync(localesDir);
    expect(locales.length).toBeGreaterThan(0);

    const keysToCheck = [
      ...catalogs.flatMap(catalog => [catalog.title, catalog.description]),
      ...entries.flatMap(entry => [entry.name, entry.description, ...entry.series.map(series => series.name)]),
    ];
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

test.describe("Curated region resolution", () => {
  const municipality = { code: "0180", type: GeoAreaType.MUNICIPALITY };
  const county = { code: "01", type: GeoAreaType.COUNTY };
  const nation = { code: "00", type: GeoAreaType.NATION };

  test("findRegionCodeByLabel matches the code as a whole label prefix", () => {
    const options = [
      { value: "0", label: "00 Riket" },
      { value: "1", label: "01 Stockholms län" },
      { value: "2", label: "0114 Upplands Väsby" },
      { value: "3", label: "0180 Stockholm" },
    ];
    expect(findRegionCodeByLabel(options, "00")).toBe("0");
    // "01" must not match "0114 Upplands Väsby"
    expect(findRegionCodeByLabel(options, "01")).toBe("1");
    expect(findRegionCodeByLabel(options, "0180")).toBe("3");
    expect(findRegionCodeByLabel(options, "0181")).toBeNull();
    expect(findRegionCodeByLabel([{ value: "0" }], "00")).toBeNull();
  });

  test("PxWebCode passes the geo area code straight through", () => {
    const region = { kind: CuratedRegionKind.PxWebCode, variableCode: "Region" } as const;
    expect(buildRegionSelection(region, municipality)).toEqual([{ variableCode: "Region", valueCodes: ["0180"] }]);
    expect(buildRegionSelection(region, nation)).toEqual([{ variableCode: "Region", valueCodes: ["00"] }]);
  });

  test("PxWebLabelPrefix uses the resolved positional code and fails without one", () => {
    const region = { kind: CuratedRegionKind.PxWebLabelPrefix, variableCode: "Kommun" } as const;
    expect(buildRegionSelection(region, municipality, "16")).toEqual([{ variableCode: "Kommun", valueCodes: ["16"] }]);
    expect(buildRegionSelection(region, municipality, null)).toBeNull();
    expect(buildRegionSelection(region, municipality)).toBeNull();
  });

  test("Trafa selects the county alongside a municipality and nothing for the nation", () => {
    const region = { kind: CuratedRegionKind.Trafa } as const;
    expect(buildRegionSelection(region, municipality)).toEqual([
      { variableCode: "reglan", valueCodes: ["01"] },
      { variableCode: "regkom", valueCodes: ["0180"] },
    ]);
    expect(buildRegionSelection(region, county)).toEqual([{ variableCode: "reglan", valueCodes: ["01"] }]);
    expect(buildRegionSelection(region, nation)).toEqual([]);
  });

  test("None selects nothing", () => {
    expect(buildRegionSelection({ kind: CuratedRegionKind.None }, nation)).toEqual([]);
  });
});
