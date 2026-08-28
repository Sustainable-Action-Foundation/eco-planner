import { GoalVisibility } from "@/types/enums";

/** The two goal flags the visibility setting is derived from and written back to. */
export type GoalVisibilityFlags = { is_featured: boolean; is_unlisted: boolean };

/**
 * Collapses a goal's listing flags into one {@link GoalVisibility}. Unlisted wins
 * over featured: an unlisted goal stays out of the featured strip regardless of
 * the flag, so showing it as featured would misrepresent what the reader sees.
 */
export function goalVisibilityFromFlags(goal: GoalVisibilityFlags): GoalVisibility {
  if (goal.is_unlisted) return GoalVisibility.Unlisted;
  if (goal.is_featured) return GoalVisibility.Featured;
  return GoalVisibility.Public;
}

/** The flag values (in API field names) that make a goal show up as the given visibility. */
export function goalVisibilityToFlags(visibility: GoalVisibility): { isFeatured: boolean; isUnlisted: boolean } {
  switch (visibility) {
    case GoalVisibility.Unlisted: {
      return { isFeatured: false, isUnlisted: true };
    }
    case GoalVisibility.Featured: {
      return { isFeatured: true, isUnlisted: false };
    }
    case GoalVisibility.Public: {
      return { isFeatured: false, isUnlisted: false };
    }
    default: {
      const exhaustive: never = visibility;
      throw new Error(`Unhandled goal visibility: ${String(exhaustive)}`);
    }
  }
}

export function isGoalVisibility(value: unknown): value is GoalVisibility {
  return typeof value === "string" && (Object.values(GoalVisibility) as string[]).includes(value);
}
