import { dataSeriesDataFieldNames } from "@/types";
import { Prisma } from "@prisma/client";

const dataFieldSelector = dataSeriesDataFieldNames.reduce((acc, field) => {
  acc[field] = true;
  return acc;
}, {} as Partial<Prisma.DataSeriesSelect>);

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

export const metaRoadmapInclusionSelection /* Prisma.MetaRoadmapInclude */ = {
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

export const roadmapInclusionSelection /* Prisma.RoadmapInclude */ = {
  metaRoadmap: true,
  goals: {
    include: {
      _count: { select: { effects: true, combinationParents: true } },
      dataSeries: true,
      author: { select: { id: true, username: true } },
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
      combinationScale: true,
      _count: { select: { effects: true, combinationParents: true } },
      dataSeries: {
        select: {
          id: true,
          unit: true,
          // All yearly data fields
          ...dataFieldSelector,
          // DEPRECATED, remove once database is updated
          scale: true,
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
  baselineDataSeries: true,
  combinationParents: {
    include: {
      parentGoal: {
        select: {
          id: true,
          dataSeries: true,
          roadmapId: true,
        },
      },
    },
  },
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
  combinationScale: true,
  roadmapId: true,
  _count: { select: { effects: true } },
  dataSeries: {
    select: {
      id: true,
      unit: true,
      // All yearly data fields
      ...dataFieldSelector,
      // DEPRECATED, remove once database is updated
      scale: true,
    }
  },
  baselineDataSeries: {
    select: {
      id: true,
      unit: true,
      // All yearly data fields
      ...dataFieldSelector,
      // DEPRECATED, remove once database is updated
      scale: true,
    }
  },
  combinationParents: {
    select: {
      resultingGoalId: true,
      parentGoalId: true,
      isInverted: true,
      parentGoal: {
        select: {
          id: true,
          dataSeries: {
            select: {
              id: true,
              unit: true,
              // All yearly data fields
              ...dataFieldSelector,
              // DEPRECATED, remove once database is updated
              scale: true,
            }
          },
          roadmapId: true,
        },
      },
    },
  },
  effects: {
    select: {
      impactType: true,
      actionId: true,
      goalId: true,
      action: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      dataSeries: {
        select: {
          id: true,
          unit: true,
          // All yearly data fields
          ...dataFieldSelector,
          // DEPRECATED, remove once database is updated
          scale: true,
        }
      },
    }
  },
  roadmap: {
    select: {
      id: true,
      version: true,
      targetVersion: true,
      metaRoadmap: {
        select: {
          id: true,
          name: true,
          parentRoadmapId: true,
        },
      },
    },
  },
  links: true,
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