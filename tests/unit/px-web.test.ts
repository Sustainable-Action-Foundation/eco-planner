import { registerHooks } from "node:module";
import { expect, test } from "playwright/test";

import type { ApiSelectionItem } from "../../src/lib/api/apiTypes";
import getPxWebTableMetadata from "../../src/lib/api/pxWeb/getPxWebTableMetadata";
import getPxWebTables from "../../src/lib/api/pxWeb/getPxWebTables";
import type { PxWebTableArray, PxWebTableContent, PxWebTableMetadata } from "../../src/lib/api/pxWeb/pxWebApiV2Types";
import type { StructureItem, TrafaDataResponse } from "../../src/lib/api/trafa/trafaTypes";
import { getTrafaSearchQueryString } from "../../src/lib/api/trafa/trafaUtility";
import { stemSolarMetadataFixture, stemTablesFixture } from "../lib/stemFixtures";

/*
 * The table-content modules import "server-only" (a marker that throws outside
 * Next's bundler) and the Trafa catalog/metadata actions call guardExternalApi
 * (session cookies). This loader hook swaps both for inert stubs so the modules
 * can be imported here; they are loaded with import() after the hook is in
 * place. Nothing else is redirected.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,", shortCircuit: true };
    }
    if (/\/guardExternalApi(\.ts)?$/.test(specifier)) {
      return { url: "data:text/javascript," + encodeURIComponent("export async function guardExternalApi() {}"), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const getPxWebTableContent = (await import("../../src/lib/api/pxWeb/getPxWebTableContent")).default;
const getTrafaTables = (await import("../../src/lib/api/trafa/getTrafaTables")).default;
const getTrafaTableMetadata = (await import("../../src/lib/api/trafa/getTrafaTableMetadata")).default;
const getTrafaTableContent = (await import("../../src/lib/api/trafa/getTrafaTableContent")).default;

/*
 * Fetch stubbing: every test installs a router on globalThis.fetch for its
 * duration and restores the original afterwards. Requests are recorded so
 * URLs, methods and bodies can be asserted. The modules log loudly on bad
 * responses, so console output is muted for the duration as well.
 */

type Recorded = { url: URL, method: string, body: string | null };
type Router = (request: Recorded, call: number) => Response | Promise<Response>;

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" }, ...init });

async function withFetch<T>(router: Router, run: () => Promise<T>): Promise<{ result: T, requests: Recorded[] }> {
  const requests: Recorded[] = [];
  const originalFetch = globalThis.fetch;
  const originalConsole = { error: console.error, debug: console.debug, warn: console.warn };
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const recorded = { url, method: init?.method ?? (input instanceof Request ? input.method : "GET"), body: typeof init?.body === "string" ? init.body : null };
    requests.push(recorded);
    return router(recorded, requests.length);
  };
  const mute = () => undefined;
  console.error = mute;
  console.debug = mute;
  console.warn = mute;
  try {
    return { result: await run(), requests };
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(console, originalConsole);
  }
}

/** A sleep that records what it was asked to wait, without waiting */
function fakeSleep() {
  const waits: number[] = [];
  return { waits, sleep: (ms: number) => { waits.push(ms); return Promise.resolve(); } };
}

const stemCatalogEntry = {
  tableId: "EN0123_1",
  label: "Nätanslutna solcellsanläggningar, antal och installerad effekt, från år 2016 - (EN0123_1)",
  variableNames: ["ApiContentsVariableName", "År", "Region", "Effektklass", "Kategori"],
  timeUnit: "Annual",
  firstPeriod: "2016",
  lastPeriod: "2024",
};

