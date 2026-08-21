import { expect, test } from "playwright/test";

import getPxWebTables from "../../src/lib/api/pxWeb/getPxWebTables";
import type { PxWebTableArray } from "../../src/lib/api/pxWeb/pxWebApiV2Types";

const catalogResponse: PxWebTableArray = {
  language: "sv",
  tables: [
    {
      type: "Table",
      id: "EN0123_1",
      label: "Nätanslutna solcellsanläggningar",
      updated: "2025-05-22T07:00:00Z",
      firstPeriod: "2016",
      lastPeriod: "2024",
      variableNames: ["ApiContentsVariableName", "År", "Region", "Effektklass", "Kategori"],
      timeUnit: "Annual",
      links: null,
    },
  ],
  page: { pageNumber: 1, pageSize: 9999, totalElements: 1, totalPages: 1 },
};

test.describe("getPxWebTables", () => {
  test("keeps the catalog metadata needed for client-side filtering", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(catalogResponse), { status: 200 }));

    try {
      const tables = await getPxWebTables("STEM", "sv");
      expect(tables).toEqual([
        {
          tableId: "EN0123_1",
          label: "Nätanslutna solcellsanläggningar (EN0123_1)",
          variableNames: ["ApiContentsVariableName", "År", "Region", "Effektklass", "Kategori"],
          timeUnit: "Annual",
          firstPeriod: "2016",
          lastPeriod: "2024",
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
