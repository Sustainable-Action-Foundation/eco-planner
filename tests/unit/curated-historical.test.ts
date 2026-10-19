import { expect, test } from "playwright/test";

import { buildRegionSelection, CuratedHistoricalCategory, CuratedRegionKind, findRegionCodeByLabel, getCuratedHistoricalCatalog, getNationalGoalMappings } from "../../src/lib/curatedHistoricalData";
import type { CuratedSource } from "../../src/lib/curatedHistoricalData";
import { ExternalDataset } from "../../src/lib/api/utility";
import { GeoAreaType } from "../../src/lib/prisma/generated";
import { filteredLocales, getAllJSONFlattened, isKeyDefined } from "../../scripts/lib/localeKeyScan";
import type { TFunction } from "i18next";

/** Identity t: entries carry their literal i18n keys so they can be checked against the locale files. */
const identityT = ((key: string) => key) as TFunction;

const catalog = getCuratedHistoricalCatalog(identityT, "area");
const entries = catalog.entries;
const sources: { label: string, source: CuratedSource }[] = entries.flatMap(entry =>
  entry.series.flatMap(series =>
    Object.entries(series.sources).map(([level, source]) => ({ label: `${entry.key}/${series.key}@${level}`, source })),
  ),
);

test.describe("Curated historical data catalog", () => {
  test("catalog has entries with unique keys", () => {
    expect(entries.length).toBeGreaterThan(0);
    const keys = entries.map(entry => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
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

  test("a region-less source only serves the nation", () => {
    for (const { label, source } of sources) {
      if (source.region.kind === CuratedRegionKind.None) {
        expect(label, `region-less source ${label}`).toMatch(new RegExp(`@${GeoAreaType.NATION}$`));
      }
    }
  });

  test("unlisted entries exist for national goal mappings, listed ones are browsable", () => {
    const mapped = new Set(getNationalGoalMappings().flatMap(mapping => mapping.series.map(candidate => candidate.entryKey)));
    for (const entry of entries) {
      if (entry.listed === false) {
        expect(mapped.has(entry.key), `unlisted entry "${entry.key}" is not the local counterpart of any national goal`).toBe(true);
      }
    }
    expect(entries.some(entry => entry.listed !== false)).toBe(true);
  });

  test("catalog title, entry names and descriptions are literal keys defined in every locale", () => {
    const allJSON = getAllJSONFlattened();
    expect(filteredLocales.length).toBeGreaterThan(0);

    const keysToCheck = [
      catalog.title,
      catalog.description,
      ...entries.flatMap(entry => [entry.name, entry.description, ...entry.series.map(series => series.name)]),
    ];
    for (const key of keysToCheck) {
      expect(key).toMatch(/^pages:home\.curated_historical\./);
    }

    for (const locale of filteredLocales) {
      for (const key of keysToCheck) {
        expect(isKeyDefined(key, allJSON[locale]), `"${key}" in ${locale}`).toBe(true);
      }
    }
  });

  test("the area name is interpolated into the title and nowhere else", () => {
    const calls: { key: string, options?: unknown }[] = [];
    const recordingT = ((key: string, options?: unknown) => { calls.push({ key, options }); return key; }) as TFunction;
    getCuratedHistoricalCatalog(recordingT, "Boden");

    expect(calls.filter(call => call.key === "pages:home.curated_historical.title")).toEqual([{ key: "pages:home.curated_historical.title", options: { area: "Boden" } }]);
    expect(calls.filter(call => call.key !== "pages:home.curated_historical.title").every(call => call.options === undefined)).toBe(true);
    // The English value actually uses the interpolation
    const allJSON = getAllJSONFlattened();
    for (const locale of filteredLocales) {
      expect(allJSON[locale]["pages:home.curated_historical.title"], locale).toContain("{{area}}");
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
    expect(findRegionCodeByLabel([], "00")).toBeNull();
  });

  test("PxWebCode passes the geo area code straight through", () => {
    const region = { kind: CuratedRegionKind.PxWebCode, variableCode: "Region" } as const;
    expect(buildRegionSelection(region, municipality)).toEqual([{ variableCode: "Region", valueCodes: ["0180"] }]);
    expect(buildRegionSelection(region, county)).toEqual([{ variableCode: "Region", valueCodes: ["01"] }]);
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

  test("Trafa derives the county from the municipality code, for a catalog source", () => {
    const electricCars = entries.find(entry => entry.key === "cars-by-fuel")?.series.find(series => series.key === "electric");
    const source = electricCars?.sources[GeoAreaType.MUNICIPALITY];
    if (!source) throw new Error("cars-by-fuel/electric has no municipal source");
    expect(source.region.kind).toBe(CuratedRegionKind.Trafa);

    // Boden (2582) lies in Norrbottens län (25); the county goes first, then the municipality
    const boden = { code: "2582", type: GeoAreaType.MUNICIPALITY };
    const region = buildRegionSelection(source.region, boden);
    expect(region).toEqual([
      { variableCode: "reglan", valueCodes: ["25"] },
      { variableCode: "regkom", valueCodes: ["2582"] },
    ]);
    // Combined with the fixed selection, every variable is still selected once
    const codes = [...(region ?? []), ...source.selection].map(item => item.variableCode);
    expect(new Set(codes).size).toBe(codes.length);

    // The county itself, and a county on its own
    expect(buildRegionSelection(source.region, { code: "25", type: GeoAreaType.COUNTY })).toEqual([{ variableCode: "reglan", valueCodes: ["25"] }]);
    expect(buildRegionSelection(source.region, { code: "1480", type: GeoAreaType.MUNICIPALITY })?.[0]).toEqual({ variableCode: "reglan", valueCodes: ["14"] });
  });

  test("None selects nothing", () => {
    expect(buildRegionSelection({ kind: CuratedRegionKind.None }, nation)).toEqual([]);
    expect(buildRegionSelection({ kind: CuratedRegionKind.None }, municipality)).toEqual([]);
  });

  test("an unknown region kind or area type is an error", () => {
    expect(() => buildRegionSelection({ kind: "SOMETHING" } as unknown as Parameters<typeof buildRegionSelection>[0], nation)).toThrow(/Unknown curated region kind/);
    expect(() => buildRegionSelection({ kind: CuratedRegionKind.Trafa }, { code: "1", type: "PLANET" as GeoAreaType })).toThrow(/Unknown geo area type/);
  });
});

test.describe("National goal mappings", () => {
  const mappings = getNationalGoalMappings();

  test("each national goal maps to existing catalog series, in order of preference", () => {
    expect(mappings.length).toBeGreaterThan(0);
    const indicators = mappings.map(mapping => mapping.indicatorParameter);
    expect(new Set(indicators).size, "duplicate indicator parameters").toBe(indicators.length);

    for (const mapping of mappings) {
      // LEAP paths use single backslashes; a doubled one is a quoting mistake
      expect(mapping.indicatorParameter, mapping.indicatorParameter).not.toContain("\\\\");
      expect(mapping.series.length, `series of ${mapping.indicatorParameter}`).toBeGreaterThan(0);
      for (const candidate of mapping.series) {
        const entry = entries.find(entry => entry.key === candidate.entryKey);
        expect(entry, `entry ${candidate.entryKey} of ${mapping.indicatorParameter}`).toBeTruthy();
        expect(entry?.series.some(series => series.key === candidate.seriesKey), `series ${candidate.entryKey}/${candidate.seriesKey} of ${mapping.indicatorParameter}`).toBe(true);
      }
    }
  });

  test("every mapped goal has a candidate series covering municipalities", () => {
    for (const mapping of mappings) {
      const municipal = mapping.series.some(candidate =>
        entries.find(entry => entry.key === candidate.entryKey)?.series.find(series => series.key === candidate.seriesKey)?.sources[GeoAreaType.MUNICIPALITY],
      );
      expect(municipal, `municipal coverage of ${mapping.indicatorParameter}`).toBe(true);
    }
  });
});
