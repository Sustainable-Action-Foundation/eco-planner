import { expect, test } from "playwright/test";

import type { ApiTableMetadata } from "../../src/lib/api/apiTypes";
import { ExternalDataset, filterToInitialYearlyRecords, formQueryHelper, isDataSetKeys, parsePeriod } from "../../src/lib/api/utility";

const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day)).toISOString();

test.describe("parsePeriod", () => {
  test("a bare year is January 1st", () => {
    expect(parsePeriod("2024").toISOString()).toBe(utc(2024, 1, 1));
    expect(parsePeriod(" 2024 ").toISOString()).toBe(utc(2024, 1, 1));
  });

  test("quarters start on the first day of the quarter, with K or Q as divider", () => {
    expect(parsePeriod("2024K2").toISOString()).toBe(utc(2024, 4, 1));
    expect(parsePeriod("2024Q2").toISOString()).toBe(utc(2024, 4, 1));
    expect(parsePeriod("2024K1").toISOString()).toBe(utc(2024, 1, 1));
    expect(parsePeriod("2024K4").toISOString()).toBe(utc(2024, 10, 1));
    expect(parsePeriod("2024k3").toISOString()).toBe(utc(2024, 7, 1));
  });

  test("months, zero-padded or not", () => {
    expect(parsePeriod("2024M05").toISOString()).toBe(utc(2024, 5, 1));
    expect(parsePeriod("2024M5").toISOString()).toBe(utc(2024, 5, 1));
    expect(parsePeriod("2024M12").toISOString()).toBe(utc(2024, 12, 1));
  });

  test("ISO weeks start on their Monday, with W or V as divider", () => {
    // ISO week 10 of 2024 is Monday 2024-03-04
    expect(parsePeriod("2024W10").toISOString()).toBe(utc(2024, 3, 4));
    expect(parsePeriod("2024V10").toISOString()).toBe(utc(2024, 3, 4));
    expect(parsePeriod("2024w10").toISOString()).toBe(utc(2024, 3, 4));
  });

  test("week 1 lands on the Monday of the week containing January 4th", () => {
    // Jan 1 is a Monday: week 1 starts Jan 1
    expect(parsePeriod("2024W1").toISOString()).toBe(utc(2024, 1, 1));
    // Jan 1 is a Sunday: week 1 starts Jan 2
    expect(parsePeriod("2023W1").toISOString()).toBe(utc(2023, 1, 2));
    // Jan 1 is a Saturday: week 1 starts Jan 3
    expect(parsePeriod("2022W1").toISOString()).toBe(utc(2022, 1, 3));
    // Jan 1 is a Friday: week 1 starts Jan 4
    expect(parsePeriod("2021W1").toISOString()).toBe(utc(2021, 1, 4));
    // Jan 1 is a Wednesday: week 1 starts in the previous December
    expect(parsePeriod("2020W1").toISOString()).toBe(utc(2019, 12, 30));
    expect(parsePeriod("2025W01").toISOString()).toBe(utc(2024, 12, 30));
  });

  test("a week's Monday is seven days after the previous week's", () => {
    const week1 = parsePeriod("2020W1").getTime();
    const week2 = parsePeriod("2020W2").getTime();
    expect(week2 - week1).toBe(7 * 86_400_000);
    expect(parsePeriod("2020W2").toISOString()).toBe(utc(2020, 1, 6));
  });

  test("rejects unknown formats", () => {
    expect(() => parsePeriod("abc")).toThrow(/Unrecognized period format/);
    expect(() => parsePeriod("")).toThrow(/Unrecognized period format/);
    expect(() => parsePeriod("24")).toThrow(/Unrecognized period format/);
    expect(() => parsePeriod("2024-05")).toThrow(/Unrecognized period format/);
  });
});

test.describe("filterToInitialYearlyRecords", () => {
  test("keeps the first reading of every year, in order", () => {
    const values = [
      { period: "2023K3", value: "1" },
      { period: "2023K4", value: "2" },
      { period: "2024K1", value: "3" },
      { period: "2024K2", value: "4" },
      { period: "2025", value: "5" },
    ];
    expect(filterToInitialYearlyRecords(values)).toEqual([values[0], values[2], values[4]]);
  });

  test("keeps the original entries untouched and handles an empty list", () => {
    const entry = { period: "2024M01", value: "7" };
    const [kept] = filterToInitialYearlyRecords([entry, { period: "2024M02", value: "8" }]);
    expect(kept).toBe(entry);
    expect(filterToInitialYearlyRecords([])).toEqual([]);
  });

  test("years are what the period says, not when the period's first day falls", () => {
    // ISO week 1 of 2020 starts on 2019-12-30, so its calendar year is 2019 and
    // weeks 1 and 2 are both kept as "first of their year"
    test.fail(true, "parsePeriod gives week 1 the calendar year of its Monday, so a week-1 reading is filed under the previous year");
    expect(filterToInitialYearlyRecords([
      { period: "2020W1", value: "1" },
      { period: "2020W2", value: "2" },
    ])).toEqual([{ period: "2020W1", value: "1" }]);
  });
});

