import { expect, test } from "playwright/test";
import type { TFunction } from "i18next";

import { goalDisplayName, goalTitleWithLevel, indicatorParameterContext, indicatorParameterLeaf, normalizeGoalName } from "../../src/functions/goalName";
import { RoadmapType } from "../../src/lib/prisma/generated";

test.describe("Goal names from indicator parameters", () => {
  const indicator = "Key\\Landtransporter\\Personbilar\\Elbilar\\Antal bilar";

  test("a named goal keeps its name", () => {
    expect(goalDisplayName({ name: "Elbilar i Boden", indicator_parameter: indicator })).toBe("Elbilar i Boden");
  });

  test("an unnamed goal is called by the leaf of its indicator parameter", () => {
    expect(goalDisplayName({ name: null, indicator_parameter: indicator })).toBe("Antal bilar");
    expect(goalDisplayName({ name: "", indicator_parameter: indicator })).toBe("Antal bilar");
    expect(indicatorParameterLeaf("Antal bilar")).toBe("Antal bilar");
    expect(indicatorParameterLeaf("Key\\Trailing\\")).toBe("Trailing");
  });

  test("a blank name is stored as no name", () => {
    expect(normalizeGoalName("")).toBeNull();
    expect(normalizeGoalName("   ")).toBeNull();
    expect(normalizeGoalName(null)).toBeNull();
    expect(normalizeGoalName(" Elbilar i Boden ")).toBe("Elbilar i Boden");
    expect(normalizeGoalName(undefined)).toBeUndefined();
  });

  test("the context drops the leaf and the leading Key", () => {
    expect(indicatorParameterContext(indicator)).toBe("Landtransporter › Personbilar › Elbilar");
    expect(indicatorParameterContext("Antal bilar")).toBe("");
    expect(indicatorParameterContext("Demand\\Energi\\Total")).toBe("Demand › Energi");
  });
});

test.describe("goalTitleWithLevel", () => {
  // A `t` that echoes the key and its interpolation values, so the assertions
  // pin which key is picked and what is fed into it
  const t = ((key: string, options?: Record<string, unknown>) =>
    `${key}{${Object.entries(options ?? {}).map(([k, v]) => `${k}=${String(v)}`).join(",")}}`
  ) as unknown as TFunction;

  const unnamed = { name: null, indicator_parameter: "Key\\Transport\\Antal bilar" };
  const named = { name: "Elbilar", indicator_parameter: "Key\\Transport\\Antal bilar" };
  const area = { name: "Boden" };

  test("national roadmaps get the national suffix, with or without a geo area", () => {
    expect(goalTitleWithLevel(t, unnamed, { type: RoadmapType.NATIONAL, geo_area: null }))
      .toBe("common:goal_title.national_level{name=Antal bilar}");
    expect(goalTitleWithLevel(t, named, { type: RoadmapType.NATIONAL, geo_area: { name: "Sverige" } }))
      .toBe("common:goal_title.national_level{name=Elbilar}");
  });

  const nonNational = Object.values(RoadmapType).filter(type => type !== RoadmapType.NATIONAL);

  for (const type of nonNational) {
    test(`${type} roadmaps with a geo area get the area suffix`, () => {
      expect(goalTitleWithLevel(t, unnamed, { type, geo_area: area }))
        .toBe("common:goal_title.area_level{name=Antal bilar,area=Boden}");
      expect(goalTitleWithLevel(t, named, { type, geo_area: area }))
        .toBe("common:goal_title.area_level{name=Elbilar,area=Boden}");
    });

    test(`${type} roadmaps without a geo area show the bare display name`, () => {
      expect(goalTitleWithLevel(t, unnamed, { type, geo_area: null })).toBe("Antal bilar");
      expect(goalTitleWithLevel(t, named, { type, geo_area: null })).toBe("Elbilar");
      // An area with a blank name counts as no area
      expect(goalTitleWithLevel(t, named, { type, geo_area: { name: "" } })).toBe("Elbilar");
    });
  }
});
