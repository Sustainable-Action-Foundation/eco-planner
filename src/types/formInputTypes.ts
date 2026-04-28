import type { SerializedRecipe } from "@/functions/recipe";
import type { ActionImpactType, Prisma, RoadmapType } from "@/prismaClient";
import type { Action, DateValuesWithUnit } from "@/types";

/** The format of data needed to create a new roadmap series */
export type MetaRoadmapCreateInput = {
  /**
   * This type is derived from @type {Prisma.MetaRoadmapCreateInput}, but with some fields omitted in clear text for better intellisense readability and maintainability.
   * 
   * That being said, if the schema changes, this type will need to be updated manually.
   */
  /* Automatically managed by Prisma */
  id?: never,
  // createdAt?: Date | string,
  // updatedAt?: Date | string,

  name: string,
  description: string,
  type: RoadmapType | undefined,
  actor: string | null | undefined,
  isPublic: boolean | undefined,

  /* Relational fields are handled differently in our API */
  // roadmapVersions?: RoadmapCreateNestedManyWithoutMetaRoadmapInput,
  // parentRoadmap?: MetaRoadmapCreateNestedOneWithoutChildRoadmapsInput,
  // childRoadmaps?: MetaRoadmapCreateNestedManyWithoutParentRoadmapInput,
  // comments?: CommentCreateNestedManyWithoutMetaRoadmapInput,
  // links?: LinkCreateNestedManyWithoutMetaRoadmapInput,
  // author: UserCreateNestedOneWithoutAuthoredMetaRoadmapsInput,
  // editors?: UserCreateNestedManyWithoutEditMetaRoadmapsInput,
  // editGroups?: UserGroupCreateNestedManyWithoutEditMetaRoadmapInput,
  // viewers?: UserCreateNestedManyWithoutViewMetaRoadmapsInput,
  // viewGroups?: UserGroupCreateNestedManyWithoutViewMetaRoadmapInput,

  /* 
   * Non-prisma fields
   * These are used to make the API more usable and nice to deal with due to formatting and types.
   */
  // Accepts lists of UUIDs for all of the following, to link them to the roadmap (optional)
  editors: string[] | null | undefined;
  viewers: string[] | null | undefined;
  editGroups: string[] | null | undefined;
  viewGroups: string[] | null | undefined;

  // UUID for the parent meta roadmap (if any)
  parentRoadmapId: string | null | undefined;

  // TODO - DEPRECATED - Will be migrated to description
  links: { url: string, description?: string }[] | null | undefined;
}

/** The format of data needed to update an existing data series. When compared to MetaRoadmapCreateInput, this type allows most fields to be undefined, indicating that they should not be changed. */
export type MetaRoadmapUpdateInput = {
  /**
   * This type is derived from @type {Prisma.MetaRoadmapCreateInput}, but with some fields omitted in clear text for better intellisense readability and maintainability.
   * 
   * That being said, if the schema changes, this type will need to be updated manually.
   */
  /* Automatically managed by Prisma */
  // createdAt?: Date | string,
  // updatedAt?: Date | string,

  id: string,
  name: string | undefined,
  description: string | undefined,
  type: RoadmapType | undefined,
  actor: string | null | undefined,
  isPublic: boolean | undefined,

  /* Relational fields are handled differently in our API */
  // roadmapVersions?: RoadmapCreateNestedManyWithoutMetaRoadmapInput,
  // parentRoadmap?: MetaRoadmapCreateNestedOneWithoutChildRoadmapsInput,
  // childRoadmaps?: MetaRoadmapCreateNestedManyWithoutParentRoadmapInput,
  // comments?: CommentCreateNestedManyWithoutMetaRoadmapInput,
  // links?: LinkCreateNestedManyWithoutMetaRoadmapInput,
  // author: UserCreateNestedOneWithoutAuthoredMetaRoadmapsInput,
  // editors?: UserCreateNestedManyWithoutEditMetaRoadmapsInput,
  // editGroups?: UserGroupCreateNestedManyWithoutEditMetaRoadmapInput,
  // viewers?: UserCreateNestedManyWithoutViewMetaRoadmapsInput,
  // viewGroups?: UserGroupCreateNestedManyWithoutViewMetaRoadmapInput,

  /* 
   * Non-prisma fields
   * These are used to make the API more usable and nice to deal with due to formatting and types.
   */
  // Accepts lists of UUIDs for all of the following, to link them to the roadmap (optional)
  editors: string[] | null | undefined;
  viewers: string[] | null | undefined;
  editGroups: string[] | null | undefined;
  viewGroups: string[] | null | undefined;

  // UUID for the parent meta roadmap (if any)
  parentRoadmapId: string | null | undefined;

  // Timestamp to check if the user is trying to update based on stale data
  timestamp: number;

  // TODO - DEPRECATED - Will be migrated to description
  links: { url: string, description?: string }[] | null | undefined;
}

