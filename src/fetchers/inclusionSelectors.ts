import { visibleEffectsWHERE, visibleSourceSeriesWHERE } from "@/lib/accessFilters";
import { GoalListing, type Prisma } from "@/lib/prisma/generated";
import type { UserAccessContext } from "@/types";

/*
 * Effects and the viewer: an effect joins an action and a goal that can sit under different
 * roadmaps (or the action under none), so a visible goal can have effects from actions the
 * viewer may not see, and the other way round. Every selection that reaches effects through a
 * goal or an action is therefore a function of the access context and narrows `effects` (and
 * `_count.effects`) with `visibleEffectsWHERE`: such an effect never leaves the database, with
 * its series and whatever it would say about the hidden side. `tests/unit/effect-selections.test.ts`
 * walks the selections and fails on an `effects` without the filter.
 */

/*
 * Sources and the viewer: a series can be computed by a recipe from other stored series (a goal
 * copied and scaled from a goal of another roadmap reads that goal's series), and the two need
 * not be visible to the same people. The computed values are the series' own. What it was
 * computed from is not: every selection that carries a series' recipe narrows
 * `source_data_series` with `visibleSourceSeriesWHERE`, and the readers pass their result through
 * `withoutHiddenSources` (`./hiddenSources`), which takes out a recipe that reads a series the
 * viewer did not get. `tests/unit/source-selections.test.ts` fails on a selection or a reader
 * that skips either.
 */

/**
 * The access control fields accessChecker needs: ownership org, sharing,
 * and the group grants. Group membership is resolved against the user's own
 * per-request access context, so grants only need the group id.
 */
export const accessControlSelection = {
  id: true,
  org_id: true,
  // The org name feeds the "visible to everyone in ..." line
  org: { select: { name: true } },
  sharing: true,
  grants: {
    select: {
      group_id: true,
      access_level: true,
    },
  },
} satisfies Prisma.AccessControlsSelect;

export const nameSelector = {
  name: true,
  id: true,
  iterations: {
    select: {
      version: true,
      id: true,
      roadmap: {
        select: {
          name: true,
          id: true,
        },
      },
      goals: {
        select: {
          name: true,
          indicator_parameter: true,
          id: true,
        },
      },
      actions: {
        select: {
          name: true,
          id: true,
        },
      },
    },
  },
} satisfies Prisma.RoadmapsSelect;

const dataSeriesInclusionSelection = (ctx: UserAccessContext | null) => ({
  recipe_used: {
    select: {
      id: true,
      // Replaced by an empty recipe when it reads a series left out below (see `withoutHiddenSources`)
      recipe: true,
      // The recipe's source data series (incl. materialized external data) so the
      // editor can read them as canon instead of re-fetching upstream APIs.
      // updated_at feeds the goal page's "a source is newer than this series" check.
      // Only the sources the viewer may get: seeing a series says nothing about its sources
      source_data_series: {
        where: visibleSourceSeriesWHERE(ctx),
        select: { id: true, unit: true, updated_at: true, values: { orderBy: { timestamp: "asc" } } },
      },
    },
  },
  values: {
    select: { timestamp: true, value: true },
    orderBy: { timestamp: "asc" },
  },
}) satisfies Prisma.DataSeriesSelect;

/** Full detail view of a top-level roadmap: its iterations, tree relations, comments, and access control. */
export const roadmapInclusionSelection = {
  geo_area: { select: { code: true, name: true, type: true } },
  iterations: {
    include: {
      // Displayed counts exclude unlisted goals
      _count: { select: { goals: { where: { listing: { not: GoalListing.UNLISTED } } } } },
      author: { select: { id: true, username: true, first_name: true, last_name: true } },
    },
  },
  child_roadmaps: {
    select: {
      id: true,
      name: true,
    },
  },
  comments: {
    include: {
      author: { select: { id: true, username: true, first_name: true, last_name: true } },
    },
  },
  author: { select: { id: true, username: true, first_name: true, last_name: true } },
  access_control: { select: accessControlSelection },
} satisfies Prisma.RoadmapsInclude;

