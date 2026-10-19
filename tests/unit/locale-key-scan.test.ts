import { expect, test } from "playwright/test";

import {
  collectUsedKeys,
  flattenTree,
  getAllTSXFiles,
  isKeyDefined,
  keyPropRegex,
  nestedTRegex,
  stripPluralSuffix,
  tCallRegex,
  validPluralSuffixes,
} from "../../scripts/lib/localeKeyScan";

/*
 * The regexes are global, so they carry a lastIndex between `exec`/`test`
 * calls. Every check goes through `matchAll`, which clones the regex, and
 * only reads the captured key.
 */
const keysIn = (regex: RegExp, text: string) => Array.from(text.matchAll(regex), match => match[1]);

/** A console.warn stub that collects messages for the duration of `run` */
function captureWarnings(run: () => void): string[] {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(" ")); };
  try {
    run();
  } finally {
    console.warn = original;
  }
  return warnings;
}

test.describe("tCallRegex", () => {
  test("captures the key of t() calls with and without options", () => {
    expect(keysIn(tCallRegex, ' t("pages:home.title") ')).toEqual(["pages:home.title"]);
    expect(keysIn(tCallRegex, " t('forms:goal.name', { count: 2 }) ")).toEqual(["forms:goal.name"]);
    expect(keysIn(tCallRegex, ' {t("common:ok")}')).toEqual(["common:ok"]);
    expect(keysIn(tCallRegex, ' t(\n  "common:spaced"\n)')).toEqual(["common:spaced"]);
  });

  test("finds every call in a file", () => {
    const file = 'const a = t("ns:a");\nconst b = t("ns:b", { x });\n<p>{t("ns:c")}</p>';
    expect(keysIn(tCallRegex, file)).toEqual(["ns:a", "ns:b", "ns:c"]);
  });

  test("ignores functions merely ending in t, dynamic keys and template literals", () => {
    expect(keysIn(tCallRegex, 'addToast("common:ok")')).toEqual([]);
    expect(keysIn(tCallRegex, 'format("x")')).toEqual([]);
    expect(keysIn(tCallRegex, "t(key)")).toEqual([]);
    expect(keysIn(tCallRegex, " t(`ns:" + "$" + "{dynamic}`)")).toEqual([]);
  });

  test("a call at the very start of the text needs a non-word character before it", () => {
    // The leading \W excludes `addToast(` but also means a file cannot start with `t(`; code never does
    expect(keysIn(tCallRegex, 't("ns:first")')).toEqual([]);
    expect(keysIn(tCallRegex, '\nt("ns:first")')).toEqual(["ns:first"]);
  });
});

test.describe("keyPropRegex", () => {
  test("captures key-ish props on self-closing elements", () => {
    expect(keysIn(keyPropRegex, '<Trans i18nKey="pages:info.body" />')).toEqual(["pages:info.body"]);
    expect(keysIn(keyPropRegex, "<Trans i18nKey='pages:info.body' components={{ b: <b /> }} />")).toEqual(["pages:info.body"]);
    expect(keysIn(keyPropRegex, '<Thing titleKey={"common:title"} />')).toEqual(["common:title"]);
  });

  test("over-matches on purpose, so React keys are captured too", () => {
    expect(keysIn(keyPropRegex, '<li key="item-1" />')).toEqual(["item-1"]);
  });

  test("ignores props that are not key-like and elements without a self-closing end", () => {
    expect(keysIn(keyPropRegex, '<Trans title="pages:info.body" />')).toEqual([]);
    expect(keysIn(keyPropRegex, '<Trans i18nKey="pages:info.body"></Trans>')).toEqual([]);
  });
});

test.describe("nestedTRegex", () => {
  test("captures the inside of $t() references, options included", () => {
    expect(keysIn(nestedTRegex, "Go to $t(common:home)")).toEqual(["common:home"]);
    expect(keysIn(nestedTRegex, '$t(common:count.goal, {"count": 2}) and $t(common:ok)')).toEqual(['common:count.goal, {"count": 2}', "common:ok"]);
  });

  test("does not match plain interpolation", () => {
    expect(keysIn(nestedTRegex, "{{count}} items")).toEqual([]);
    expect(keysIn(nestedTRegex, "t(common:ok)")).toEqual([]);
  });
});