/** The format of the data needed to create a new roadmap version. */
export type RoadmapInput = Omit<
  Prisma.RoadmapCreateInput,
  'id' | 'createdAt' | 'updatedAt' | 'goals' | 'author' | 'editors' |
  'viewers' | 'editGroups' | 'viewGroups' | 'comments' | 'metaRoadmap' | 'version'
> & {
  // Accepts lists of UUIDs for all of the following, to link them to the roadmap (optional)
  editors?: string[] | undefined;
  viewers?: string[] | undefined;
  editGroups?: string[] | undefined;
  viewGroups?: string[] | undefined;
  // UUID for the meta roadmap this roadmap belongs to
  metaRoadmapId: string;
  // Used in API to inherit the goals with the given IDs from other roadmaps
  // TODO: DEPRECATED - remove this prop since it should be recipe derived
  inheritFromIds?: string[] | null | undefined;
  // Version numbers are assigned by the API and therefore omitted
};

/** 
 * The format of the data needed to create a new roadmap version.
 * 
 * This type is derived from @type {Prisma.RoadmapCreateInput} but with some fields omitted in clear text for better intellisense readability and maintainability.
 * 
 * That being said, if the schema changes, this type will need to be updated manually.
 */
export type RoadmapCreateInput = {
  // To differentiate between create and update
  roadmapId?: never;
  timestamp?: never; // Not needed when creating

  // id: string | undefined; // Created by the API
  // createdAt: string | Date | undefined; // Created by the API
  // updatedAt: string | Date | undefined; // Created by the API
  // version: number;  // Created by the API

  // Basic meta
  targetVersion: number | null | undefined;
  description: string | null | undefined;
  isPublic: boolean | undefined;

  // Relations
  metaRoadmapId: string;
  // comments: Prisma.CommentCreateNestedManyWithoutRoadmapInput; // Cannot be created with a new roadmap
  // goals: Prisma.GoalCreateNestedManyWithoutRoadmapInput;
  goals: GoalCreateInput[] | null | undefined;
  // actions: Prisma.ActionCreateNestedManyWithoutRoadmapInput; // Cannot be created with a new roadmap

  // Access control
  // author: Prisma.UserCreateNestedOneWithoutAuthoredRoadmapsInput; // Derived from session in the API
  editors: string[] | null | undefined;
  editGroups: string[] | null | undefined;
  viewers: string[] | null | undefined;
  viewGroups: string[] | null | undefined;

  // TODO - DEPRECATED - Will be migrated to description
  links: { url: string, description?: string | null }[] | null | undefined;
};

/** 
 * The format of the data allowed to update an existing roadmap version.
 * 
 * This type is derived from @type {Prisma.RoadmapUpdateInput} but with some fields omitted in clear text for better intellisense readability and maintainability.
 * 
 * That being said, if the schema changes, this type will need to be updated manually.
 */
export type RoadmapUpdateInput = {
  // Required to find this roadmap
  roadmapId: string;

  // Stale data check
  timestamp: number; // From Date.now() i.e. milliseconds since epoch

  // createdAt: string | Date | undefined; // Handled by the API
  // updatedAt: string | Date | undefined; // Handled by the API
  // version: number; // Handled by the API

  // Basic meta
  description: string | null | undefined;
  targetVersion: number | null | undefined;
  isPublic: boolean | undefined;

  // Relations
  metaRoadmapId?: never; // Can't reassign the meta roadmap of an existing roadmap. IT WOULD BE MAYHEM.
  // comments: Prisma.CommentUpdateManyWithoutRoadmapNestedInput; // Cannot be updated from the roadmap
  // goals: Prisma.GoalUpdateManyWithoutRoadmapNestedInput;
  goals: GoalCreateInput[] | null | undefined;
  // actions: Prisma.ActionUpdateManyWithoutRoadmapNestedInput; // Cannot be updated from the roadmap

  // Access control
  // author: Prisma.UserUpdateOneRequiredWithoutAuthoredRoadmapsNestedInput;
  editors: string[] | null | undefined;
  editGroups: string[] | null | undefined;
  viewers: string[] | null | undefined;
  viewGroups: string[] | null | undefined;

  // TODO - DEPRECATED - Will be migrated to description
  links: { url: string, description?: string | null }[] | null | undefined;
};

/**
 * The format of the data needed to create a new goal.
 * 
 * This type is derived from @type {Prisma.GoalCreateInput} but with some fields omitted in clear text for better intellisense readability and maintainability.
 * 
 * That being said, if the schema changes, this type will need to be updated manually.
 */
