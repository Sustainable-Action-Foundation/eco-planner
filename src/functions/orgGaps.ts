// No `server-only` marker: pure, unit tested.

/** The gaps the working view's overview can point out, in the order they are listed */
export const OrgGap = {
  NoVisibleRoadmap: "NO_VISIBLE_ROADMAP",
  LikedWithoutGoal: "LIKED_WITHOUT_GOAL",
  NoArea: "NO_AREA",
  EmptyProfile: "EMPTY_PROFILE",
  MembersWithoutLikes: "MEMBERS_WITHOUT_LIKES",
} as const;
export type OrgGap = (typeof OrgGap)[keyof typeof OrgGap];

/** The parts of the public profile a manager can fill in */
export const ProfileField = {
  Description: "DESCRIPTION",
  OrgType: "ORG_TYPE",
  Contact: "CONTACT",
  Banner: "BANNER",
} as const;
export type ProfileField = (typeof ProfileField)[keyof typeof ProfileField];

export type OrgGapsInput = {
  /** Whether the viewer manages the org; the profile, member and area gaps are theirs to close */
  manages: boolean,
  /** The org's roadmaps that show in listings */
  visibleRoadmapCount: number,
  /** The org's hidden roadmaps the viewer can write to */
  hiddenRoadmapCount: number,
  /** Goals of other orgs the org's members have liked that no goal of the org is derived from */
  likedWithoutGoalCount: number,
  hasArea: boolean,
  profile: { description: boolean, orgType: boolean, contact: boolean, banner: boolean },
  /** Null when the viewer may not know (see `getOrgPeople`): the gap is then left out, not guessed */
  memberCount: number | null,
  membersWithoutLikes: number | null,
};

export type OrgGapItem =
  | { gap: typeof OrgGap.NoVisibleRoadmap, hiddenRoadmapCount: number }
  | { gap: typeof OrgGap.LikedWithoutGoal, count: number }
  | { gap: typeof OrgGap.NoArea }
  | { gap: typeof OrgGap.EmptyProfile, missing: ProfileField[] }
  | { gap: typeof OrgGap.MembersWithoutLikes, count: number, memberCount: number };

/**
 * What is missing in the org's work, as a short fixed list derived from its data.
 * A gap is only listed when the data says so; one the viewer can't act on or may
 * not know about is left out.
 */
export function orgGaps(input: OrgGapsInput): OrgGapItem[] {
  const gaps: OrgGapItem[] = [];

  if (input.visibleRoadmapCount === 0) {
    gaps.push({ gap: OrgGap.NoVisibleRoadmap, hiddenRoadmapCount: input.hiddenRoadmapCount });
  }

  if (input.likedWithoutGoalCount > 0) {
    gaps.push({ gap: OrgGap.LikedWithoutGoal, count: input.likedWithoutGoalCount });
  }

  if (input.manages) {
    if (!input.hasArea) {
      gaps.push({ gap: OrgGap.NoArea });
    }

    const missing: ProfileField[] = [
      ...(input.profile.description ? [] : [ProfileField.Description]),
      ...(input.profile.orgType ? [] : [ProfileField.OrgType]),
      ...(input.profile.contact ? [] : [ProfileField.Contact]),
      ...(input.profile.banner ? [] : [ProfileField.Banner]),
    ];
    if (missing.length > 0) {
      gaps.push({ gap: OrgGap.EmptyProfile, missing });
    }

    if (input.memberCount !== null && input.membersWithoutLikes !== null && input.membersWithoutLikes > 0) {
      gaps.push({ gap: OrgGap.MembersWithoutLikes, count: input.membersWithoutLikes, memberCount: input.memberCount });
    }
  }

  return gaps;
}
