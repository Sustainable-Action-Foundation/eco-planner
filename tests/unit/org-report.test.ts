import { expect, test } from "playwright/test";

import { OrgView } from "../../src/functions/orgLanding";
import { cssStringLiteral, currentIteration, keyYears, orgReportPath } from "../../src/functions/orgReport";
import { parseRichText, richTextHref } from "../../src/functions/richText";
import { niceScale, yearTicks } from "../../src/components/graph/functions/staticScale";
import { IterationStatus } from "../../src/lib/prisma/generated";

/*
 * The pure parts of the org report: which version of a roadmap it shows, which years a
 * goal's table lists, the axes of the static graphs, how stored descriptions are read,
 * and the escaping of the org name that goes into the printed footer's CSS.
 */

const version = (number: number, status: IterationStatus) => ({ version: number, status });

test.describe("currentIteration", () => {
  test("the latest published version, whatever drafts come after it", () => {
    expect(currentIteration([version(1, IterationStatus.PUBLISHED), version(3, IterationStatus.DRAFT), version(2, IterationStatus.PUBLISHED)]))
      .toEqual(version(2, IterationStatus.PUBLISHED));
  });

  test("the newest draft when nothing is published", () => {
    expect(currentIteration([version(1, IterationStatus.DRAFT), version(2, IterationStatus.DRAFT)])).toEqual(version(2, IterationStatus.DRAFT));
  });

  test("null without versions", () => {
    expect(currentIteration([])).toBeNull();
  });
});

test.describe("keyYears", () => {
  const range = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, index) => first + index);

  test("a short series keeps every year, in order and without duplicates", () => {
    expect(keyYears([2030, 2020, 2025, 2025])).toEqual([2020, 2025, 2030]);
  });

  test("a long series keeps its ends and every fifth year between", () => {
    expect(keyYears(range(2020, 2050))).toEqual([2020, 2025, 2030, 2035, 2040, 2045, 2050]);
    expect(keyYears(range(2021, 2049))).toEqual([2021, 2025, 2030, 2035, 2040, 2045, 2049]);
  });

  test("every tenth year when every fifth is still too many", () => {
    expect(keyYears(range(1990, 2050))).toEqual([1990, 2000, 2010, 2020, 2030, 2040, 2050]);
  });

  test("only the ends when no round years fit", () => {
    expect(keyYears(range(2021, 2029), { limit: 2 })).toEqual([2021, 2029]);
  });

  test("years asked for are added on top, in order", () => {
    expect(keyYears(range(2020, 2050), { always: [2023] })).toEqual([2020, 2023, 2025, 2030, 2035, 2040, 2045, 2050]);
    expect(keyYears(range(2020, 2050), { always: [2030] })).toEqual([2020, 2025, 2030, 2035, 2040, 2045, 2050]);
  });

  test("nothing in, nothing out", () => {
    expect(keyYears([])).toEqual([]);
  });
});

test.describe("orgReportPath", () => {
  test("defaults stay out of the address", () => {
    expect(orgReportPath("abc")).toBe("/org/abc/report");
    expect(orgReportPath("abc", { view: OrgView.Working, unlisted: false, print: false })).toBe("/org/abc/report");
  });

  test("the public version, unlisted goals and the print dialog are asked for by param", () => {
    expect(orgReportPath("abc", { view: OrgView.Public, print: true })).toBe("/org/abc/report?view=public&print=true");
    expect(orgReportPath("abc", { unlisted: true })).toBe("/org/abc/report?unlisted=true");
  });
});

