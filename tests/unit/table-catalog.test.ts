import { expect, test } from "playwright/test";

import {
  aggregateTimeUnitFacets,
  aggregateVariableFacets,
  filterTableCatalog,
  PXWEB_CONTENTS_PLACEHOLDER,
} from "../../src/lib/api/tableCatalog";
import type { ApiTableListEntry } from "../../src/lib/api/apiTypes";

/**
 * A miniature catalog modeled on real entries from STEM, SCB and Trafa.
 * Solar is the only municipality-level table; grain lacks period info like many
 * STEM tables; the Trafa entry has no catalog metadata at all beyond id/label.
 */
const solar: ApiTableListEntry = {
  tableId: "EN0123_1",
  label: "Nätanslutna solcellsanläggningar, antal och installerad effekt, från år 2016 - (EN0123_1)",
  variableNames: [PXWEB_CONTENTS_PLACEHOLDER, "År", "Region", "Effektklass", "Kategori"],
  timeUnit: "Annual",
  firstPeriod: "2016",
  lastPeriod: "2024",
};

const biogas: ApiTableListEntry = {
  tableId: "EN0124_3",
  label: "Biogasproduktion per län, år 2010-2024 (GWh) (EN0124_3)",
  variableNames: [PXWEB_CONTENTS_PLACEHOLDER, "År", "Län", "Enhet"],
  timeUnit: "Annual",
  firstPeriod: "2010",
  lastPeriod: "2024",
};

const prices: ApiTableListEntry = {
  tableId: "EN0302_1",
  label: "Drivmedelspriser per kvartal (EN0302_1)",
  variableNames: [PXWEB_CONTENTS_PLACEHOLDER, "Kvartal", "region", "Enhet"],
  timeUnit: "Quarterly",
  firstPeriod: "2020K1",
  lastPeriod: "2024K4",
};

const grain: ApiTableListEntry = {
  tableId: "EN0119_6",
  label: "Antal jordbruksföretag med spannmålstorkar (EN0119_6)",
  variableNames: [PXWEB_CONTENTS_PLACEHOLDER, "År", "Län/Riket", "Typ av spannmålstork"],
  timeUnit: "Annual",
  firstPeriod: null,
  lastPeriod: null,
};

const trafa: ApiTableListEntry = {
  tableId: "t10011",
  label: "Fordon i län och kommuner (t10011)",
};

const catalog = [solar, biogas, prices, grain, trafa];

test.describe("filterTableCatalog", () => {
  test("returns everything when no filters are active", () => {
    expect(filterTableCatalog(catalog, {})).toEqual(catalog);
    expect(filterTableCatalog(catalog, { search: "  ", variableFilters: [], timeUnitFilter: "", coverageYearFilter: "" })).toEqual(catalog);
  });

  test("free-text search matches label and table ID case-insensitively", () => {
    expect(filterTableCatalog(catalog, { search: "SOLCELL" })).toEqual([solar]);
    expect(filterTableCatalog(catalog, { search: "en0124" })).toEqual([biogas]);
    expect(filterTableCatalog(catalog, { search: "no-such-table" })).toEqual([]);
  });

  test("variable filter matches case-insensitively", () => {
    // "region" matches both "Region" (solar) and "region" (prices)
    expect(filterTableCatalog(catalog, { variableFilters: ["region"] })).toEqual([solar, prices]);
  });

  test("multiple variable filters are ANDed", () => {
    expect(filterTableCatalog(catalog, { variableFilters: ["region", "effektklass"] })).toEqual([solar]);
    expect(filterTableCatalog(catalog, { variableFilters: ["region", "län"] })).toEqual([]);
  });

  test("variable filter excludes tables without catalog variable data", () => {
    expect(filterTableCatalog(catalog, { variableFilters: ["år"] })).not.toContain(trafa);
  });

  test("time unit filter requires an exact match", () => {
    expect(filterTableCatalog(catalog, { timeUnitFilter: "Quarterly" })).toEqual([prices]);
    // The Trafa entry has no timeUnit and is excluded by any time unit filter
    expect(filterTableCatalog(catalog, { timeUnitFilter: "Annual" })).toEqual([solar, biogas, grain]);
  });

  test("coverage year must fall within the table's period range", () => {
    expect(filterTableCatalog(catalog, { coverageYearFilter: "2012" })).toEqual([biogas]);
    expect(filterTableCatalog(catalog, { coverageYearFilter: "2020" })).toEqual([solar, biogas, prices]);
    expect(filterTableCatalog(catalog, { coverageYearFilter: "2025" })).toEqual([]);
  });

  test("coverage year parses sub-yearly period formats like 2020K1", () => {
    expect(filterTableCatalog([prices], { coverageYearFilter: "2020" })).toEqual([prices]);
    expect(filterTableCatalog([prices], { coverageYearFilter: "2019" })).toEqual([]);
  });

  test("coverage year excludes tables without period info", () => {
    expect(filterTableCatalog([grain, trafa], { coverageYearFilter: "2020" })).toEqual([]);
  });

  test("non-year coverage input is ignored", () => {
    expect(filterTableCatalog(catalog, { coverageYearFilter: "20" })).toEqual(catalog);
    expect(filterTableCatalog(catalog, { coverageYearFilter: "abcd" })).toEqual(catalog);
  });

  test("all filters combine", () => {
    expect(filterTableCatalog(catalog, {
      search: "en01",
      variableFilters: ["år"],
      timeUnitFilter: "Annual",
      coverageYearFilter: "2016",
    })).toEqual([solar, biogas]);
  });
});

test.describe("aggregateVariableFacets", () => {
  test("excludes the PxWeb contents placeholder", () => {
    const facets = aggregateVariableFacets(catalog);
    expect(facets.some(facet => facet.name === PXWEB_CONTENTS_PLACEHOLDER)).toBe(false);
  });

  test("merges names case-insensitively and counts tables", () => {
    const facets = aggregateVariableFacets(catalog);
    const region = facets.find(facet => facet.key === "region");
    expect(region?.count).toBe(2);
    // Display name is the first spelling encountered in the catalog
    expect(region?.name).toBe("Region");
  });

  test("sorts by count descending, then name", () => {
    const facets = aggregateVariableFacets(catalog);
    expect(facets[0].key).toBe("år");
    expect(facets[0].count).toBe(3);
    const counts = facets.map(facet => facet.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  test("handles entries without variable names", () => {
    expect(aggregateVariableFacets([trafa])).toEqual([]);
    expect(aggregateVariableFacets([])).toEqual([]);
  });
});

test.describe("aggregateTimeUnitFacets", () => {
  test("returns present units in canonical order", () => {
    expect(aggregateTimeUnitFacets(catalog)).toEqual(["Annual", "Quarterly"]);
    expect(aggregateTimeUnitFacets([prices, solar])).toEqual(["Annual", "Quarterly"]);
  });

  test("ignores entries without a time unit", () => {
    expect(aggregateTimeUnitFacets([trafa])).toEqual([]);
  });
});