test.describe("getPxWebTables", () => {
  test("keeps the catalog metadata needed for client-side filtering", async () => {
    const { result, requests } = await withFetch(() => json(stemTablesFixture), () => getPxWebTables("STEM", "sv"));
    expect(result?.[0]).toEqual(stemCatalogEntry);
    expect(result).toHaveLength(stemTablesFixture.tables.length);
    expect(requests).toHaveLength(1);
    expect(requests[0].url.href).toBe("https://api.pxexternal2.energimyndigheten.se/tables?lang=sv&pageSize=9999");
    expect(requests[0].method).toBe("GET");
  });

  test("re-fetches with the full page size when the catalog is larger than the first page", async () => {
    const firstPage: PxWebTableArray = { ...stemTablesFixture, tables: stemTablesFixture.tables.slice(0, 2), page: { pageNumber: 1, pageSize: 2, totalElements: 4, totalPages: 2 } };
    const { result, requests } = await withFetch(
      (_, call) => json(call === 1 ? firstPage : stemTablesFixture),
      () => getPxWebTables("STEM", "sv", 2),
    );
    expect(requests.map(request => request.url.searchParams.get("pageSize"))).toEqual(["2", "4"]);
    expect(result).toHaveLength(4);
  });

  test("falls back to the dataset's first supported language", async () => {
    const { requests } = await withFetch(() => json(stemTablesFixture), () => getPxWebTables("STEM", "en"));
    expect(requests[0].url.searchParams.get("lang")).toBe("sv");
    const scb = await withFetch(() => json(stemTablesFixture), () => getPxWebTables("SCB", "en"));
    expect(scb.requests[0].url.searchParams.get("lang")).toBe("en");
  });

  test("an unknown dataset falls back to SCB", async () => {
    const { requests } = await withFetch(() => json(stemTablesFixture), () => getPxWebTables("Eurostat"));
    expect(requests[0].url.origin + requests[0].url.pathname).toBe("https://statistikdatabasen.scb.se/api/v2/tables");
    expect(requests[0].url.searchParams.get("lang")).toBe("sv");
  });

  test("a non-ok response gives null", async () => {
    const { result } = await withFetch(() => new Response("nope", { status: 500 }), () => getPxWebTables("STEM"));
    expect(result).toBeNull();
    const notFound = await withFetch(() => new Response("", { status: 404 }), () => getPxWebTables("STEM"));
    expect(notFound.result).toBeNull();
  });

  test("a thrown fetch gives null", async () => {
    const { result } = await withFetch(() => { throw new Error("ECONNRESET"); }, () => getPxWebTables("STEM"));
    expect(result).toBeNull();
    const badJson = await withFetch(() => new Response("<html>", { status: 200 }), () => getPxWebTables("STEM"));
    expect(badJson.result).toBeNull();
  });

  test("a 429 waits ten seconds and retries once more", async () => {
    const { waits, sleep } = fakeSleep();
    const { result, requests } = await withFetch(
      (_, call) => call === 1 ? new Response("", { status: 429 }) : json(stemTablesFixture),
      () => getPxWebTables("STEM", "sv", 9999, sleep),
    );
    expect(waits).toEqual([10000]);
    expect(requests).toHaveLength(2);
    expect(result?.[0]).toEqual(stemCatalogEntry);
  });
});