/** Full detail view of a single roadmap iteration. Access control comes from the parent roadmap. */
export const roadmapIterationInclusionSelection = (ctx: UserAccessContext | null) => ({
  roadmap: {
    include: {
      access_control: { select: accessControlSelection },
      child_roadmaps: { select: { id: true, name: true } },
      geo_area: { select: { code: true, name: true, type: true } },
    },
  },
  // Displayed counts exclude unlisted goals; the goals list itself carries them
  // for users with edit access (filtered in the UI)
  _count: { select: { goals: { where: { listing: { not: GoalListing.UNLISTED } } } } },
  goals: {
    include: {
      // Counts follow what the viewer may see, like the lists they stand next to
      _count: { select: { effects: { where: visibleEffectsWHERE(ctx) } } },
      data_series: { include: dataSeriesInclusionSelection(ctx) },
      historical: { include: dataSeriesInclusionSelection(ctx) },
      author: { select: { id: true, username: true, first_name: true, last_name: true } },
      recipe_suggestions: true,
    },
  },
  actions: {
    include: {
      _count: { select: { effects: { where: visibleEffectsWHERE(ctx) } } },
      author: { select: { id: true, username: true, first_name: true, last_name: true } },
    },
  },
  comments: {
    include: {
      author: { select: { id: true, username: true, first_name: true, last_name: true } },
    },
  },
  attachments: {
    include: {
      author: { select: { id: true, username: true, first_name: true, last_name: true } },
    },
  },
  author: { select: { id: true, username: true, first_name: true, last_name: true } },
}) satisfies Prisma.RoadmapIterationsInclude;

