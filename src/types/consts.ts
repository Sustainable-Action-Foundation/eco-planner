/** Object and type for the different access levels returned by the accessChecker function. */
export const AccessLevel = {
  None: "",
  View: "VIEW",
  Edit: "EDIT",
  Author: "AUTHOR",
  Admin: "ADMIN",
} as const;
export type AccessLevel = (typeof AccessLevel)[keyof typeof AccessLevel];

export const ClientError = {
  AccessDenied: "You either don't have access to this entry or are trying to edit an entry that doesn't exist",
  BadSession: "Bad session cookie; you have been logged out. Please log in and try again.",
  IllegalParent: "You are trying to connect this object to a parent you don't have access to or that doesn't exist",
  StaleData: "Stale data; please refresh and try again",
} as const;
export type ClientError = (typeof ClientError)[keyof typeof ClientError];

/** Object and type with the different types of sorting available for roadmaps */
export const RoadmapSortBy = {
  Default: "",
  Alpha: "ALPHA",
  AlphaReverse: "ALPHA REVERSE",
  GoalsFalling: "HIGH FIRST",
  GoalsRising: "LOW FIRST",
} as const;
export type RoadmapSortBy = (typeof RoadmapSortBy)[keyof typeof RoadmapSortBy];


/** A regex to match UUIDs. Allows all UUIDs of all versions and variants, even non-standard ones, as specified by RFC 9562 */
export const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  