test.describe("formQueryHelper", () => {
  const pxWebMetadata: ApiTableMetadata = {
    tableId: "EN0123_1",
    api: "PxWeb",
    language: "sv",
    metricDimensions: [{ type: "metric", id: "ContentsCode", name: "ContentsCode", options: [] }],
    timeDimensions: [{ type: "time", id: "Tid", name: "Tid", optional: false, options: [] }],
    regularDimensions: [{ type: "dimension", id: "Region", name: "Region", optional: false, options: [] }],
  };

  const trafaMetadata: ApiTableMetadata = {
    tableId: "t10026",
    api: "Trafa",
    language: "sv",
    metricDimensions: [{ type: "metric", id: "metric", name: "metric", dataType: "String", options: [] }],
    timeDimensions: [{ type: "time", id: "ar", name: "ar", dataType: "Time", options: [] }],
    regularDimensions: [{ type: "dimension", id: "drivmedel", name: "drivmedel", dataType: "String", options: [] }],
    hierarchies: [{
      type: "hierarchy", id: "region", name: "region", dataType: "Region", children: [
        { type: "dimension", id: "reglan", name: "reglan", dataType: "Region", options: [] },
        { type: "dimension", id: "regkom", name: "regkom", dataType: "Region", options: [] },
      ],
    }],
  };

  function formData(entries: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.append(key, value);
    return data;
  }

  test("picks the dimensions named by the metadata and ignores everything else", () => {
    const selection = formQueryHelper(formData({
      ContentsCode: "N",
      Tid: "2016",
      Region: "0180",
      externalDataset: "STEM",
      externalTableId: "EN0123_1",
      somethingElse: "x",
    }), pxWebMetadata);
    expect(selection).toEqual([
      { variableCode: "ContentsCode", valueCodes: ["N"] },
      { variableCode: "Tid", valueCodes: ["2016"] },
      { variableCode: "Region", valueCodes: ["0180"] },
    ]);
  });

  test("skips blank and missing values", () => {
    expect(formQueryHelper(formData({ ContentsCode: "N", Region: "  " }), pxWebMetadata)).toEqual([
      { variableCode: "ContentsCode", valueCodes: ["N"] },
    ]);
    expect(formQueryHelper(formData({}), pxWebMetadata)).toEqual([]);
  });

  test("wraps the main PxWeb time variable in FROM(), but only for PxWeb tables", () => {
    expect(formQueryHelper(formData({ Tid: "2016" }), pxWebMetadata, "Tid")).toEqual([
      { variableCode: "Tid", valueCodes: ["FROM(2016)"] },
    ]);
    // Another key than the main time variable is left alone
    expect(formQueryHelper(formData({ Tid: "2016" }), pxWebMetadata, "Region")).toEqual([
      { variableCode: "Tid", valueCodes: ["2016"] },
    ]);
    expect(formQueryHelper(formData({ ar: "2016" }), trafaMetadata, "ar")).toEqual([
      { variableCode: "ar", valueCodes: ["2016"] },
    ]);
  });

  test("includes the children of Trafa hierarchies", () => {
    expect(formQueryHelper(formData({ metric: "itrfslut", reglan: "25", regkom: "2582", region: "ignored" }), trafaMetadata)).toEqual([
      { variableCode: "metric", valueCodes: ["itrfslut"] },
      { variableCode: "reglan", valueCodes: ["25"] },
      { variableCode: "regkom", valueCodes: ["2582"] },
    ]);
  });

  test("returns nothing without metadata", () => {
    expect(formQueryHelper(formData({ Tid: "2016" }), null)).toEqual([]);
  });
});

test.describe("isDataSetKeys and dataset lookup", () => {
  test("accepts exactly the canonical dataset keys", () => {
    for (const key of ["SCB", "SSB", "Trafa", "STEM"]) expect(isDataSetKeys(key), key).toBe(true);
    for (const value of ["scb", "TRAFA", "", "Energimyndigheten", 1, null, undefined, {}]) expect(isDataSetKeys(value), JSON.stringify(value) ?? "undefined").toBe(false);
  });

  test("datasets resolve by key, lower-cased key, full name and alternate names", () => {
    expect(ExternalDataset.getDatasetByAlternateName("SCB")).toBe(ExternalDataset.SCB);
    expect(ExternalDataset.getDatasetByAlternateName("scb")).toBe(ExternalDataset.SCB);
    expect(ExternalDataset.getDatasetByAlternateName("Statistics Sweden")).toBe(ExternalDataset.SCB);
    expect(ExternalDataset.getDatasetByAlternateName("Energimyndigheten")).toBe(ExternalDataset.STEM);
    expect(ExternalDataset.getDatasetByAlternateName("trafikanalys")).toBe(ExternalDataset.Trafa);
    expect(ExternalDataset.getDatasetByAlternateName("no-such-dataset")).toBeNull();
    expect(ExternalDataset.getDatasetByAlternateName("")).toBeNull();
    // Static members that are not datasets must not resolve
    expect(ExternalDataset.getDatasetByAlternateName("knownDatasetKeys")).toBeNull();
  });

  test("datasets group by API", () => {
    expect(ExternalDataset.getDatasetsByApi("PxWeb").sort()).toEqual(["SCB", "SSB", "STEM"]);
    expect(ExternalDataset.getDatasetsByApi("Trafa")).toEqual(["Trafa"]);
    expect(ExternalDataset.getDatasetsByApi(["PxWeb", "Trafa", "PxWeb"]).sort()).toEqual(["SCB", "SSB", "STEM", "Trafa"]);
  });
});
