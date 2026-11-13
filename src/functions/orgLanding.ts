// No `server-only` marker: pure and shared by server and client components.

/** The two views of an org's landing page */
export const OrgView = {
  /** What everyone sees */
  Public: "PUBLIC",
  /** For those who can write something in the org */
  Working: "WORKING",
} as const;
export type OrgView = (typeof OrgView)[keyof typeof OrgView];

/** The sections of the working view */
export const OrgTab = {
  Overview: "OVERVIEW",
  Roadmaps: "ROADMAPS",
  Actions: "ACTIONS",
  Liked: "LIKED",
  Data: "DATA",
  Comments: "COMMENTS",
  Members: "MEMBERS",
} as const;
export type OrgTab = (typeof OrgTab)[keyof typeof OrgTab];

/** The search param choosing the view (`?view=public`); absent for the viewer's default */
export const orgViewParam = "view";
/** The search param choosing the working view's section (`?tab=roadmaps`); absent for the overview */
export const orgTabParam = "tab";

type SearchParams = { [key: string]: string | string[] | undefined };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The view to render. Only those entitled to the working view get it, and they land
 * on it; asking for it by URL without entitlement gives the public view.
 */
export function resolveOrgView(searchParams: SearchParams, entitled: boolean): OrgView {
  if (!entitled) return OrgView.Public;
  return firstValue(searchParams[orgViewParam])?.toLowerCase() === OrgView.Public.toLowerCase() ? OrgView.Public : OrgView.Working;
}

/** The working view's section: the overview unless the param names another one the viewer has */
export function resolveOrgTab(searchParams: SearchParams, available: readonly OrgTab[]): OrgTab {
  const requested = firstValue(searchParams[orgTabParam])?.toUpperCase();
  return available.find(tab => tab === requested) ?? OrgTab.Overview;
}

/** The sections a viewer of the working view has; the member list is for those who manage the org */
export function availableOrgTabs(_managesOrg: boolean): OrgTab[] {
  return Object.values(OrgTab).filter(tab => tab !== OrgTab.Members && tab !== OrgTab.Comments);
}

/** The landing of an org, in a view and section; defaults are left out of the URL */
export function orgLandingPath(orgId: string, options: { view?: OrgView, tab?: OrgTab, params?: Record<string, string> } = {}): string {
  const params = new URLSearchParams({ org: orgId });
  if (options.view === OrgView.Public) params.set(orgViewParam, OrgView.Public.toLowerCase());
  if (options.tab && options.tab !== OrgTab.Overview) params.set(orgTabParam, options.tab.toLowerCase());
  for (const [key, value] of Object.entries(options.params ?? {})) params.set(key, value);
  return `/?${params.toString()}`;
}
