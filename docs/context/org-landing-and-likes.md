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

## Comments
- Comments hang on roadmaps, versions, goals and actions (`/api/comment`). Posting needs view access and an account; no grant is needed on public content.
- A comment revalidates its parent's cache tag.