test.describe("stripPluralSuffix", () => {
  test("removes any of the CLDR plural suffixes", () => {
    for (const suffix of validPluralSuffixes) {
      expect(stripPluralSuffix(`common:count.goal${suffix}`), suffix).toBe("common:count.goal");
    }
  });

  test("leaves keys without a suffix, or with a suffix-like infix, alone", () => {
    expect(stripPluralSuffix("common:count.goal")).toBe("common:count.goal");
    expect(stripPluralSuffix("common:count.goal_ones")).toBe("common:count.goal_ones");
    expect(stripPluralSuffix("common:one_goal")).toBe("common:one_goal");
    expect(stripPluralSuffix("")).toBe("");
  });

  test("strips only one suffix", () => {
    expect(stripPluralSuffix("common:x_one_other")).toBe("common:x_one");
  });
});

test.describe("isKeyDefined", () => {
  const locale = { "common:ok": "OK", "common:count.goal_one": "{{count}} goal", "common:count.goal_other": "{{count}} goals", "common:empty": "" };

  test("exact keys and keys defined only through plural variants are defined", () => {
    expect(isKeyDefined("common:ok", locale)).toBe(true);
    expect(isKeyDefined("common:count.goal", locale)).toBe(true);
    expect(isKeyDefined("common:count.goal_one", locale)).toBe(true);
  });

  test("missing keys and empty values are not defined", () => {
    expect(isKeyDefined("common:missing", locale)).toBe(false);
    expect(isKeyDefined("common:count", locale)).toBe(false);
    // An empty translation renders nothing, so it is treated as undefined
    expect(isKeyDefined("common:empty", locale)).toBe(false);
    expect(isKeyDefined("common:ok", {})).toBe(false);
  });
});

test.describe("flattenTree", () => {
  test("joins nested keys with dots and keeps string leaves", () => {
    expect(flattenTree({ a: { b: { c: "x" }, d: "y" }, e: "z" })).toEqual({ "a.b.c": "x", "a.d": "y", e: "z" });
  });

  test("skips empty arrays and warns about other non-string leaves", () => {
    let result: Record<string, string> = {};
    const warnings = captureWarnings(() => {
      result = flattenTree({ list: [], count: 3, flag: true, nothing: null, ok: "fine" });
    });
    expect(result).toEqual({ ok: "fine" });
    expect(warnings).toHaveLength(3);
    expect(warnings.join("\n")).toContain("'count'");
  });

  test("non-object input flattens to nothing", () => {
    expect(flattenTree(null)).toEqual({});
    expect(flattenTree("text")).toEqual({});
    expect(flattenTree(["a", "b"])).toEqual({});
    expect(flattenTree({})).toEqual({});
  });
});

test.describe("collectUsedKeys", () => {
  test("gathers t() keys and key props from files, with plural suffixes stripped", () => {
    const files = [
      { filePath: "a.tsx", content: 'const x = t("pages:home.title_one");\n<Trans i18nKey="pages:home.body" />' },
      { filePath: "b.ts", content: " t('common:ok', { count: 1 })" },
    ];
    expect([...collectUsedKeys(files, {})].sort()).toEqual(["common:ok", "pages:home.body", "pages:home.title"]);
  });

  test("gathers keys referenced through nested $t() in locale values, dropping options", () => {
    const locale = {
      "pages:home.cta": "$t(common:count.goal_other, {\"count\": 3}) and $t(common:ok)",
      "pages:home.plain": "nothing nested",
    };
    expect([...collectUsedKeys([], locale)].sort()).toEqual(["common:count.goal", "common:ok"]);
  });

  test("deduplicates across sources", () => {
    const files = [{ filePath: "a.tsx", content: ' t("common:ok") t("common:ok")' }];
    expect([...collectUsedKeys(files, { "x:y": "$t(common:ok)" })]).toEqual(["common:ok"]);
  });
});

test.describe("getAllTSXFiles", () => {
  const files = getAllTSXFiles();

  test("scans .ts modules as well as .tsx, so catalogs defined in plain TypeScript are covered", () => {
    const catalog = files.find(file => file.filePath.endsWith("curatedHistoricalData.ts"));
    expect(catalog).toBeTruthy();
    expect(keysIn(tCallRegex, catalog?.content ?? "")).toContain("pages:home.curated_historical.title");
    expect(files.some(file => file.filePath.endsWith(".tsx"))).toBe(true);
    expect(files.some(file => file.filePath.includes("prisma/generated"))).toBe(false);
  });

  test("strips comments so commented-out keys do not count as used", () => {
    const catalog = files.find(file => file.filePath.endsWith("curatedHistoricalData.ts"));
    // The source opens with a block comment above the categories; it must be gone
    expect(catalog?.content).not.toContain("How a geo area is injected");
    for (const file of files) {
      const lines = file.content.split("\n");
      expect(lines.some(line => line.trim().startsWith("//")), file.filePath).toBe(false);
    }
  });
});
