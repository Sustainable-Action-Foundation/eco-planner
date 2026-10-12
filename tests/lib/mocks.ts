import type { Page } from "playwright/test";
import type { PxWebTableArray, PxWebTableMetadata } from "../../src/lib/api/pxWeb/pxWebApiV2Types";
import { stemSolarMetadataFixture, stemTablesFixture } from "./stemFixtures";

/*
 * `page.route` installers for the statistics APIs the browser calls directly.
 *
 * Only the PxWeb catalog and metadata calls (STEM, SCB) go out from the browser,
 * so only they can be mocked here. The table-content fetches and everything
 * Trafa are `"use server"` actions egressing from the app server (guarded by
 * guardExternalApi) and cannot be intercepted from a browser test.
 */

export const STEM_API_ORIGIN = "https://api.pxexternal2.energimyndigheten.se";
export const SCB_API_ORIGIN = "https://statistikdatabasen.scb.se";

/** A deterministic SCB `/tables` catalog in the same shape as the STEM fixture */
export const scbTablesFixture: PxWebTableArray = {
  language: "sv",
  tables: [
    {
      type: "Table",
      id: "TAB628",
      label: "Folkmängden efter region, civilstånd, ålder och kön. År 1968 - 2024",
      updated: "2025-02-20T07:00:00Z",
      firstPeriod: "1968",
      lastPeriod: "2024",
      variableNames: ["region", "civilstånd", "ålder", "kön", "tabellinnehåll", "år"],
      timeUnit: "Annual",
      links: null,
    },
    {
      type: "Table",
      id: "TAB3654",
      label: "Slutanvändning (MWh), efter län och kommun, förbrukarkategori samt bränsletyp. År 2009 - 2023",
      updated: "2025-03-10T07:00:00Z",
      firstPeriod: "2009",
      lastPeriod: "2023",
      variableNames: ["region", "förbrukarkategori", "bränsletyp", "tabellinnehåll", "år"],
      timeUnit: "Annual",
      links: null,
    },
  ],
  page: { pageNumber: 1, pageSize: 9999, totalElements: 2, totalPages: 1 },
};

/** Metadata for the SCB population fixture: one metric, region × year */
export const scbPopulationMetadataFixture: PxWebTableMetadata = {
  version: "2.0",
  class: "dataset",
  label: "Folkmängden efter region och år",
  source: "SCB",
  role: { time: ["Tid"], metric: ["ContentsCode"] },
  id: ["ContentsCode", "Tid", "Region"],
  size: [1, 3, 3],
  dimension: {
    ContentsCode: {
      label: "tabellinnehåll",
      category: { index: { "BE0101N1": 0 }, label: { "BE0101N1": "Folkmängd" }, child: null },
      extension: { elimination: false },
    },
    Tid: {
      label: "år",
      category: { index: { "2022": 0, "2023": 1, "2024": 2 }, label: { "2022": "2022", "2023": "2023", "2024": "2024" }, child: null },
      extension: { elimination: false },
    },
    Region: {
      label: "region",
      category: { index: { "00": 0, "25": 1, "2582": 2 }, label: { "00": "Riket", "25": "Norrbottens län", "2582": "Boden" }, child: null },
      extension: { elimination: false },
    },
  },
  extension: { px: {}, firstPeriod: "2022", lastPeriod: "2024" },
  value: [],
};

type PxWebMock = {
  tables?: PxWebTableArray;
  /** Metadata per table id; unknown ids get a 404 */
  metadata?: Record<string, PxWebTableMetadata>;
  /** Status for every request instead of fixtures (e.g. 429 to exercise rate limiting) */
  status?: number;
};

/** Fulfilled cross-origin responses still go through the browser's CORS checks */
const corsHeaders = { "Access-Control-Allow-Origin": "*" };

async function mockPxWebOrigin(page: Page, origin: string, mock: PxWebMock) {
  await page.route(`${origin}/**`, async route => {
    const url = new URL(route.request().url());
    if (mock.status) {
      await route.fulfill({ status: mock.status, json: {}, headers: corsHeaders });
      return;
    }
    const metadataMatch = url.pathname.match(/\/tables\/([^/]+)\/metadata$/);
    if (metadataMatch && mock.metadata?.[metadataMatch[1]]) {
      await route.fulfill({ json: mock.metadata[metadataMatch[1]], headers: corsHeaders });
    } else if (url.pathname.endsWith("/tables") && mock.tables) {
      await route.fulfill({ json: mock.tables, headers: corsHeaders });
    } else {
      await route.fulfill({ status: 404, json: {}, headers: corsHeaders });
    }
  });
}

/** Serves the STEM catalog and the EN0123_1 metadata from fixtures */
export async function mockStemApi(page: Page, mock: PxWebMock = { tables: stemTablesFixture, metadata: { EN0123_1: stemSolarMetadataFixture } }) {
  await mockPxWebOrigin(page, STEM_API_ORIGIN, mock);
}

/** Serves the SCB catalog and the TAB628 metadata from fixtures */
export async function mockScbApi(page: Page, mock: PxWebMock = { tables: scbTablesFixture, metadata: { TAB628: scbPopulationMetadataFixture } }) {
  await mockPxWebOrigin(page, SCB_API_ORIGIN, mock);
}
