import { expect, test } from "playwright/test";

import { isGoalListed, isIterationListed } from "../../src/lib/listing";
import { GoalListing, IterationStatus } from "../../src/lib/prisma/generated";
import { AccessLevel } from "../../src/types/enums";

/*
 * Listing never grants or removes access; it only decides who sees an item in
 * lists. Editors see everything of theirs listed, readers only what is published
 * / listed.
 */

test.describe("isIterationListed", () => {
  test("published versions are listed for everyone with access", () => {
    for (const level of [AccessLevel.View, AccessLevel.Edit, AccessLevel.Admin]) {
      expect(isIterationListed({ status: IterationStatus.PUBLISHED }, level)).toBe(true);
    }
  });

  test("unlisted and draft versions are only listed for editors", () => {
    for (const status of [IterationStatus.UNLISTED, IterationStatus.DRAFT]) {
      expect(isIterationListed({ status }, AccessLevel.View)).toBe(false);
      expect(isIterationListed({ status }, AccessLevel.None)).toBe(false);
      expect(isIterationListed({ status }, AccessLevel.Edit)).toBe(true);
      expect(isIterationListed({ status }, AccessLevel.Admin)).toBe(true);
    }
  });
});

test.describe("isGoalListed", () => {
  test("listed and featured goals are listed for everyone with access", () => {
    for (const listing of [GoalListing.LISTED, GoalListing.FEATURED]) {
      expect(isGoalListed({ listing }, AccessLevel.View)).toBe(true);
    }
  });

  test("unlisted goals are only listed for editors", () => {
    expect(isGoalListed({ listing: GoalListing.UNLISTED }, AccessLevel.View)).toBe(false);
    expect(isGoalListed({ listing: GoalListing.UNLISTED }, AccessLevel.Edit)).toBe(true);
  });
});
