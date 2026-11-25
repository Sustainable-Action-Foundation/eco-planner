# Org landing, likes and comments

## The start page branches
`src/app/page.tsx` serves two views:
- **Org landing** for members of an org: the roadmaps readable in that org, liked goals, national goals to use locally, curated statistics for the org's area, and the org's actions. Heavy sections stream in `Suspense`.
- **Public view** for everyone else (anonymous visitors, users without an org).

Rules:
- `?org=<id>` switches org, `?org=public` shows the public view. The default is the user's first proper membership.
- The roadmap filters (`searchFilter`, `typeFilter`, `sortBy`) work on both views, so deep links behave the same.
- `data-testid="home-title"` is on both heroes; tests depend on it.
- Sections that need an area (curated statistics, national goals, area likes) show only for orgs with a `geo_area_code`. Managers set the org's area on the management page (`PUT /api/org`).
- Keep the landing light. It fetches org-scoped slim actions (`getActionSummaries`) and builds its roadmap tree from `getRoadmaps()`; see the payload rule in [`caching.md`](../../caching.md).

## Org management
`/org/[orgId]/groups` is for managers: member roles, groups, the geo area and the banner. `getOrgManagement` returns null for anyone else. APIs: `/api/group`, `/api/org-membership`, `/api/org`. Guest invites are disabled; see [access-control.md](access-control.md).

## Banner
- An org can have a landing banner. A manager uploads it; the server transcodes it with sharp (`src/lib/orgBannerImage.ts`, limits in `src/functions/orgBanner.ts`) and stores it in the same bucket as attachments.
- `GET /api/org/[orgId]/banner` serves it through the app, not through a presigned link, so the browser can cache it: the current version is immutable under its `?v=`. It is private to those who see the org.

## Goal likes
- `GoalLikes` (goal + user). `POST` / `DELETE /api/goal-like` with `{ goalId }`, idempotent, needs view access.
- A like can be refined with aspects (`GoalLikeAspects`): through which kind of "rådighet" (ability to act) the liker's org can act on the goal. `LikeAspect` is a config list in `src/types/enums.ts` rather than a database enum, so it can change without a migration.
- The landing's ranked list counts likes from **members of the landing's org**, not all likes. Why: the org wants to see which goals its own people want to work on. The total is shown separately.
- `LikeScope` widens the count: `ORG`, `AREA` (every org placed in the same area) or `COUNTY` (a county pools its municipalities), chosen with `?likes=`. `/likes/[areaCode]` is the area-wide overview, for signed-in members of an org placed there.
- Only goals the viewer can see and that are listed appear.
- The "copied" badge is derived: an org goal whose recipe reads the liked goal's series (`findCopies` in `src/fetchers/getGoalLikes.ts`). A copy that drops that reference is not recognised. If a goal-origin column is ever added (as actions have), switch `findCopies` to it.

## Liked goals in the goal tree
- A roadmap version page can narrow its goal list (tree and table) to liked goals: `?likes=<filter>`. The tree is built from the liked goals only, so it keeps the version's branches and has none without a liked goal; every branch opens, branches say how many liked goals they hold and goals how many likes they have. This is the "compiled" view of what a workshop liked, in the structure of the roadmap it liked it in.
- `LikeFilter` (`src/types/enums.ts`) is `LikeScope` plus `MINE` and `ALL`, and uses the landing's param, so a link can carry a scope from the ranking to the tree. `?org=` picks the org the scopes belong to, as on the start page; the default is the viewer's first proper membership.
- Who may count whose likes follows what is visible elsewhere, and is decided in `getGoalListLikes` (`src/fetchers/getGoalListLikes.ts`): own likes and everyone's (the count on a goal's page) for any signed-in user; org, area and county only through an org the viewer belongs to (`getLikeScopes`). Anonymous visitors get no filter. A filter the viewer lacks falls back to their default: the org's, or everyone's without an org.
- The state lives in the address only. The page reads it and passes the counts down; the controls navigate (`replace`, no scroll). Why: hidden routes stay mounted (see [caching-and-navigation.md](caching-and-navigation.md)), and component state would show a stale filter when a link or the back button brings the page back.
- Cost: nothing while the filter is off; on, one grouped query per version and filter, cached (`getCachedGoalListLikeCounts`), never one per goal.
- Both readers that count likes per scope share `likersInScopeWHERE`, so the tree and the ranking agree on who is in a scope.

## Comments
- Comments hang on roadmaps, versions, goals and actions (`/api/comment`). Posting needs view access and an account; no grant is needed on public content.
- A comment revalidates its parent's cache tag.
