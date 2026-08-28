import { expect, test } from "playwright/test";

import { goalVisibilityFromFlags, goalVisibilityToFlags, isGoalVisibility } from "../../src/functions/goalVisibility";
import { GoalVisibility } from "../../src/types/enums";

/**
 * The admin panel edits a goal's listing state through one select; these pin
 * the mapping between that setting and the two underlying goal flags.
 */

test.describe("goalVisibilityFromFlags", () => {
  test("plain goals are public", () => {
    expect(goalVisibilityFromFlags({ is_featured: false, is_unlisted: false })).toBe(GoalVisibility.Public);
  });

  test("featured goals are featured", () => {
    expect(goalVisibilityFromFlags({ is_featured: true, is_unlisted: false })).toBe(GoalVisibility.Featured);
  });

  test("unlisted wins over featured", () => {
    // An unlisted goal never shows in the featured strip, so it must not read as featured
    expect(goalVisibilityFromFlags({ is_featured: true, is_unlisted: true })).toBe(GoalVisibility.Unlisted);
    expect(goalVisibilityFromFlags({ is_featured: false, is_unlisted: true })).toBe(GoalVisibility.Unlisted);
  });
});

test.describe("goalVisibilityToFlags", () => {
  test("round-trips every visibility", () => {
    for (const visibility of Object.values(GoalVisibility)) {
      const flags = goalVisibilityToFlags(visibility);
      expect(goalVisibilityFromFlags({ is_featured: flags.isFeatured, is_unlisted: flags.isUnlisted })).toBe(visibility);
    }
  });

  test("never sets both flags", () => {
    for (const visibility of Object.values(GoalVisibility)) {
      const flags = goalVisibilityToFlags(visibility);
      expect(flags.isFeatured && flags.isUnlisted).toBe(false);
    }
  });
});

test.describe("isGoalVisibility", () => {
  test("accepts the enum values and rejects everything else", () => {
    for (const visibility of Object.values(GoalVisibility)) {
      expect(isGoalVisibility(visibility)).toBe(true);
    }
    expect(isGoalVisibility("public")).toBe(false);
    expect(isGoalVisibility("")).toBe(false);
    expect(isGoalVisibility(undefined)).toBe(false);
    expect(isGoalVisibility(1)).toBe(false);
  });
});