test.describe("cssStringLiteral", () => {
  test("letters, digits and spaces pass, Swedish ones included", () => {
    expect(cssStringLiteral("Enköpings kommun 2026")).toBe('"Enköpings kommun 2026"');
  });

  test("nothing that could end the string, the rule or the style element gets through unescaped", () => {
    const literal = cssStringLiteral('a"; } </style><script>alert(1)</script> \\ \n b');
    expect(literal.startsWith('"')).toBe(true);
    expect(literal.endsWith('"')).toBe(true);
    expect(literal.slice(1, -1)).not.toMatch(/["<>;{}\n/]/);
    // Every backslash starts a hex escape that a space ends
    expect(literal.slice(1, -1).replace(/\\[0-9a-f]+ /g, "")).not.toContain("\\");
  });

  test("an escape is closed before a following hex digit", () => {
    expect(cssStringLiteral("a·1")).toBe('"a\\b7 1"');
  });
});

test.describe("niceScale", () => {
  test("round ticks that hold every value", () => {
    expect(niceScale([1808, 3796])).toEqual({ min: 1500, max: 4000, ticks: [1500, 2000, 2500, 3000, 3500, 4000] });
    expect(niceScale([0.12, 0.47]).ticks).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
  });

  test("values on both sides of zero keep zero as a tick", () => {
    const scale = niceScale([-8280, 8585]);
    expect(scale.ticks).toContain(0);
    expect(scale.min).toBeLessThanOrEqual(-8280);
    expect(scale.max).toBeGreaterThanOrEqual(8585);
  });

  test("a flat series is drawn from zero, not on a band around its value", () => {
    expect(niceScale([200_000, 200_000, 200_000])).toMatchObject({ min: 0, max: 200_000 });
    expect(niceScale([-3, -3])).toMatchObject({ min: -3, max: 0 });
    expect(niceScale([0, 0])).toMatchObject({ min: 0, max: 1 });
  });

  test("no values, or only unusable ones, still give an axis", () => {
    expect(niceScale([])).toEqual({ min: 0, max: 1, ticks: [0, 1] });
    expect(niceScale([NaN, Infinity])).toEqual({ min: 0, max: 1, ticks: [0, 1] });
  });

  test("ticks carry no floating point tail", () => {
    for (const tick of niceScale([0.1, 0.7]).ticks) expect(String(tick).length).toBeLessThanOrEqual(4);
  });
});

test.describe("yearTicks", () => {
  test("every year while they are few, round years otherwise", () => {
    expect(yearTicks(2020, 2024)).toEqual([2020, 2021, 2022, 2023, 2024]);
    expect(yearTicks(2020, 2050)).toEqual([2020, 2025, 2030, 2035, 2040, 2045, 2050]);
    expect(yearTicks(1990, 2050)).toEqual([1990, 2000, 2010, 2020, 2030, 2040, 2050]);
  });

  test("a single year, and no years", () => {
    expect(yearTicks(2030, 2030)).toEqual([2030]);
    expect(yearTicks(2031, 2030)).toEqual([]);
  });
});

test.describe("parseRichText", () => {
  test("nothing to show is null", () => {
    expect(parseRichText(null)).toBeNull();
    expect(parseRichText("  \n ")).toBeNull();
    expect(parseRichText(JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }))).toBeNull();
  });

  test("the editor's document is recognised, other text stays text", () => {
    const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hej" }] }] };
    expect(parseRichText(JSON.stringify(document))).toEqual({ document });
    expect(parseRichText(" Färdplan för Boden.\n\nLänkar: ")).toEqual({ text: "Färdplan för Boden.\n\nLänkar:" });
    expect(parseRichText("{not json")).toEqual({ text: "{not json" });
    expect(parseRichText('{"some":"object"}')).toEqual({ text: '{"some":"object"}' });
  });
});

test.describe("richTextHref", () => {
  test("the editor's protocols pass", () => {
    expect(richTextHref("https://example.org/a")).toBe("https://example.org/a");
    expect(richTextHref("mailto:klimat@example.org")).toBe("mailto:klimat@example.org");
  });

  test("anything else renders without a link", () => {
    expect(richTextHref("javascript:alert(1)")).toBeNull();
    expect(richTextHref("data:text/html,x")).toBeNull();
    expect(richTextHref("/relative")).toBeNull();
    expect(richTextHref(undefined)).toBeNull();
  });
});
