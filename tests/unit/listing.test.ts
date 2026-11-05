import { expect, test } from "playwright/test";

import { isGoalListed, isRoadmapListed } from "../../src/lib/listing";
import { GoalListing } from "../../src/lib/prisma/generated";
import { AccessLevel, HiddenRoadmaps } from "../../src/types/enums";

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

test.describe("isRoadmapListed", () => {
  test("roadmaps that aren't hidden are listed in every mode and at every access level", () => {
    for (const mode of Object.values(HiddenRoadmaps)) {
      for (const level of Object.values(AccessLevel)) {
        expect(isRoadmapListed({ hidden: false }, level, mode), `${mode} at ${JSON.stringify(level)}`).toBe(true);
      }
    }
  });

  test("hidden roadmaps stay out of listings, even for their admins", () => {
    for (const level of Object.values(AccessLevel)) {
      expect(isRoadmapListed({ hidden: true }, level, HiddenRoadmaps.Exclude), JSON.stringify(level)).toBe(false);
    }
  });

  test("\"show hidden\" brings back the hidden roadmaps the user can edit, lookups include all", () => {
    expect(isRoadmapListed({ hidden: true }, AccessLevel.View, HiddenRoadmaps.Writable)).toBe(false);
    expect(isRoadmapListed({ hidden: true }, AccessLevel.Edit, HiddenRoadmaps.Writable)).toBe(true);
    expect(isRoadmapListed({ hidden: true }, AccessLevel.Admin, HiddenRoadmaps.Writable)).toBe(true);
    expect(isRoadmapListed({ hidden: true }, AccessLevel.View, HiddenRoadmaps.Include)).toBe(true);
  });
});
