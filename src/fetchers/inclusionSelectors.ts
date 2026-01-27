import { Prisma } from "@/prisma/generated";

export const nameSelector = {
  name: true,
  id: true,
  roadmapVersions: {
    select: {
      version: true,
      id: true,
      metaRoadmap: {
        select: {
          name: true,
          id: true,
        },
      },
      goals: {
        select: {
          name: true,
          indicatorParameter: true,
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
} satisfies Prisma.MetaRoadmapSelect;

export const metaRoadmapInclusionSelection = {
  roadmapVersions: {
    include: {
      metaRoadmap: {
        include: {
          childRoadmaps: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      _count: { select: { goals: true } },
      author: { select: { id: true, username: true } },
      editors: { select: { id: true, username: true } },
      viewers: { select: { id: true, username: true } },
      editGroups: { include: { users: { select: { id: true, username: true } } } },
      viewGroups: { include: { users: { select: { id: true, username: true } } } },
    },
  },
  childRoadmaps: {
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
  links: true,
  author: { select: { id: true, username: true } },
  editors: { select: { id: true, username: true } },
  viewers: { select: { id: true, username: true } },
  editGroups: { include: { users: { select: { id: true, username: true } } } },
  viewGroups: { include: { users: { select: { id: true, username: true } } } },
} satisfies Prisma.MetaRoadmapInclude;

export const roadmapInclusionSelection = {
  metaRoadmap: true,
  _count: { select: { goals: true, } },
  goals: {
    include: {
      _count: { select: { effects: true } },
      dataSeries: true,
      author: { select: { id: true, username: true } },
      recipeSuggestions: true,
    }
  },
  actions: {
    include: {
      _count: { select: { effects: true } },
      author: { select: { id: true, username: true } },
    }
  },
  comments: {
    include: {
      author: { select: { id: true, username: true } },
    },
  },
  author: { select: { id: true, username: true } },
  editors: { select: { id: true, username: true } },
  viewers: { select: { id: true, username: true } },
  editGroups: { include: { users: { select: { id: true, username: true } } } },
  viewGroups: { include: { users: { select: { id: true, username: true } } } },
} satisfies Prisma.RoadmapInclude;

/** "Client safe" versions should be used with `select: ` instead of `include: ` */
export const clientSafeRoadmapSelection = {
  id: true,
  description: true,
  version: true,
  targetVersion: true,
  isPublic: true,
  metaRoadmap: {
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      actor: true,
      parentRoadmapId: true,
      isPublic: true,
    }
  },
  goals: {
    select: {
      id: true,
      name: true,
      description: true,
      indicatorParameter: true,
      isFeatured: true,
      externalDataset: true,
      externalTableId: true,
      externalSelection: true,
      _count: { select: { effects: true } },
      dataSeries: {
        select: {
          id: true,
          unit: true,
          values: true,
        }
      },
    }
  },
  actions: {
    select: {
      id: true,
      name: true,
      description: true,
      startYear: true,
      endYear: true,
      costEfficiency: true,
      expectedOutcome: true,
      isSufficiency: true,
      isEfficiency: true,
      isRenewables: true,
      roadmapId: true,
      _count: { select: { effects: true } },
    }
  },
  comments: {
    select: {
      id: true,
      commentText: true,
      actionId: true,
      goalId: true,
      roadmapId: true,
      metaRoadmapId: true,
    },
  },
} satisfies Prisma.RoadmapSelect;

export const multiRoadmapInclusionSelection = {
  _count: {
    select: {
      goals: true,
      actions: true,
    }
  },
  metaRoadmap: true,
  author: { select: { id: true, username: true } },
  editors: { select: { id: true, username: true } },
  viewers: { select: { id: true, username: true } },
  editGroups: { include: { users: { select: { id: true, username: true } } } },
  viewGroups: { include: { users: { select: { id: true, username: true } } } },
} satisfies Prisma.RoadmapInclude;

/** "Client safe" versions should be used with `select: ` instead of `include: ` */
export const clientSafeMultiRoadmapSelection = {
  id: true,
  description: true,
  version: true,
  targetVersion: true,
  isPublic: true,
  _count: {
    select: {
      goals: true,
      actions: true,
    }
  },
  metaRoadmap: {
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      actor: true,
      parentRoadmapId: true,
      isPublic: true,
    }
  },
} satisfies Prisma.RoadmapSelect;

export const dataSeriesInclusionSelection = { values: { select: { timestamp: true, value: true, } } } satisfies Prisma.DataSeriesSelect;

export const goalInclusionSelection = {
  _count: { select: { effects: true } },
  recipeSuggestions: true,
  dataSeries: { include: dataSeriesInclusionSelection, },
  baseline: { include: dataSeriesInclusionSelection, },
  effects: {
    include: {
      dataSeries: { include: dataSeriesInclusionSelection, },
      action: {
        include: {
          roadmap: { select: { id: true } },
          author: { select: { id: true, username: true } },
        },
      },
    }
  },
  roadmap: {
    include: {
      metaRoadmap: {
        select: {
          id: true,
          name: true,
          parentRoadmapId: true,
        },
      },
      author: { select: { id: true, username: true } },
      editors: { select: { id: true, username: true } },
      viewers: { select: { id: true, username: true } },
      editGroups: { select: { id: true, name: true, users: { select: { id: true, username: true } } } },
      viewGroups: { select: { id: true, name: true, users: { select: { id: true, username: true } } } },
    },
  },
  links: true,
  comments: {
    include: {
      author: { select: { id: true, username: true } },
    },
  },
  author: { select: { id: true, username: true } },
} satisfies Prisma.GoalInclude;

/** "Client safe" versions should be used with `select: ` instead of `include: ` */
export const clientSafeGoalSelection = {
  id: true,
  name: true,
  description: true,
  indicatorParameter: true,
  isFeatured: true,
  externalDataset: true,
  externalTableId: true,
  externalSelection: true,
  roadmapId: true,
  dataSeries: {
    select: {
      id: true,
      unit: true,
      values: true,
    }
  },
  _count: { select: { effects: true } },
} satisfies Prisma.GoalSelect;

export const clientSafeDataSeriesSelection = {
  id: true,
  unit: true,
  values: true,
} satisfies Prisma.DataSeriesSelect;

export const actionInclusionSelection = {
  effects: {
    include: {
      dataSeries: true,
      goal: {
        include: {
          roadmap: { select: { id: true } },
          author: { select: { id: true, username: true } },
        }
      },
    }
  },
  roadmap: {
    select: {
      id: true,
      version: true,
      author: { select: { id: true, username: true } },
      editors: { select: { id: true, username: true } },
      viewers: { select: { id: true, username: true } },
      editGroups: { include: { users: { select: { id: true, username: true } } } },
      viewGroups: { include: { users: { select: { id: true, username: true } } } },
      isPublic: true,
      metaRoadmap: {
        select: {
          id: true,
          name: true,
        }
      }
    }
  },
  notes: true,
  links: true,
  comments: { include: { author: { select: { id: true, username: true } } } },
  author: { select: { id: true, username: true } },
} satisfies Prisma.ActionInclude;

export const effectInclusionSelection = {
  dataSeries: { include: dataSeriesInclusionSelection, },
  action: {
    include: actionInclusionSelection,
  },
  goal: {
    include: goalInclusionSelection,
  },
} satisfies Prisma.EffectInclude;

export const userInfoSelector = {
  id: true,
  username: true,
  authoredMetaRoadmaps: {
    // TODO: Select/include less data to lighten load on database
    include: metaRoadmapInclusionSelection,
  },
  authoredRoadmaps: {
    include: multiRoadmapInclusionSelection,
  },
} satisfies Prisma.UserSelect;