test.describe("getPxWebTableMetadata", () => {
  test("shapes the STEM metadata into metric, time and regular dimensions with their options", async () => {
    const { result, requests } = await withFetch(() => json(stemSolarMetadataFixture), () => getPxWebTableMetadata("EN0123_1", "STEM"));
    expect(requests[0].url.href).toBe("https://api.pxexternal2.energimyndigheten.se/tables/EN0123_1/metadata?lang=sv");
    expect(result).toMatchObject({ tableId: "EN0123_1", language: "sv", api: "PxWeb" });
    expect(result?.metricDimensions).toEqual([{
      type: "metric", id: "ContentsCode", name: "ContentsCode", label: "ApiContentsVariableName",
      options: [{ type: "dimensionValue", value: "N", index: 0, label: "Antal anläggningar" }],
    }]);
    expect(result?.timeDimensions).toHaveLength(1);
    expect(result?.timeDimensions[0]).toMatchObject({ type: "time", id: "Tid", label: "År", optional: false });
    expect(result?.timeDimensions[0].options.map(option => option.value)).toEqual(["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024"]);
    expect(result?.regularDimensions.map(dimension => [dimension.id, dimension.optional])).toEqual([["Region", false], ["Effektklass", true], ["Kategori", true]]);
    expect(result?.regularDimensions[0].options).toContainEqual({ type: "dimensionValue", value: "0180", index: 3, label: "0180 Stockholm" });
  });

  test("recognises the time dimension by name when the provider declares no time role", async () => {
    const undeclared: PxWebTableMetadata = { ...stemSolarMetadataFixture, role: { metric: ["ContentsCode"] } };
    const { result } = await withFetch(() => json(undeclared), () => getPxWebTableMetadata("EN0123_1", "STEM"));
    expect(result?.timeDimensions.map(dimension => dimension.id)).toEqual(["Tid"]);
    expect(result?.regularDimensions.map(dimension => dimension.id)).toEqual(["Region", "Effektklass", "Kategori"]);
  });

  test("a single-valued dimension may carry only a label, but not nothing", async () => {
    const labelOnly: PxWebTableMetadata = {
      ...stemSolarMetadataFixture,
      dimension: { ...stemSolarMetadataFixture.dimension, Kategori: { label: "Kategori", category: { label: { "ANT": "Antal" }, child: null }, extension: { elimination: true } } },
    };
    const { result } = await withFetch(() => json(labelOnly), () => getPxWebTableMetadata("EN0123_1", "STEM"));
    expect(result?.regularDimensions.find(dimension => dimension.id === "Kategori")?.options).toEqual([{ type: "dimensionValue", value: "ANT", index: 0, label: "Antal" }]);

    const empty: PxWebTableMetadata = {
      ...stemSolarMetadataFixture,
      dimension: { ...stemSolarMetadataFixture.dimension, Kategori: { label: "Kategori", category: { child: null }, extension: { elimination: true } } },
    };
    const broken = await withFetch(() => json(empty), () => getPxWebTableMetadata("EN0123_1", "STEM"));
    expect(broken.result).toBeNull();
  });

  test("does not fetch without a table id or dataset", async () => {
    const { result, requests } = await withFetch(() => json(stemSolarMetadataFixture), async () => [await getPxWebTableMetadata("", "STEM"), await getPxWebTableMetadata("EN0123_1", "")]);
    expect(result).toEqual([null, null]);
    expect(requests).toHaveLength(0);
  });

  test("404, other errors and a thrown fetch give null", async () => {
    expect((await withFetch(() => new Response("", { status: 404 }), () => getPxWebTableMetadata("NOPE", "STEM"))).result).toBeNull();
    expect((await withFetch(() => new Response("", { status: 503 }), () => getPxWebTableMetadata("EN0123_1", "STEM"))).result).toBeNull();
    expect((await withFetch(() => { throw new Error("offline"); }, () => getPxWebTableMetadata("EN0123_1", "STEM"))).result).toBeNull();
  });

  test("a 429 waits ten seconds and retries", async () => {
    const { waits, sleep } = fakeSleep();
    const { result, requests } = await withFetch(
      (_, call) => call === 1 ? new Response("", { status: 429 }) : json(stemSolarMetadataFixture),
      () => getPxWebTableMetadata("EN0123_1", "STEM", "sv", sleep),
    );
    expect(waits).toEqual([10000]);
    expect(requests).toHaveLength(2);
    expect(result?.tableId).toBe("EN0123_1");
  });
});

/** json-stat2 content for EN0123_1: one value per year, every other dimension down to one value */
const stemSolarContentFixture: PxWebTableContent = {
  ...stemSolarMetadataFixture,
  id: ["ContentsCode", "Tid", "Region", "Effektklass", "Kategori"],
  size: [1, 9, 1, 1, 1],
  dimension: {
    ContentsCode: {
      label: "ApiContentsVariableName",
      category: { index: { "N": 0 }, label: { "N": "Antal anläggningar" }, unit: { "N": { base: "antal", decimals: 0 } }, child: null },
      extension: { elimination: false },
    },
    Tid: stemSolarMetadataFixture.dimension.Tid,
    Region: { label: "Region", category: { index: { "0180": 0 }, label: { "0180": "0180 Stockholm" }, child: null }, extension: { elimination: false } },
    Effektklass: { label: "Effektklass", category: { index: { "TOT": 0 }, label: { "TOT": "Totalt" }, child: null }, extension: { elimination: true } },
    Kategori: { label: "Kategori", category: { index: { "ANT": 0 }, label: { "ANT": "Antal" }, child: null }, extension: { elimination: true } },
  },
  value: [10, 20, 30, 40, 50, 60, 70, 80, null],
};

const solarSelection: ApiSelectionItem[] = [
  { variableCode: "ContentsCode", valueCodes: ["N"] },
  { variableCode: "Region", valueCodes: ["0180"] },
  { variableCode: "Effektklass", valueCodes: ["TOT"] },
  { variableCode: "Kategori", valueCodes: ["ANT"] },
];

/** Routes the metadata GET to the fixture and lets `data` answer the content POST */
function solarRouter(data: Router): Router {
  return (request, call) => request.url.pathname.endsWith("/metadata") ? json(stemSolarMetadataFixture) : data(request, call);
}

