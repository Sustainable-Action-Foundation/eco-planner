// import { Prisma } from "@prisma/client";

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