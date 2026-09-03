import { expect, test } from "playwright/test";
import { GoalListing } from "../../src/lib/prisma/generated";

import { csvToGoalList, parseGoalCsv } from "../../src/functions/parseGoalCsv";
import { GoalDataTarget, UnitFlags } from "../../src/types/enums";

function buffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

test.describe("parseGoalCsv", () => {
  test("parses semicolon-delimited rows", () => {
    expect(parseGoalCsv(buffer("a;b;c\n1;2;3"))).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  test("detects comma-delimited files", () => {
    expect(parseGoalCsv(buffer("a,b,c\n1,2,3"))).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  test("handles quoted cells containing delimiters, newlines, and escaped quotes", () => {
    expect(parseGoalCsv(buffer('"a;1";"two\nlines";"say ""hi"""\nx;y;z'))).toEqual([
      ["a;1", "two\nlines", 'say "hi"'],
      ["x", "y", "z"],
    ]);
  });

  test("handles CRLF line endings without polluting cells", () => {
    expect(parseGoalCsv(buffer("a;b\r\n1;2\r\n"))).toEqual([["a", "b"], ["1", "2"]]);
  });

  test("strips a UTF-8 BOM", () => {
    expect(parseGoalCsv(buffer("﻿a;b"))).toEqual([["a", "b"]]);
  });

  test("falls back to Windows-1252 when the file is not UTF-8", () => {
    // "å;ä" in Windows-1252
    const bytes = Uint8Array.from([0xE5, 0x3B, 0xE4]);
    expect(parseGoalCsv(bytes.buffer)).toEqual([["å", "ä"]]);
  });
});

test.describe("csvToGoalList", () => {
  const headers = "Branch Path;Units;2020;2030";

  test("creates full-target goals with ISO-keyed data series", () => {
    const goals = csvToGoalList(parseGoalCsv(buffer(`${headers}\nDemand\\Transport;ton;1,5;2 000`)));
    expect(goals).toEqual([expect.objectContaining({
      target: GoalDataTarget.Full,
      indicatorParameter: "Demand\\Transport",
      dataSeries: {
        dateValues: { "2020-01-01T00:00:00Z": 1.5, "2030-01-01T00:00:00Z": 2000 },
        unit: "ton",
      },
    })]);
  });

  test("skips headers preceded by a metadata row and a blank row", () => {
    const goals = csvToGoalList(parseGoalCsv(buffer(`Exported from somewhere\n\n${headers}\nDemand;ton;1;2`)));
    expect(goals).toHaveLength(1);
    expect(goals[0].indicatorParameter).toEqual("Demand");
  });

  test("skips empty year cells and rows without a branch path", () => {
    const goals = csvToGoalList(parseGoalCsv(buffer(`${headers}\nDemand;ton;;42\n;ton;1;2\n`)));
    expect(goals).toHaveLength(1);
    expect(goals[0].dataSeries.dateValues).toEqual({ "2030-01-01T00:00:00Z": 42 });
  });

  test("treats an empty unit as missing", () => {
    const goals = csvToGoalList(parseGoalCsv(buffer(`${headers}\nDemand;;1;2`)));
    expect(goals[0].dataSeries.unit).toEqual(UnitFlags.Missing);
  });

  test("throws on a missing required header", () => {
    expect(() => csvToGoalList(parseGoalCsv(buffer("Branch Path;2020\nDemand;1")))).toThrow('Missing header "Units"');
  });

  test("throws on non-numeric year values", () => {
    expect(() => csvToGoalList(parseGoalCsv(buffer(`${headers}\nDemand;ton;N/A;2`)))).toThrow(/not a number/);
  });

  test("unlists rows flagged in a hide column labelled in the metadata row", () => {
    // LEAP writes "Hide:" above an otherwise unlabelled column
    const goals = csvToGoalList(parseGoalCsv(buffer(`Hide:;Area:;LEAP\n\n;${headers}\nx;A;ton;1;2\n;B;ton;1;2`)));
    expect(goals.map(goal => goal.listing)).toEqual([GoalListing.UNLISTED, undefined]);
  });

  test("unlists rows flagged in a Hide header column", () => {
    const goals = csvToGoalList(parseGoalCsv(buffer(`Hide;${headers}\nx;A;ton;1;2\n;B;ton;1;2`)));
    expect(goals.map(goal => goal.listing)).toEqual([GoalListing.UNLISTED, undefined]);
  });

  test("accepts Unlisted and Dold as hide column labels", () => {
    for (const label of ["Unlisted", "Dold", "dold:"]) {
      const goals = csvToGoalList(parseGoalCsv(buffer(`${label};${headers}\nx;A;ton;1;2\n;B;ton;1;2`)));
      expect(goals.map(goal => goal.listing), label).toEqual([GoalListing.UNLISTED, undefined]);
    }
  });

  test("leaves listing undefined without a hide column", () => {
    const goals = csvToGoalList(parseGoalCsv(buffer(`${headers}\nA;ton;1;2`)));
    expect(goals[0].listing).toBeUndefined();
  });

  test("warns about the deprecated Scale header", () => {
    let warned = false;
    csvToGoalList(parseGoalCsv(buffer("Branch Path;Units;Scale;2020\nDemand;ton;1;2")), () => { warned = true; });
    expect(warned).toEqual(true);
  });
});