export type GoalCreateInput = {
  goalId?: never; // Ignored when creating
  timestamp?: never; // Ignored when creating

  // id: string | undefined; // Gets created automatically // Created by the API
  // createdAt: string | Date | undefined; // Gets set automatically // Created by the API
  // updatedAt: string | Date | undefined; // Gets set automatically // Created by the API

  // Basic meta
  name: string | null | undefined;
  description: string | null | undefined;
  indicatorParameter: string;
  isFeatured: boolean | undefined;

  // External data source
  externalDataset: string | null | undefined;
  externalTableId: string | null | undefined;
  externalSelection: string | null | undefined;

  recipeSuggestions: SerializedRecipe[] | null | undefined;

  dataSeriesId: string | null | undefined;
  dataSeries: DateValuesWithUnit;
  dataSeriesRecipeId: string | null | undefined;
  dataSeriesRecipe: SerializedRecipe | null | undefined;

  baselineId: string | null | undefined;
  baseline: DateValuesWithUnit | null | undefined;
  baselineRecipeId: string | null | undefined;
  baselineRecipe: SerializedRecipe | null | undefined;

  // Relations
  // authorId: string; // Derived from session in the API
  // effects: Prisma.EffectCreateNestedManyWithoutGoalInput; // Cannot be created with a new goal
  roadmapId: string;
  // comments: Prisma.CommentCreateNestedManyWithoutGoalInput; // Cannot be created with a new goal
  rawTags: string[] | null | undefined; // Transform into tags relation in the server side API

  // TODO: Deprecated - will be moved to description
  links: { url: string, description?: string | null }[] | null | undefined;
};

/**
 * The format of the data allowed to update an existing goal.
 * 
 * This type is derived from @type {Prisma.GoalUpdateInput} but with some fields omitted in clear text for better intellisense readability and maintainability.
 * 
 * That being said, if the schema changes, this type will need to be updated manually.
 */
export type GoalUpdateInput = {
  // Required to find this goal
  goalId: string;

  // Stale data check
  timestamp: number; // From Date.now() i.e. milliseconds since epoch

  // id: string | undefined; // Gets created automatically
  // createdAt: string | Date | undefined; // Gets set automatically
  // updatedAt: string | Date | undefined; // Gets set automatically

  // Basic meta
  name: string | null | undefined;
  description: string | null | undefined;
  indicatorParameter: string | undefined;
  isFeatured: boolean | undefined;

  // External data source
  externalDataset: string | null | undefined;
  externalTableId: string | null | undefined;
  externalSelection: string | null | undefined;

  dataSeriesId: string | null | undefined;
  dataSeries: DateValuesWithUnit | null | undefined;
  dataSeriesRecipeId: string | null | undefined;
  dataSeriesRecipe: SerializedRecipe | null | undefined;

  baselineId: string | null | undefined;
  baseline: DateValuesWithUnit | null | undefined;
  baselineRecipeId: string | null | undefined;
  baselineRecipe: SerializedRecipe | null | undefined;

  recipeSuggestions: SerializedRecipe[] | null | undefined;

  // Relations
  // authorId: string; // Derived from session in the API
  // effects: Prisma.EffectCreateNestedManyWithoutGoalInput; // Cannot be updated from the goal
  roadmapId?: never; // Ignored when updating; Can't reassign the roadmap of an existing goal
  // comments: Prisma.CommentCreateNestedManyWithoutGoalInput; // Cannot be updated from the goal
  rawTags: string[] | null | undefined; // Transform into tags relation in the server side API

  // TODO: Deprecated - will be moved to description
  links: { url: string, description?: string | null }[] | null | undefined;
};

/** The format of the data needed to create a new action. */
export type ActionInput = {
  actionId: string | null | undefined;
  roadmapId: string | undefined;
  goalId: string | undefined;

  description: string | null | undefined;
  name: string;
  startYear: number | null | undefined;
  endYear: number | null | undefined;

  costEfficiency: string | null | undefined;
  expectedOutcome: string | null | undefined;

  projectManager: string | null | undefined;
  relevantActors: string | null | undefined;

  isSufficiency: boolean | undefined;
  isEfficiency: boolean | undefined;
  isRenewables: boolean | undefined;

  parentAction: Action | null | undefined;
  childActions: Action[] | null | undefined;

  dataSeries: DateValuesWithUnit | undefined;
  impactType: ActionImpactType | undefined;

  // TODO: Deprecated - will be moved to description
  links: { url: string, description?: string | null }[] | null | undefined;

  timestamp: number | undefined;
};

export type EffectInput = {
  goalId: string;
  actionId: string;

  impactType: ActionImpactType | undefined;
  dataSeries: DateValuesWithUnit;

  timestamp: number | undefined;
};