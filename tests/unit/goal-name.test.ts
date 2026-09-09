import { expect, test } from "playwright/test";
import { goalDisplayName, indicatorParameterContext, indicatorParameterLeaf } from "../../src/functions/goalName";

test.describe("Goal names from indicator parameters", () => {
  const indicator = "Key\\Landtransporter\\Personbilar\\Elbilar\\Antal bilar";

  test("a named goal keeps its name", () => {
    expect(goalDisplayName({ name: "Elbilar i Boden", indicator_parameter: indicator })).toBe("Elbilar i Boden");
  });

  test("an unnamed goal is called by the leaf of its indicator parameter", () => {
    expect(goalDisplayName({ name: null, indicator_parameter: indicator })).toBe("Antal bilar");
    expect(goalDisplayName({ name: "", indicator_parameter: indicator })).toBe("Antal bilar");
    expect(indicatorParameterLeaf("Antal bilar")).toBe("Antal bilar");
  });

  test("the context drops the leaf and the leading Key", () => {
    expect(indicatorParameterContext(indicator)).toBe("Landtransporter › Personbilar › Elbilar");
    expect(indicatorParameterContext("Antal bilar")).toBe("");
  });
});
