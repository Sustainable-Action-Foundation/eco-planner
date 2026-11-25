import { expect, test } from "playwright/test";

import { OrgGap, orgGaps, ProfileField } from "../../src/functions/orgGaps";
import type { OrgGapsInput } from "../../src/functions/orgGaps";

/*
 * The working view's "gaps" list is derived, a fixed small set. A gap is listed
 * only when the data says so, and the managers' gaps only for managers.
 */

/** An org with nothing missing, seen by a manager */
const complete: OrgGapsInput = {
  manages: true,
  visibleRoadmapCount: 2,
  hiddenRoadmapCount: 0,
  likedWithoutGoalCount: 0,
  hasArea: true,
  profile: { description: true, orgType: true, contact: true, banner: true },
  memberCount: 9,
  membersWithoutLikes: 0,
};

function gapsOf(changes: Partial<OrgGapsInput>): OrgGap[] {
  return orgGaps({ ...complete, ...changes }).map(item => item.gap);
}

test("nothing missing, no gaps", () => {
  expect(orgGaps(complete)).toEqual([]);
  expect(orgGaps({ ...complete, manages: false })).toEqual([]);
});

test("no visible roadmap, with how many hidden ones the viewer can bring back", () => {
  expect(orgGaps({ ...complete, visibleRoadmapCount: 0, hiddenRoadmapCount: 1 })).toEqual([{ gap: OrgGap.NoVisibleRoadmap, hiddenRoadmapCount: 1 }]);
  expect(gapsOf({ visibleRoadmapCount: 0, manages: false })).toEqual([OrgGap.NoVisibleRoadmap]);
  // Hidden roadmaps alone are no gap while something is visible
  expect(gapsOf({ hiddenRoadmapCount: 3 })).toEqual([]);
});

test("liked goals the org has no goal of its own for", () => {
  expect(orgGaps({ ...complete, likedWithoutGoalCount: 13 })).toEqual([{ gap: OrgGap.LikedWithoutGoal, count: 13 }]);
  expect(gapsOf({ likedWithoutGoalCount: 13, manages: false })).toEqual([OrgGap.LikedWithoutGoal]);
});

test("the profile gap names the missing parts, for managers only", () => {
  expect(orgGaps({ ...complete, profile: { description: false, orgType: true, contact: false, banner: true } }))
    .toEqual([{ gap: OrgGap.EmptyProfile, missing: [ProfileField.Description, ProfileField.Contact] }]);
  expect(orgGaps({ ...complete, profile: { description: false, orgType: false, contact: false, banner: false } })[0])
    .toEqual({ gap: OrgGap.EmptyProfile, missing: [ProfileField.Description, ProfileField.OrgType, ProfileField.Contact, ProfileField.Banner] });
  expect(gapsOf({ manages: false, profile: { description: false, orgType: false, contact: false, banner: false } })).toEqual([]);
});

test("members who have not liked anything, for managers only and only when known", () => {
  expect(orgGaps({ ...complete, membersWithoutLikes: 6 })).toEqual([{ gap: OrgGap.MembersWithoutLikes, count: 6, memberCount: 9 }]);
  expect(gapsOf({ membersWithoutLikes: 6, manages: false })).toEqual([]);
  expect(gapsOf({ membersWithoutLikes: null })).toEqual([]);
  expect(gapsOf({ membersWithoutLikes: 6, memberCount: null })).toEqual([]);
});

test("no area, for managers only", () => {
  expect(orgGaps({ ...complete, hasArea: false })).toEqual([{ gap: OrgGap.NoArea }]);
  expect(gapsOf({ hasArea: false, manages: false })).toEqual([]);
});

test("everything missing comes in a fixed order", () => {
  expect(gapsOf({
    visibleRoadmapCount: 0,
    likedWithoutGoalCount: 2,
    hasArea: false,
    profile: { description: false, orgType: false, contact: false, banner: false },
    membersWithoutLikes: 9,
  })).toEqual([OrgGap.NoVisibleRoadmap, OrgGap.LikedWithoutGoal, OrgGap.NoArea, OrgGap.EmptyProfile, OrgGap.MembersWithoutLikes]);
});
