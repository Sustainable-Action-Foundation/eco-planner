import type { TreeIteration } from "@/components/tables/roadmapTables/roadmapTree";
import type { OrgProfile } from "@/fetchers/getOrgProfile";
import type { OrgTab } from "@/functions/orgLanding";
import type { Roadmap, UserAccessContext } from "@/types";
import type { LikeScope } from "@/types/enums";

export type SearchParams = { [key: string]: string | string[] | undefined };

export type OrgLandingProps = {
  org: OrgProfile,
  /** The signed-in user, whichever view is shown */
  accessContext: UserAccessContext | null,
  /**
   * Whose eyes the content is fetched and filtered with: the user's own, except in the
   * public view of someone entitled to the working view, which previews what a visitor
   * without a login gets (null).
   */
  viewerContext: UserAccessContext | null,
  /** The viewer may switch between the views */
  entitled: boolean,
  /** The org's roadmap versions to list, as `viewerContext` sees them, with the page's filters applied */
  iterations: TreeIteration[],
  /** The org's listed roadmaps as `viewerContext` sees them, unfiltered */
  roadmaps: Roadmap[],
  searchParams: SearchParams,
};

export type WorkingViewProps = OrgLandingProps & {
  tab: OrgTab,
  tabs: OrgTab[],
  /** Whose likes the liked-goals lists count */
  likeScope: LikeScope,
  /** The versions of the org's roadmaps the user can add goals to */
  copyTargets: { id: string, roadmapId: string, version: number, name: string }[],
  /** Every roadmap of the org the user can read, hidden ones they can write to included */
  allRoadmaps: Roadmap[],
};
