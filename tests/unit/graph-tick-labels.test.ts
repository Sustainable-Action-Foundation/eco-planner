import { expect, test } from "playwright/test";

import { formatTick, graphNumberFormatter, graphTickFormatter, tickFractionDigits } from "../../src/components/graph/functions/tickLabels";

/*
 * Y-axis tick labels: the rough 3-significant-digit format of the graphs
 * labels every tick of a narrow axis the same, and ApexCharts blanks the
 * duplicates. Ticks are formatted with the digits their step calls for, and
 * ordinary axes keep the format they have.
 */
test.describe("Graph tick labels", () => {
  test("a narrow range gets enough decimals to tell the ticks apart", () => {
    const ticks = [1.199, 1.1995, 1.2, 1.2005, 1.201];
    expect(new Set(ticks.map(graphNumberFormatter))).toEqual(new Set(["1,2"])); // the bug: one label for all
    expect(tickFractionDigits(ticks)).toBe(4);
    expect(ticks.map((tick) => formatTick(tick, ticks))).toEqual(["1,1990", "1,1995", "1,2000", "1,2005", "1,2010"]);

    const coarser = [1.199, 1.2, 1.201];
    expect(coarser.map((tick) => formatTick(tick, coarser))).toEqual(["1,199", "1,200", "1,201"]);
  });

  test("an ordinary range keeps the rough format", () => {
    for (const ticks of [
      [0, 20, 40, 60, 80, 100],
      [0, 12.5, 25, 37.5, 50],
      [0, 0.5, 1],
      [0, 0.25, 0.5, 0.75, 1],
      [-30, -20, -10, 0, 10],
    ]) {
      expect(tickFractionDigits(ticks)).toBeUndefined();
      expect(ticks.map((tick) => formatTick(tick, ticks))).toEqual(ticks.map(graphNumberFormatter));
    }
    expect([0, 20, 40, 60, 80, 100].map((tick) => formatTick(tick, [0, 20, 40, 60, 80, 100]))).toEqual(["0", "20", "40", "60", "80", "100"]);
    expect(formatTick(0.5, [0, 0.5, 1])).toBe("0,5");
    expect(formatTick(1, [0, 0.5, 1])).toBe("1");
  });

  test("large values keep the locale integer format", () => {
    const ticks = [0, 300_000, 600_000, 900_000, 1_200_000];
    const asToday = (1_200_000).toLocaleString("sv-SE", { maximumFractionDigits: 0 });
    expect(graphNumberFormatter(1.2e6)).toBe(asToday);
    expect(formatTick(1.2e6, ticks)).toBe(asToday);
    expect(graphTickFormatter(1.2e6, 4, { globals: { yAxisScale: [{ result: ticks }] } })).toBe(asToday);

    // A narrow range of large values gets decimals too, grouping kept
    const narrow = [1_200_000, 1_200_000.5, 1_200_001];
    expect(narrow.map((tick) => formatTick(tick, narrow))).toEqual([`${asToday},0`, `${asToday},5`, `${(1_200_001).toLocaleString("sv-SE")},0`]);
  });

  test("a step that is no short decimal still separates the ticks", () => {
    const step = 1e-3 / 3;
    const ticks = Array.from({ length: 4 }, (_, i) => 1.2 + i * step);
    const labels = ticks.map((tick) => formatTick(tick, ticks));
    expect(new Set(labels).size).toBe(ticks.length);
    expect(labels[0]).toBe("1,20000");
  });

  test("degenerate tick lists fall back to the rough format", () => {
    expect(tickFractionDigits([])).toBeUndefined();
    expect(tickFractionDigits([1.2])).toBeUndefined();
    expect(tickFractionDigits([1.2, 1.2, 1.2])).toBeUndefined();
    expect(formatTick(1.2, [1.2, 1.2])).toBe("1,2");
  });

  test.describe("ApexCharts formatter", () => {
    const narrow = [1.199, 1.1995, 1.2, 1.2005, 1.201];
    const wide = [0, 25, 50, 75, 100];
    const w = { globals: { yAxisScale: [{ result: wide }, { result: narrow }] } };

    test("axis labels are formatted against their own axis' ticks", () => {
      // Drawing: (value, tickIndex, w)
      expect(graphTickFormatter(1.2, 2, w)).toBe("1,2000");
      expect(graphTickFormatter(50, 2, w)).toBe("50");
      // Measuring the label width: (value, { seriesIndex: axisIndex, dataPointIndex: -1, w })
      expect(graphTickFormatter(1.2005, { seriesIndex: 1, dataPointIndex: -1, w })).toBe("1,2005");
      expect(graphTickFormatter(75, { seriesIndex: 0, dataPointIndex: -1, w })).toBe("75");
    });

    test("tooltips and calls without a chart context use the rough format", () => {
      expect(graphTickFormatter(1.2005, { seriesIndex: 0, dataPointIndex: 3, w })).toBe("1,2");
      expect(graphTickFormatter(1.2005)).toBe("1,2");
      expect(graphTickFormatter(1.2005, 2)).toBe("1,2");
      expect(graphTickFormatter(1.2005, 2, { globals: {} })).toBe("1,2");
    });
  });
});