test.describe("getPxWebTableContent", () => {
  test("adds the open-ended time selection, posts it, and reads one value per period", async () => {
    const { result, requests } = await withFetch(solarRouter(() => json(stemSolarContentFixture)), () => getPxWebTableContent("EN0123_1", "STEM", [...solarSelection]));
    expect(requests.map(request => request.method)).toEqual(["GET", "POST"]);
    expect(requests[1].url.href).toBe("https://api.pxexternal2.energimyndigheten.se/tables/EN0123_1/data?lang=sv&outputFormat=json-stat2");
    expect(JSON.parse(requests[1].body ?? "")).toEqual({ selection: [...solarSelection, { variableCode: "Tid", valueCodes: ["from(2016)"] }] });

    expect(result?.id).toBe("EN0123_1");
    expect(result?.metadata).toEqual([{ label: stemSolarMetadataFixture.label, source: "Energimyndigheten" }]);
    expect(result?.unit).toEqual({ base: "antal", decimals: 0 });
    expect(result?.values).toHaveLength(9);
    expect(result?.values[0]).toEqual({ period: "2016", value: "10" });
    // A null value becomes an empty string rather than "null"
    expect(result?.values[8]).toEqual({ period: "2024", value: "" });
  });

  test("keeps a time selection the caller made", async () => {
    const selection = [...solarSelection, { variableCode: "Tid", valueCodes: ["FROM(2020)"] }];
    const { requests } = await withFetch(solarRouter(() => json(stemSolarContentFixture)), () => getPxWebTableContent("EN0123_1", "STEM", selection));
    expect(JSON.parse(requests[1].body ?? "")).toEqual({ selection });
  });

  test("a 429 waits out Retry-After, or ten seconds, and posts once more", async () => {
    const withHeader = fakeSleep();
    const first = await withFetch(
      solarRouter((_, call) => call === 2 ? new Response("", { status: 429, headers: { "Retry-After": "3" } }) : json(stemSolarContentFixture)),
      () => getPxWebTableContent("EN0123_1", "STEM", [...solarSelection], "sv", withHeader.sleep),
    );
    expect(withHeader.waits).toEqual([3000]);
    expect(first.requests.map(request => request.method)).toEqual(["GET", "POST", "POST"]);
    expect(first.result?.values).toHaveLength(9);

    const withoutHeader = fakeSleep();
    const second = await withFetch(
      solarRouter((_, call) => call === 2 ? new Response("", { status: 429 }) : json(stemSolarContentFixture)),
      () => getPxWebTableContent("EN0123_1", "STEM", [...solarSelection], "sv", withoutHeader.sleep),
    );
    expect(withoutHeader.waits).toEqual([10000]);
    expect(second.result?.values).toHaveLength(9);
  });

  test("a second 429 in a row is not retried again", async () => {
    const { waits, sleep } = fakeSleep();
    const { result, requests } = await withFetch(
      solarRouter(() => new Response("", { status: 429 })),
      () => getPxWebTableContent("EN0123_1", "STEM", [...solarSelection], "sv", sleep),
    );
    expect(waits).toEqual([10000]);
    expect(requests.filter(request => request.method === "POST")).toHaveLength(2);
    expect(result).toBeNull();
  });

  test("errors, a thrown fetch and a non-JSON body give null", async () => {
    expect((await withFetch(solarRouter(() => new Response("", { status: 500 })), () => getPxWebTableContent("EN0123_1", "STEM", [...solarSelection]))).result).toBeNull();
    expect((await withFetch(solarRouter(() => { throw new Error("offline"); }), () => getPxWebTableContent("EN0123_1", "STEM", [...solarSelection]))).result).toBeNull();
    expect((await withFetch(solarRouter(() => new Response("a;b", { status: 200, headers: { "Content-Type": "text/csv" } })), () => getPxWebTableContent("EN0123_1", "STEM", [...solarSelection]))).result).toBeNull();
  });

  test("a selection leaving two dimensions with several values is refused", async () => {
    const twoDimensional: PxWebTableContent = { ...stemSolarContentFixture, size: [1, 9, 2, 1, 1] };
    const { result } = await withFetch(solarRouter(() => json(twoDimensional)), () => getPxWebTableContent("EN0123_1", "STEM", [...solarSelection]));
    expect(result).toBeNull();
    const empty: PxWebTableContent = { ...stemSolarContentFixture, value: [] };
    expect((await withFetch(solarRouter(() => json(empty)), () => getPxWebTableContent("EN0123_1", "STEM", [...solarSelection]))).result).toBeNull();
  });
});

