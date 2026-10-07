import { expect, test } from "playwright/test";

import { isGoalListed } from "../../src/lib/listing";
import { GoalListing } from "../../src/lib/prisma/generated";
import { AccessLevel } from "../../src/types/enums";

/*
 * Listing never grants or removes access; it only decides who sees an item in
 * lists. Editors see everything of theirs listed, readers only what is listed.
 */

test.describe("isGoalListed", () => {
  test("listed and featured goals are listed at every access level", () => {
    for (const listing of [GoalListing.LISTED, GoalListing.FEATURED]) {
      for (const level of Object.values(AccessLevel)) {
        expect(isGoalListed({ listing }, level), `${listing} at ${JSON.stringify(level)}`).toBe(true);
      }
    }
  });

  test("unlisted goals are only listed for editors", () => {
    expect(isGoalListed({ listing: GoalListing.UNLISTED }, AccessLevel.View)).toBe(false);
    expect(isGoalListed({ listing: GoalListing.UNLISTED }, AccessLevel.Edit)).toBe(true);
  });

  test("no access never lists an unlisted goal, admin always does", () => {
    expect(isGoalListed({ listing: GoalListing.UNLISTED }, AccessLevel.None)).toBe(false);
    expect(isGoalListed({ listing: GoalListing.UNLISTED }, AccessLevel.Admin)).toBe(true);
  });
});
