export const RoadmapType = {
  NATIONAL: "NATIONAL",
  REGIONAL: "REGIONAL",
  MUNICIPAL: "MUNICIPAL",
  LOCAL: "LOCAL",
  ORGANIZATIONAL: "ORGANIZATIONAL",
  OTHER: "OTHER",
} as const;

export type RoadmapType = (typeof RoadmapType)[keyof typeof RoadmapType];

export const ActionImpactType = {
  PERCENT: "PERCENT",
  ABSOLUTE: "ABSOLUTE",
  DELTA: "DELTA",
} as const;

export type ActionImpactType = (typeof ActionImpactType)[keyof typeof ActionImpactType];
