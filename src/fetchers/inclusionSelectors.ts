import type { Prisma } from "@/lib/prisma/generated";

/**
 * The access control fields accessChecker needs: ownership org, visibility flags,
 * and the group grants. Group membership is resolved against the user's own
 * per-request access context, so grants only need the group id.
 */
export const accessControlSelection = {
  id: true,
  org_id: true,
  is_public: true,
  org_readable: true,
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

const dataSeriesInclusionSelection = {
  recipe_used: {
    select: {
      id: true,
      recipe: true,
      // The recipe's source data series (incl. materialized external data) so the
      // editor can read them as canon instead of re-fetching upstream APIs.
      source_data_series: { select: { id: true, unit: true, values: true } },
    },
  },
  values: {
    select: { timestamp: true, value: true },
  },
} satisfies Prisma.DataSeriesSelect;

/** Full detail view of a top-level roadmap: its iterations, tree relations, comments, and access control. */
export const roadmapInclusionSelection = {
  iterations: {
    include: {
      // Displayed counts exclude unlisted goals
      _count: { select: { goals: { where: { is_unlisted: false } } } },
      author: { select: { id: true, username: true } },
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
      author: { select: { id: true, username: true } },
    },
  },
  author: { select: { id: true, username: true } },
  access_control: { select: accessControlSelection },
} satisfies Prisma.RoadmapsInclude;

/** Full detail view of a single roadmap iteration. Access control comes from the parent roadmap. */
export const roadmapIterationInclusionSelection = {
  roadmap: {
    include: {
      access_control: { select: accessControlSelection },
      child_roadmaps: { select: { id: true, name: true } },
    },
  },
  // Displayed counts exclude unlisted goals; the goals list itself carries them
  // for users with edit access (filtered in the UI)
  _count: { select: { goals: { where: { is_unlisted: false } } } },
  goals: {
    include: {
      _count: { select: { effects: true } },
      data_series: { include: dataSeriesInclusionSelection },
      historical: { include: dataSeriesInclusionSelection },
      author: { select: { id: true, username: true } },
      recipe_suggestions: true,
    },
  },
  actions: {
    include: {
      _count: { select: { effects: true } },
      author: { select: { id: true, username: true } },
    },
  },
  comments: {
    include: {
      author: { select: { id: true, username: true } },
    },
  },
  author: { select: { id: true, username: true } },
} satisfies Prisma.RoadmapIterationsInclude;

/** "Client safe" versions should be used with `select: ` instead of `include: ` */
export const clientSafeRoadmapIterationSelection = {
  id: true,
  description: true,
  version: true,
  target_version: true,
  published_at: true,
  roadmap: {
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      actor: true,
      parent_roadmap_id: true,
      access_control: { select: { is_public: true } },
    },
  },
  goals: {
    select: {
      id: true,
      name: true,
      description: true,
      indicator_parameter: true,
      is_featured: true,
      is_unlisted: true,
      _count: { select: { effects: true } },
      data_series: { include: dataSeriesInclusionSelection },
      baseline: { include: dataSeriesInclusionSelection },
      historical: { include: dataSeriesInclusionSelection },
      effects: {
        select: {
          action_id: true,
          goal_id: true,
          data_series: { include: dataSeriesInclusionSelection },
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
      _count: { select: { effects: true } },
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
} satisfies Prisma.RoadmapIterationsSelect;

/** List view of roadmap iterations, e.g. on browse pages. */
export const multiRoadmapInclusionSelection = {
  _count: {
    select: {
      // Displayed counts exclude unlisted goals
      goals: { where: { is_unlisted: false } },
      actions: true,
    },
  },
  roadmap: {
    include: {
      access_control: { select: accessControlSelection },
    },
  },
  author: { select: { id: true, username: true } },
} satisfies Prisma.RoadmapIterationsInclude;

/** "Client safe" versions should be used with `select: ` instead of `include: ` */
export const clientSafeMultiRoadmapSelection = {
  id: true,
  description: true,
  version: true,
  target_version: true,
  published_at: true,
  _count: {
    select: {
      // Displayed counts exclude unlisted goals
      goals: { where: { is_unlisted: false } },
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
      access_control: { select: { is_public: true } },
    },
  },
} satisfies Prisma.RoadmapIterationsSelect;

export const goalInclusionSelection = {
  _count: { select: { effects: true } },
  recipe_suggestions: true,
  data_series: { include: dataSeriesInclusionSelection },
  baseline: { include: dataSeriesInclusionSelection },
  historical: { include: dataSeriesInclusionSelection },
  effects: {
    include: {
      data_series: { include: dataSeriesInclusionSelection },
      action: {
        include: {
          roadmap_iteration: { select: { id: true } },
          author: { select: { id: true, username: true } },
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
          parent_roadmap_id: true,
          access_control: { select: accessControlSelection },
        },
      },
    },
  },
  comments: {
    include: {
      author: { select: { id: true, username: true } },
    },
  },
  author: { select: { id: true, username: true } },
} satisfies Prisma.GoalsInclude;

/** "Client safe" versions should be used with `select: ` instead of `include: ` */
export const clientSafeGoalSelection = {
  id: true,
  name: true,
  description: true,
  indicator_parameter: true,
  is_featured: true,
  is_unlisted: true,
  roadmap_iteration_id: true,
  data_series: { include: dataSeriesInclusionSelection },
  baseline: { include: dataSeriesInclusionSelection },
  historical: { include: dataSeriesInclusionSelection },
  _count: { select: { effects: true } },
} satisfies Prisma.GoalsSelect;

export const clientSafeDataSeriesSelection = {
  id: true,
  unit: true,
  values: true,
} satisfies Prisma.DataSeriesSelect;

export const actionInclusionSelection = {
  effects: {
    include: {
      data_series: { include: dataSeriesInclusionSelection },
      goal: {
        include: {
          roadmap_iteration: { select: { id: true } },
          author: { select: { id: true, username: true } },
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
      published_at: true,
      author: { select: { id: true, username: true } },
      roadmap: {
        select: {
          id: true,
          name: true,
          access_control: { select: accessControlSelection },
        },
      },
    },
  },
  comments: { include: { author: { select: { id: true, username: true } } } },
  author: { select: { id: true, username: true } },
  fields: { orderBy: { order: 'asc' as const } },
} satisfies Prisma.ActionsInclude;

export const effectInclusionSelection = {
  data_series: { include: dataSeriesInclusionSelection },
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
          published_at: true,
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
          published_at: true,
          roadmap: {
            select: {
              access_control: { select: accessControlSelection },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.EffectsInclude;

export const userInfoSelector = {
  id: true,
  username: true,
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