test.describe("getTrafaSearchQueryString", () => {
  test("always starts with the year dimension", () => {
    expect(getTrafaSearchQueryString([])).toBe("|ar");
  });

  test("puts the metric after the year and other variables after that", () => {
    expect(getTrafaSearchQueryString([
      { variableCode: "drivmedel", valueCodes: ["103"] },
      { variableCode: "metric", valueCodes: ["itrfslut"] },
      { variableCode: "reglan", valueCodes: ["25"] },
    ])).toBe("|ar|itrfslut|drivmedel:103|reglan:25");
  });

  test("a year selection is attached to the year dimension", () => {
    expect(getTrafaSearchQueryString([{ variableCode: "ar", valueCodes: ["2020"] }, { variableCode: "metric", valueCodes: ["itrfslut"] }])).toBe("|ar:2020|itrfslut");
  });

  test("several values join with | for metrics and years, and with , for other variables", () => {
    expect(getTrafaSearchQueryString([
      { variableCode: "metric", valueCodes: ["itrfslut", "nyreg"] },
      { variableCode: "ar", valueCodes: ["2020", "2021"] },
      { variableCode: "drivmedel", valueCodes: ["101", "102"] },
    ])).toBe("|ar:2020|2021|itrfslut|nyreg|drivmedel:101,102");
  });
});

/** A Trafa structure item with the filler fields the type requires */
function item(partial: Pick<StructureItem, "Name" | "Label" | "Type" | "DataType"> & Partial<StructureItem>): StructureItem {
  return { Id: 0, FullLabel: null, ParentName: null, FullName: null, Selected: false, Option: false, Description: null, UniqueId: partial.Name, ActiveFrom: "2020-01-01", StructureItems: [], ...partial };
}

const trafaTableList: Pick<TrafaDataResponse, "StructureItems"> = {
  StructureItems: [
    item({ Name: "t10026", Label: "Personbilar i trafik", Type: "P", DataType: "String" }),
    item({ Name: "t10023", Label: "Lastbilar i trafik", Type: "P", DataType: "String" }),
  ],
};

const trafaTableStructure: Pick<TrafaDataResponse, "StructureItems"> = {
  StructureItems: [
    // The table itself shows up in its own structure; it is filtered away
    item({ Name: "t10026", Label: "Personbilar i trafik", Type: "P", DataType: "String" }),
    item({ Name: "itrfslut", Label: "I trafik vid årets slut", Type: "M", DataType: "String", Description: "Antal" }),
    item({ Name: "nyreg", Label: "Nyregistreringar", Type: "M", DataType: "String", Description: "" }),
    item({ Name: "ar", Label: "År", Type: "D", DataType: "Time", StructureItems: [
      item({ Name: "2023", Label: "2023", Type: "DV", DataType: "String" }),
      item({ Name: "senaste", Label: "Senaste", Type: "F", DataType: "String" }),
    ] }),
    item({ Name: "drivmedel", Label: "Drivmedel", Type: "D", DataType: "String", StructureItems: [
      item({ Name: "103", Label: "El", Type: "DV", DataType: "String" }),
    ] }),
    item({ Name: "region", Label: "Region", Type: "H", DataType: "Region", StructureItems: [
      item({ Name: "reglan", Label: "Län", Type: "D", DataType: "Region", StructureItems: [item({ Name: "25", Label: "Norrbottens län", Type: "DV", DataType: "String" })] }),
      item({ Name: "regkom", Label: "Kommun", Type: "D", DataType: "Region", StructureItems: [item({ Name: "2582", Label: "Boden", Type: "DV", DataType: "String" })] }),
    ] }),
  ],
};

/** Serves the table list for a plain /structure call and the table's structure for a /structure?query= call */
const trafaStructureRouter: Router = request => json(request.url.searchParams.has("query") ? trafaTableStructure : trafaTableList);