/** "Client safe" versions should be used with `select: ` instead of `include: ` */
export const clientSafeRoadmapIterationSelection = (ctx: UserAccessContext | null) => ({
  id: true,
  description: true,
  version: true,
  target_version: true,
  status: true,
  roadmap: {
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      actor: true,
      parent_roadmap_id: true,
      geo_area: { select: { code: true, name: true, type: true } },
      access_control: { select: { sharing: true } },
    },
  },
  goals: {
    select: {
      id: true,
      name: true,
      description: true,
      indicator_parameter: true,
      listing: true,
      _count: { select: { effects: { where: visibleEffectsWHERE(ctx) } } },
      data_series: { include: dataSeriesInclusionSelection(ctx) },
      baseline: { include: dataSeriesInclusionSelection(ctx) },
      historical: { include: dataSeriesInclusionSelection(ctx) },
      effects: {
        where: visibleEffectsWHERE(ctx),
        select: {
          action_id: true,
          goal_id: true,
          data_series: { include: dataSeriesInclusionSelection(ctx) },
          action: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
  actions: {
    select: {
      id: true,
      name: true,
      indicator_parameter: true,
      start_year: true,
      end_year: true,
      roadmap_iteration_id: true,
      _count: { select: { effects: { where: visibleEffectsWHERE(ctx) } } },
    },
  },
  comments: {
    select: {
      id: true,
      comment_text: true,
      action_id: true,
      goal_id: true,
      roadmap_iteration_id: true,
      roadmap_id: true,
    },
  },
}) satisfies Prisma.RoadmapIterationsSelect;

/** List view of roadmap iterations, e.g. on browse pages. */
export const multiRoadmapInclusionSelection = {
  _count: {
    select: {
      // Displayed counts exclude unlisted goals
      goals: { where: { listing: { not: GoalListing.UNLISTED } } },
      actions: true,
    },
  },
  roadmap: {
    include: {
      access_control: { select: accessControlSelection },
      // Pickers label the roadmap with its area (see `roadmapPickerLabel`)
      geo_area: { select: { code: true, name: true, type: true } },
    },
  },
  author: { select: { id: true, username: true, first_name: true, last_name: true } },
} satisfies Prisma.RoadmapIterationsInclude;

/** "Client safe" versions should be used with `select: ` instead of `include: ` */
export const clientSafeMultiRoadmapSelection = {
  id: true,
  description: true,
  version: true,
  target_version: true,
  status: true,
  _count: {
    select: {
      // Displayed counts exclude unlisted goals
      goals: { where: { listing: { not: GoalListing.UNLISTED } } },
      actions: true,
    },
  },
  roadmap: {
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      actor: true,
      parent_roadmap_id: true,
      // The org name and area label the roadmap in pickers (see `roadmapPickerLabel`)
      access_control: { select: { sharing: true, org: { select: { name: true } } } },
      geo_area: { select: { name: true } },
    },
  },
} satisfies Prisma.RoadmapIterationsSelect;

export const goalInclusionSelection = (ctx: UserAccessContext | null) => ({
  _count: { select: { effects: { where: visibleEffectsWHERE(ctx) } } },
  recipe_suggestions: true,
  data_series: { include: dataSeriesInclusionSelection(ctx) },
  baseline: { include: dataSeriesInclusionSelection(ctx) },
  historical: { include: dataSeriesInclusionSelection(ctx) },
  effects: {
    // Only the effects of actions the viewer may see
    where: visibleEffectsWHERE(ctx),
    include: {
      data_series: { include: dataSeriesInclusionSelection(ctx) },
      action: {
        include: {
          roadmap_iteration: { select: { id: true } },
          author: { select: { id: true, username: true, first_name: true, last_name: true } },
        },
      },
    },
  },
  roadmap_iteration: {
    include: {
      roadmap: {
        select: {
          id: true,
          name: true,
          actor: true,
          parent_roadmap_id: true,
          type: true,
          geo_area: { select: { code: true, name: true, type: true } },
          access_control: { select: accessControlSelection },
        },
      },
    },
  },
  comments: {
    include: {
      author: { select: { id: true, username: true, first_name: true, last_name: true } },
    },
  },
  attachments: {
    include: {
      author: { select: { id: true, username: true, first_name: true, last_name: true } },
    },
  },
  author: { select: { id: true, username: true, first_name: true, last_name: true } },
}) satisfies Prisma.GoalsInclude;

/** "Client safe" versions should be used with `select: ` instead of `include: ` */
/** The plotted values of a series and its unit: all a related goal's graph needs. */
const plottedSeriesSelection = {
  unit: true,
  values: {
    select: { timestamp: true, value: true },
    orderBy: { timestamp: "asc" },
  },
} satisfies Prisma.DataSeriesSelect;

/**
 * A parent or child goal as the goal page's graphs use it: identity, the target and baseline
 * series and the effects' series (for the predicted outcome), and the roadmap name for labels.
 */
export const relatedGoalSelection = (ctx: UserAccessContext | null) => ({
  id: true,
  name: true,
  indicator_parameter: true,
  roadmap_iteration_id: true,
  data_series: { select: plottedSeriesSelection },
  baseline: { select: plottedSeriesSelection },
  effects: {
    where: visibleEffectsWHERE(ctx),
    select: {
      impact_type: true,
      data_series: { select: plottedSeriesSelection },
      // Sort key (effectSorter), so summed outcomes add up in the same order as on the goal's own page
      action: { select: { name: true } },
    },
  },
  roadmap_iteration: { select: { roadmap: { select: { name: true } } } },
}) satisfies Prisma.GoalsSelect;

/** A sibling candidate on the goal page (`findSiblings` makes the final match). */
export const siblingGoalSelection = {
  id: true,
  name: true,
  indicator_parameter: true,
  listing: true,
  data_series: { select: plottedSeriesSelection },
} satisfies Prisma.GoalsSelect;

export const clientSafeGoalSelection = (ctx: UserAccessContext | null) => ({
  id: true,
  name: true,
  description: true,
  indicator_parameter: true,
  listing: true,
  roadmap_iteration_id: true,
  data_series: { include: dataSeriesInclusionSelection(ctx) },
  baseline: { include: dataSeriesInclusionSelection(ctx) },
  historical: { include: dataSeriesInclusionSelection(ctx) },
  _count: { select: { effects: { where: visibleEffectsWHERE(ctx) } } },
}) satisfies Prisma.GoalsSelect;

export const clientSafeDataSeriesSelection = {
  id: true,
  unit: true,
  values: { orderBy: { timestamp: "asc" } },
} satisfies Prisma.DataSeriesSelect;

export const actionInclusionSelection = (ctx: UserAccessContext | null) => ({
  effects: {
    // Only the effects on goals the viewer may see
    where: visibleEffectsWHERE(ctx),
    include: {
      data_series: { include: dataSeriesInclusionSelection(ctx) },
      goal: {
        include: {
          roadmap_iteration: { select: { id: true } },
          author: { select: { id: true, username: true, first_name: true, last_name: true } },
        },
      },
    },
  },
  // Nullable: actions without an iteration live in the public action database
  roadmap_iteration: {
    select: {
      id: true,
      version: true,
      roadmap_id: true,
      status: true,
      author: { select: { id: true, username: true, first_name: true, last_name: true } },
      roadmap: {
        select: {
          id: true,
          name: true,
          access_control: { select: accessControlSelection },
        },
      },
    },
  },
  comments: { include: { author: { select: { id: true, username: true, first_name: true, last_name: true } } } },
  attachments: { include: { author: { select: { id: true, username: true, first_name: true, last_name: true } } } },
  author: { select: { id: true, username: true, first_name: true, last_name: true } },
  fields: { orderBy: { order: 'asc' as const } },
}) satisfies Prisma.ActionsInclude;

/** What an action list card shows (see the `Actions` section); `getActionSummaries` selects only this. */
export const actionSummarySelection = {
  id: true,
  name: true,
  start_year: true,
  end_year: true,
  origin_action_id: true,
  // What edit access hangs on: the roadmap version, or the owning org for roadmapless actions
  org_id: true,
  roadmap_iteration_id: true,
  author: { select: { username: true, first_name: true, last_name: true } },
  fields: { select: { header: true, value: true, type: true }, orderBy: { order: 'asc' as const } },
} satisfies Prisma.ActionsSelect;

export const effectInclusionSelection = (ctx: UserAccessContext | null) => ({
  data_series: { include: dataSeriesInclusionSelection(ctx) },
  // `select` (not `include`) on action/goal: the effect edit flow only needs their
  // identity (for the selectors + breadcrumb) and their roadmap's access control
  // (for accessChecker). This keeps links, comments, nested effects, authors,
  // and every other field of the parent action/goal off the wire to the client.
  action: {
    select: {
      id: true,
      name: true,
      // The owning org decides edit access for roadmapless actions (the public action database)
      org_id: true,
      // Present (if empty) so consumers can tell actions from goals by the fields list
      fields: { select: { id: true } },
      roadmap_iteration_id: true,
      roadmap_iteration: {
        select: {
          id: true,
          version: true,
          roadmap_id: true,
          status: true,
          roadmap: {
            select: {
              id: true,
              name: true,
              access_control: { select: accessControlSelection },
            },
          },
        },
      },
    },
  },
  goal: {
    select: {
      id: true,
      roadmap_iteration_id: true,
      roadmap_iteration: {
        select: {
          status: true,
          roadmap: {
            select: {
              access_control: { select: accessControlSelection },
            },
          },
        },
      },
    },
  },
}) satisfies Prisma.EffectsInclude;

export const userInfoSelector = {
  id: true,
  username: true,
  first_name: true,
  last_name: true,
  authored_roadmaps: {
    // TODO: Select/include less data to lighten load on database
    include: roadmapInclusionSelection,
  },
  authored_roadmap_iterations: {
    include: multiRoadmapInclusionSelection,
  },
} satisfies Prisma.UsersSelect;

export const recipeSelector = {
  id: true,
  recipe: true,
} satisfies Prisma.RecipesSelect;
