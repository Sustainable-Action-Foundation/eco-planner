import { Years } from "@/types";
import { Prisma } from "@prisma/client";

const dataFieldSelector = Years.reduce((acc, field) => {
  acc[field] = true;
  return acc;
}, {} as Record<typeof Years[number], boolean>);

export const nameSelector /* Prisma.MetaRoadmapSelect */ = {
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
};

export const metaRoadmapInclusionSelection = {
  // export const metaRoadmapInclusionSelection: Prisma.MetaRoadmapInclude = {
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
};

export const roadmapInclusionSelection = {
  // export const roadmapInclusionSelection: Prisma.RoadmapInclude = {
  metaRoadmap: true,
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
};

/** "Client safe" versions should be used with `select: ` instead of `include: ` */
export const clientSafeRoadmapSelection /* Prisma.RoadmapSelect */ = {
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
          // All yearly data fields
          ...dataFieldSelector,
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
};

export const multiRoadmapInclusionSelection /* Prisma.RoadmapInclude */ = {
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
}

/** "Client safe" versions should be used with `select: ` instead of `include: ` */
export const clientSafeMultiRoadmapSelection /* Prisma.RoadmapSelect */ = {
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
}

export const goalInclusionSelection /* Prisma.GoalInclude */ = {
  _count: { select: { effects: true } },
  dataSeries: true,
  recipeSuggestions: true,
  baselineDataSeries: true,
  effects: {
    include: {
      dataSeries: true,
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
};

/** "Client safe" versions should be used with `select: ` instead of `include: ` */
export const clientSafeGoalSelection /* Prisma.GoalSelect */ = {
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
      ...dataFieldSelector,
    }
  },
  _count: { select: { effects: true } },
}

export const clientSafeDataSeriesSelection /* Prisma.DataSeriesSelect */ = {
  ...dataFieldSelector,
  id: true,
  unit: true,
};

export const actionInclusionSelection /* Prisma.ActionInclude */ = {
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
};

export const effectInclusionSelection /* Prisma.EffectInclude */ = {
  dataSeries: true,
  action: {
    include: actionInclusionSelection,
  },
  goal: {
    include: goalInclusionSelection,
  },
}

export const userInfoSelector /* Prisma.UserSelect */ = {
  id: true,
  username: true,
  authoredMetaRoadmaps: {
    // TODO: Select/include less data to lighten load on database
    include: metaRoadmapInclusionSelection,
  },
  authoredRoadmaps: {
    include: multiRoadmapInclusionSelection,
  },
}