test.describe("getTrafaTables", () => {
  test("lists the structure items as tables with the id in the label", async () => {
    const { result, requests } = await withFetch(() => json(trafaTableList), () => getTrafaTables("sv"));
    expect(requests[0].url.href).toBe("https://api.trafa.se/api/structure?lang=sv");
    expect(result).toEqual([
      { tableId: "t10026", label: "Personbilar i trafik (t10026)" },
      { tableId: "t10023", label: "Lastbilar i trafik (t10023)" },
    ]);
  });

  test("falls back to Swedish for unsupported languages", async () => {
    const { requests } = await withFetch(() => json(trafaTableList), () => getTrafaTables("en"));
    expect(requests[0].url.searchParams.get("lang")).toBe("sv");
  });

  test("a non-ok response or a thrown fetch gives null", async () => {
    expect((await withFetch(() => new Response("", { status: 500 }), () => getTrafaTables())).result).toBeNull();
    expect((await withFetch(() => { throw new Error("offline"); }, () => getTrafaTables())).result).toBeNull();
    expect((await withFetch(() => new Response("null", { status: 200 }), () => getTrafaTables())).result).toBeNull();
  });
});

test.describe("getTrafaTableMetadata", () => {
  test("shapes measures, dimensions, filters and hierarchies, leaving the table list out", async () => {
    const { result, requests } = await withFetch(trafaStructureRouter, () => getTrafaTableMetadata("t10026", [{ variableCode: "drivmedel", valueCodes: ["103"] }]));
    expect(requests[0].url.href).toBe("https://api.trafa.se/api/structure?query=t10026%7Car%7Cdrivmedel%3A103&lang=sv");
    expect(requests[1].url.href).toBe("https://api.trafa.se/api/structure?lang=sv");

    expect(result).toMatchObject({ tableId: "t10026", api: "Trafa", language: "sv" });
    expect(result?.metricDimensions).toEqual([{
      id: "metric", type: "metric", dataType: "String", label: "Mått", name: "metric",
      options: [
        { type: "dimensionValue", value: "itrfslut", label: "I trafik vid årets slut", description: "Antal", dataType: "String" },
        { type: "dimensionValue", value: "nyreg", label: "Nyregistreringar", description: undefined, dataType: "String" },
      ],
    }]);
    expect(result?.timeDimensions).toEqual([{
      id: "ar", type: "time", dataType: "Time", label: "År", name: "ar", optional: true, description: null,
      options: [
        { type: "dimensionValue", value: "2023", label: "2023", dataType: "String" },
        { type: "filter", value: "senaste", label: "Senaste", dataType: "String" },
      ],
    }]);
    expect(result?.regularDimensions.map(dimension => dimension.id)).toEqual(["drivmedel"]);
    expect(result?.hierarchies).toHaveLength(1);
    expect(result?.hierarchies[0]).toMatchObject({ id: "region", type: "hierarchy", dataType: "Region" });
    expect(result?.hierarchies[0].children.map(child => [child.id, child.options[0]?.value])).toEqual([["reglan", "25"], ["regkom", "2582"]]);
    // No dimension is named after a table
    expect(result?.regularDimensions.some(dimension => dimension.id === "t10026")).toBe(false);
  });

  test("a non-ok response or a thrown fetch gives null", async () => {
    expect((await withFetch(() => new Response("", { status: 500 }), () => getTrafaTableMetadata("t10026"))).result).toBeNull();
    expect((await withFetch(() => { throw new Error("offline"); }, () => getTrafaTableMetadata("t10026"))).result).toBeNull();
  });
});

type TrafaColumn = TrafaDataResponse["Header"]["Column"][number];
type TrafaCell = TrafaDataResponse["Rows"][number]["Cell"][number];

function column(name: string, type: TrafaColumn["Type"], dataType: TrafaColumn["DataType"]): TrafaColumn {
  return { Name: name, Type: type, DataType: dataType, Filters: null, Value: name, Unit: null, Description: "", UniqueId: name };
}
function cell(columnName: string, value: string, isMeasure = false): TrafaCell {
  return { Name: columnName, IsMeasure: isMeasure, Description: "", Column: columnName, Value: value, FormattedValue: value, Level: "", Gis: "", UniqueId: columnName, NoteIds: [], Versions: [] };
}
function trafaData(columns: TrafaColumn[], rows: TrafaCell[][]): TrafaDataResponse {
  return {
    Header: { Column: columns, Description: null },
    Rows: rows.map(cells => ({ Cell: cells, IsTotal: false })),
    Errors: null, Description: null, Name: "Personbilar i trafik", OriginalName: null, Notes: null,
    NextPublishDate: "2027-01-01", ActiveFrom: "2020-01-01", ValidatedRequestType: null, StructureItems: [],
  };
}

