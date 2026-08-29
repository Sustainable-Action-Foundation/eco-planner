import { IterationVisibility } from "@/types/enums";

/** The two iteration fields the visibility setting is derived from and written back to. */
export type IterationVisibilityFields = { published_at: Date | null; is_unlisted: boolean };

/**
 * Collapses an iteration's publication fields into one {@link IterationVisibility}.
 * Drafts are invisible to non-editors regardless of the listing flag, so draft
 * wins over unlisted.
 */
export function iterationVisibilityFromFields(iteration: IterationVisibilityFields): IterationVisibility {
  if (!iteration.published_at) return IterationVisibility.Draft;
  if (iteration.is_unlisted) return IterationVisibility.Unlisted;
  return IterationVisibility.Public;
}

/** The API field values (publish / isUnlisted) that put an iteration in the given visibility. */
export function iterationVisibilityToFields(visibility: IterationVisibility): { publish: boolean; isUnlisted: boolean } {
  switch (visibility) {
    case IterationVisibility.Draft: {
      return { publish: false, isUnlisted: false };
    }
    case IterationVisibility.Unlisted: {
      return { publish: true, isUnlisted: true };
    }
    case IterationVisibility.Public: {
      return { publish: true, isUnlisted: false };
    }
    default: {
      const exhaustive: never = visibility;
      throw new Error(`Unhandled iteration visibility: ${String(exhaustive)}`);
    }
  }
}

export function isIterationVisibility(value: unknown): value is IterationVisibility {
  return typeof value === "string" && (Object.values(IterationVisibility) as string[]).includes(value);
}
