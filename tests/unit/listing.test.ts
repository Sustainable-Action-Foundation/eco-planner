import { expect, test } from "playwright/test";

import { isGoalListed } from "../../src/lib/listing";
import { GoalListing } from "../../src/lib/prisma/generated";
import { AccessLevel } from "../../src/types/enums";

/*
 * Listing never grants or removes access; it only decides who sees an item in
 * lists. Editors see everything of theirs listed, readers only what is listed.
 */

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
