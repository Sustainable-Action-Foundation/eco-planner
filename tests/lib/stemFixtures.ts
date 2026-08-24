import type { PxWebTableArray, PxWebTableMetadata } from "../../src/lib/api/pxWeb/pxWebApiV2Types";

/**
 * A deterministic miniature of STEM's PxWeb `/tables` catalog, modeled on real
 * responses. Region only appears in EN0123_1 so variable-filter tests can assert
 * exact narrowing; period ranges are chosen so coverage-year filters split the set.
 */
export const stemTablesFixture: PxWebTableArray = {
  language: "sv",
  tables: [
    {
      type: "Table",
      id: "EN0123_1",
      label: "Nätanslutna solcellsanläggningar, antal och installerad effekt, från år 2016 -",
      updated: "2025-05-22T07:00:00Z",
      firstPeriod: "2016",
      lastPeriod: "2024",
      variableNames: ["ApiContentsVariableName", "År", "Region", "Effektklass", "Kategori"],
      timeUnit: "Annual",
      links: null,
    },
    {
      type: "Table",
      id: "EN0124_3",
      label: "Biogasproduktion per län, år 2010-2024 (GWh)",
      updated: "2025-04-01T07:00:00Z",
      firstPeriod: "2010",
      lastPeriod: "2024",
      variableNames: ["ApiContentsVariableName", "År", "Län", "Enhet"],
      timeUnit: "Annual",
      links: null,
    },
    {
      type: "Table",
      id: "EN0307_6",
      label: "Trädbränsle- och torvpriser per kvartal",
      updated: "2025-02-11T07:00:00Z",
      firstPeriod: "2020K1",
      lastPeriod: "2024K4",
      variableNames: ["ApiContentsVariableName", "Kvartal", "Sortiment"],
      timeUnit: "Quarterly",
      links: null,
    },
    {
      type: "Table",
      id: "EN0202_A",
      label: "Årlig energibalans",
      updated: "2025-01-20T07:00:00Z",
      firstPeriod: "1990",
      lastPeriod: "2023",
      variableNames: ["ApiContentsVariableName", "År", "Balansrad"],
      timeUnit: "Annual",
      links: null,
    },
  ],
  page: {
    pageNumber: 1,
    pageSize: 9999,
    totalElements: 4,
    totalPages: 1,
  },
};

/**
 * Metadata for the EN0123_1 fixture table. The single-value metric dimension is
 * labeled with the `ApiContentsVariableName` placeholder like the real STEM
 * response, which is exactly the case the query builder must handle: auto-select
 * the metric, unlock the variable fieldset, and show a readable label.
 */
export const stemSolarMetadataFixture: PxWebTableMetadata = {
  version: "2.0",
  class: "dataset",
  label: "Nätanslutna solcellsanläggningar, antal och installerad effekt, från år 2016 -",
  source: "Energimyndigheten",
  role: {
    time: ["Tid"],
    metric: ["ContentsCode"],
  },
  id: ["ContentsCode", "Tid", "Region", "Effektklass", "Kategori"],
  size: [1, 9, 4, 3, 2],
  dimension: {
    ContentsCode: {
      label: "ApiContentsVariableName",
      category: {
        index: { "N": 0 },
        label: { "N": "Antal anläggningar" },
        child: null,
      },
      extension: { elimination: false },
    },
    Tid: {
      label: "År",
      category: {
        index: { "2016": 0, "2017": 1, "2018": 2, "2019": 3, "2020": 4, "2021": 5, "2022": 6, "2023": 7, "2024": 8 },
        label: { "2016": "2016", "2017": "2017", "2018": "2018", "2019": "2019", "2020": "2020", "2021": "2021", "2022": "2022", "2023": "2023", "2024": "2024" },
        child: null,
      },
      extension: { elimination: false },
    },
    Region: {
      label: "Region",
      category: {
        index: { "00": 0, "01": 1, "0114": 2, "0180": 3 },
        label: { "00": "00 Riket", "01": "01 Stockholms län", "0114": "0114 Upplands Väsby", "0180": "0180 Stockholm" },
        child: null,
      },
      extension: { elimination: false },
    },
    Effektklass: {
      label: "Effektklass",
      category: {
        index: { "TOT": 0, "E1": 1, "E2": 2 },
        label: { "TOT": "Totalt", "E1": "Upp till 20 kW", "E2": "Över 20 kW" },
        child: null,
      },
      extension: { elimination: true, eliminationValueCode: "TOT" },
    },
    Kategori: {
      label: "Kategori",
      category: {
        index: { "ANT": 0, "EFF": 1 },
        label: { "ANT": "Antal", "EFF": "Installerad effekt" },
        child: null,
      },
      extension: { elimination: true, eliminationValueCode: "ANT" },
    },
  },
  extension: {
    px: {},
    firstPeriod: "2016",
    lastPeriod: "2024",
  },
  value: [],
};