const selection: ApiSelectionItem[] = [{ variableCode: "metric", valueCodes: ["itrfslut"] }, { variableCode: "drivmedel", valueCodes: ["103"] }];

test.describe("getTrafaTableContent", () => {
  test("reads one value per year with a single time column", async () => {
    const data = trafaData(
      [column("ar", "D", "Time"), column("drivmedel", "D", "String"), column("itrfslut", "M", "String")],
      [[cell("ar", "2022"), cell("drivmedel", "El"), cell("itrfslut", "100", true)], [cell("ar", "2023"), cell("drivmedel", "El"), cell("itrfslut", "150", true)]],
    );
    const { result, requests } = await withFetch(() => json(data), () => getTrafaTableContent("t10026", selection));
    expect(requests[0].url.href).toBe("https://api.trafa.se/api/data?query=t10026%7Car%7Citrfslut%7Cdrivmedel%3A103&lang=sv");
    expect(result).toEqual({
      id: "t10026",
      metadata: [{ label: "Personbilar i trafik", source: "Trafa" }],
      values: [{ period: "2022", value: "100" }, { period: "2023", value: "150" }],
    });
  });

  test("combines year with month or quarter columns into periods", async () => {
    const monthly = trafaData(
      [column("ar", "D", "Time"), column("manad", "D", "Time"), column("nyreg", "M", "String")],
      [[cell("ar", "2023"), cell("manad", "1"), cell("nyreg", "5", true)], [cell("ar", "2023"), cell("manad", "2"), cell("nyreg", "6", true)]],
    );
    expect((await withFetch(() => json(monthly), () => getTrafaTableContent("t10026", selection))).result?.values).toEqual([{ period: "2023M1", value: "5" }, { period: "2023M2", value: "6" }]);

    const quarterly = trafaData(
      [column("ar", "D", "Time"), column("kvartal", "D", "Time"), column("nyreg", "M", "String")],
      [[cell("ar", "2023"), cell("kvartal", "4"), cell("nyreg", "9", true)]],
    );
    expect((await withFetch(() => json(quarterly), () => getTrafaTableContent("t10026", selection))).result?.values).toEqual([{ period: "2023K4", value: "9" }]);
  });

  test("refuses tables with no or several measures, or with unsupported time columns", async () => {
    const noMeasure = trafaData([column("ar", "D", "Time")], [[cell("ar", "2023")]]);
    expect((await withFetch(() => json(noMeasure), () => getTrafaTableContent("t10026", selection))).result).toBeNull();

    const twoMeasures = trafaData([column("ar", "D", "Time"), column("a", "M", "String"), column("b", "M", "String")], [[cell("ar", "2023"), cell("a", "1", true), cell("b", "2", true)]]);
    expect((await withFetch(() => json(twoMeasures), () => getTrafaTableContent("t10026", selection))).result).toBeNull();

    const noTime = trafaData([column("drivmedel", "D", "String"), column("a", "M", "String")], [[cell("drivmedel", "El"), cell("a", "1", true)]]);
    expect((await withFetch(() => json(noTime), () => getTrafaTableContent("t10026", selection))).result).toBeNull();

    const monthAndQuarter = trafaData([column("ar", "D", "Time"), column("manad", "D", "Time"), column("kvartal", "D", "Time"), column("a", "M", "String")], []);
    expect((await withFetch(() => json(monthAndQuarter), () => getTrafaTableContent("t10026", selection))).result).toBeNull();
  });

  test("a row missing its time or value gives null rather than a partial series", async () => {
    const data = trafaData([column("ar", "D", "Time"), column("a", "M", "String")], [[cell("ar", "2022"), cell("a", "1", true)], [cell("a", "2", true)]]);
    expect((await withFetch(() => json(data), () => getTrafaTableContent("t10026", selection))).result).toBeNull();
  });

  test("a non-ok response or a thrown fetch gives null", async () => {
    expect((await withFetch(() => new Response("", { status: 500 }), () => getTrafaTableContent("t10026", selection))).result).toBeNull();
    expect((await withFetch(() => { throw new Error("offline"); }, () => getTrafaTableContent("t10026", selection))).result).toBeNull();
    expect((await withFetch(() => new Response("null", { status: 200 }), () => getTrafaTableContent("t10026", selection))).result).toBeNull();
  });
});
