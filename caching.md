# Caching

The reference for `'use cache'` tags and invalidation. Check every PR that adds a cached reader or a mutation against [Rules](#rules). Derived from the code as of `dev` 2026-10-12; the [audit](#audit) lists what is wrong today.

Next.js docs (this Next differs from older versions, read these and not your memory): `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md`, `.../04-functions/{cacheTag,cacheLife,revalidateTag,updateTag}.md`.

## How it works here
- `cacheComponents: true`, no custom `cacheLife` profiles, default in-memory cache handler. Self-hosted single container, so entries live in the app process: **a restart (or deploy) flushes everything**. That is also the only way to flush after out-of-band SQL (imports, backfills).
- Every DB fetcher in `src/fetchers/` is split into an uncached wrapper that reads the session (`getUserAccessContext()`, uncached on purpose) and a `getCached*` function with `'use cache'` that takes the access context **as an argument**. The whole `UserAccessContext` object (id, username, super admin flag, memberships with roles and group ids) is part of the cache key, so DB entries are effectively **per user + per arguments**. Membership, role and group changes therefore never need revalidation: they change the key.
- No DB reader calls `cacheLife`, so they all run on the `default` profile: revalidate 15 min (stale-while-revalidate after that), never expire. The 15 min revalidate is the only thing that heals a missed tag.
- Tags are global entity tags (`goal`, `action`, ...). A `revalidateTag('goal', ...)` hits every entry of every reader that declared `goal`, for every user and id.

### `revalidateTag` second argument
| Call | Meaning (per docs) | Used by |
| --- | --- | --- |
| `revalidateTag(tag, { expire: 0 })` | Expire now; the next request blocks on a fresh fill. Read-your-own-writes from a route handler. | every API route except recalculate |
| `revalidateTag(tag, 'max')` | Mark stale; the next request is **served the old entry** and refills in the background. | `/api/recalculate` |
| `revalidateTag(tag)` | Deprecated (old immediate-expire behaviour). | none, keep it that way |
| `updateTag(tag)` | Immediate expire, **Server Actions only**; throws in route handlers. | none (all mutations are route handlers) |

## Tags
| Tag | Stands for a change to | Revalidated by |
| --- | --- | --- |
| `database` | anything in the DB (catch-all) | **nobody** (dead) |
| `roadmap` | `roadmaps`, their access control (sharing, grants), roadmap comments | roadmap POST/PUT/DELETE, comment on roadmap |
| `roadmapIteration` | `roadmapIterations` (status, version, description), iteration comments | iteration POST/PUT/DELETE, roadmap DELETE, comment on iteration |
| `goal` | `goals`, their sections (series links, recipe suggestions), goal comments | goal POST/PUT/DELETE, effect *, action DELETE, iteration DELETE, roadmap DELETE, comment on goal |
| `action` | `actions`, `actionFields`, action comments | action *, effect *, goal DELETE, iteration DELETE, roadmap DELETE, comment on action |
| `effect` | `effects` | **nobody** (effects revalidate `action` + `goal`) |
| `dataSeries` | `dataSeries` and their values | recalculate (`'max'`) only |
| `recipe` | `recipes` | **nobody** |
| `goalLike` | `goalLikes` | goal-like POST/DELETE |
| `org` | `orgs` (name, geo area) | org PUT |
| `user` | `users` | **nobody** |
| `curatedHistoricalData` | upstream SCB/Trafa data behind the curated catalog | nobody (TTL `days`) |
| `scbPopulationQuery` | SCB population table TAB6471 | nobody (TTL `days`) |
| `scbAreaQuery` | SCB land area table TAB6420 | nobody (TTL `days`) |

## Cached readers
Key = arguments; "ctx" = the full `UserAccessContext` (per user, `null` for anonymous). All DB readers use the `default` profile.

| Function (file) | Tags (besides `database`) | Key | Returns |
| --- | --- | --- | --- |
| `getCachedGoal` (getOneGoal) | goal, action, dataSeries | id, ctx | goal + series, effects (with actions), iteration + roadmap (name, type, geo, AC incl. org name), comments |
| `clientSafeGetCachedGoal` (clientSafeGetOneGoal) | goal, action, dataSeries | id, ctx | goal scalars + series |
| `getCachedGoalByIndicator` (getGoalByIndicator) | goal, action, dataSeries | iterationId, indicator, unit, ctx | parent/child goal on the goal page |
| `getCachedGoalLikeSummary` (getGoalLikes) | goalLike, goal | goalId, ctx | like count, liked by viewer |
| `getLikeScopes` (getGoalLikes) | org | orgId | org/area/county scopes |
| `getCachedLikedGoals` (getGoalLikes) | goalLike, goal, roadmap, roadmapIteration, dataSeries, org | orgId, areaCode, ctx | org landing liked goals + copies |
| `getCachedNationalGoals` (getNationalGoalMatches) | goal, roadmap, roadmapIteration, dataSeries | indicators, ctx | national goals with series |
| `getCachedAction` (getOneAction) | action | id, ctx | action, fields, effects (series, goal scalars), iteration + roadmap (name, AC), comments |
| `getCachedActions` (getActions) | action | ctx | all visible actions, same shape |
| `getCachedActionNeighbours` (getActionNeighbours) | action | rootId, selfId, ctx | origin/copies with org name + geo, roadmap name, fields |
| `clientSafeGetCachedActionOptions` | action | ctx | id, name, org name, roadmap name |
| `clientSafeGetCachedAllTags` | action | ctx | distinct tag values |
| `clientSafeGetCachedAllFieldHeaders` | action | ctx | distinct field headers |
| `getCachedEffect` (getOneEffect) | action, goal, effect | actionId, goalId, ctx | effect + series, action/goal identity, roadmap AC |
| `clientSafeGetCachedDataSeries` | dataSeries, action, goal | id, ctx | id, unit, values (also the recipe evaluator's input getter) |
| `getCachedRecipe` (getOneRecipe) | recipe, dataSeries | id, ctx | recipe JSON (also read by `/api/recalculate`) |
| `getCachedRoadmap` (getOneRoadmap) | roadmap, roadmapIteration | id, ctx | roadmap, iterations (`_count.goals`), children, comments, AC |
| `getCachedRoadmaps` (getRoadmaps) | roadmap, roadmapIteration | ctx | same, all visible |
| `getCachedRoadmapSubset` (getRoadmapSubset) | roadmap, roadmapIteration | ctx, actor | iterations + counts + goal ids + action ids |
| `getCachedRoadmapIterations` (getRoadmapIterations) | roadmap, roadmapIteration, goal, action | ctx, ids | iteration list + counts |
| `getCachedClientSafeRoadmapIterations` | roadmap, roadmapIteration | ctx | iteration list + `_count.goals/actions` |
| `getCachedRoadmapIteration` (getOneRoadmapIteration) | roadmap, roadmapIteration, goal, action | id, ctx | iteration, goals **with series values**, actions, comments, AC |
| `getCachedRoadmapIterationByVersion` | roadmap, roadmapIteration, goal, action | roadmapId, version, ctx | same as above |
| `getCachedClientSafeRoadmapIteration` | roadmap, roadmapIteration, goal, action | id, ctx | goals + effects **with series values** |
| `getCachedNames` (getNames) | roadmap, roadmapIteration, goal, action | ctx | name tree for links |
| `getCachedUserInfo` (getUserInfo) | user, roadmap, roadmapIteration | username, ctx | authored roadmaps/iterations with counts and comments |
| `getCachedOrgs` (getUserOrgs) | org | org id list | org names + geo area |
| `getCachedSeries` (getCuratedHistoricalData) | curatedHistoricalData (`days`) | source, geoArea | one curated external series |
| `getCachedPxWebTableMetadata` (getCuratedHistoricalData) | curatedHistoricalData (`days`) | tableId, dataset | PxWeb table metadata |
| `getCachedQuery` (scbPopulationQuery) | scbPopulationQuery (`days`) | areaCode | population number |
| `getCachedQuery` (scbAreaQuery) | scbAreaQuery (`days`) | areaCode | land area number |

`src/app/layout.tsx`, `src/lib/sorters.ts`, `src/lib/api/guardExternalApi.ts`, `getPxWebTableContent.ts`, `getTrafaTableContent.ts` only mention `use cache` in comments; they hold no cached scope.

## Mutation → revalidation matrix
✓ = revalidated (`{ expire: 0 }` unless noted). Groups, memberships and auth routes revalidate nothing by design (they only change the per-request access context, i.e. the key).

| Mutation | roadmap | roadmapIteration | goal | action | dataSeries | goalLike | org |
| --- | --- | --- | --- | --- | --- | --- | --- |
| roadmap POST | ✓ | | | | | | |
| roadmap PUT (name, type, geo, parent, **sharing/grants**) | ✓ | | | | | | |
| roadmap DELETE | ✓ | ✓ | ✓ | ✓ | | | |
| iteration POST (**creates goals**) | | ✓ | | | | | |
| iteration PUT (**status**, adds goals) | | ✓ | | | | | |
| iteration DELETE | | ✓ | ✓ | ✓ | | | |
| goal POST full / section, PUT full / section (series, recipes, suggestions) | | | ✓ | | | | |
| goal DELETE | | | ✓ | ✓ | | | |
| action POST (optionally + effect + series) / PUT | | | | ✓ | | | |
| action DELETE | | | ✓ | ✓ | | | |
| effect POST/PUT/DELETE (+ series) | | | ✓ | ✓ | | | |
| recalculate POST | | | | | ✓ `'max'` | | |
| comment POST | object's tag | object's tag | object's tag | object's tag | | | |
| goal-like POST/DELETE | | | | | | ✓ | |
| org PUT (name, geo area) | | | | | | | ✓ |
| group POST/PUT/DELETE, org-membership PUT, signup, verify, password | | | | | | | |

## Audit
### Stale cache (a mutation does not revalidate a tag the reader would need)
| # | Mutation | Stale readers | Effect |
| --- | --- | --- | --- |
| S1 | roadmap PUT → only `roadmap` | readers without `roadmap` that filter by roadmap access or return roadmap fields: getOneGoal, clientSafeGetOneGoal, getGoalByIndicator, getGoalLikeSummary, getOneAction, getActions, getActionNeighbours, clientSafeGetActionOptions, clientSafeGetAllTags, clientSafeGetAllFieldHeaders, getOneEffect, clientSafeGetOneDataSeries, getOneRecipe | **Revoked sharing keeps serving goals/actions/series to users with a cached entry** (up to 15 min + one request). Widened sharing keeps cached `null` (404). Renamed roadmap / changed geo area stale on goal, action, effect pages. |
| S2 | iteration POST/PUT → only `roadmapIteration` | same list as S1 (none of them declare `roadmapIteration`) | Publishing/unpublishing a draft does not show/hide its goals and actions. Goals created through the iteration form stay `null` in getGoalByIndicator (parent/child goal missing on the goal page). |
| S3 | goal create / delete / listing change → `goal` (+`action`) | getOneRoadmap, getRoadmaps (`_count.goals`), clientSafeGetRoadmapIterations (`_count.goals`), getRoadmapSubset (goal ids), getUserInfo (counts) | Wrong goal counts and subsets on roadmap and user pages. |
| S4 | goal rename / indicator change → `goal` | getOneAction, getActions (return `effects.goal` scalars) | Old goal names on action pages. |
| S5 | goal section writes (recipe upsert/delete), effect writes → `goal`/`action` | getOneRecipe (`recipe`, `dataSeries`) | **`/api/recalculate` evaluates the pre-edit recipe** (it reads getOneRecipe). |
| S6 | recalculate → `dataSeries` only | getOneRoadmapIteration, getRoadmapIterationByVersion, clientSafeGetOneRoadmapIteration, getOneAction, getActions, getOneEffect (all return series values, none declare `dataSeries`) | Iteration page graphs and action/effect series stay old after recalc. |
| S7 | recalculate uses `'max'` | every `dataSeries` reader (getOneGoal ...) | The first request after recalc is served the old values (SWR): the user who clicked recalc sees the old graph, the goal page's "source newer than series" check runs on the old `updated_at`, and a chained recalc reads its input through `clientSafeGetOneDataSeries` and gets the pre-recalc values. |
| S8 | action create / delete → `action` (+`goal`) | clientSafeGetRoadmapIterations (`_count.actions`), getRoadmapSubset (action ids), getUserInfo (counts) | Wrong action counts. |
| S9 | org PUT → only `org` | every reader returning `accessControlSelection` (org name): all roadmap, iteration, goal, action, effect, user-info readers, plus clientSafeGetActionOptions and getActionNeighbours (org name + geo area) | Old org name / area across the app after a rename. |
| S10 | group DELETE → nothing | readers returning `access_control.grants` (roadmap, iteration, goal, action, effect readers) | Grants to the deleted group (cascade-deleted) still listed in cached AC payloads, e.g. the sharing editor prefill. Visibility itself is correct (key changes). |
| S11 | signup → nothing | getUserInfo | A `null` cached for a username before it was registered sticks (`user` is never revalidated). |

### Over-invalidation
| # | What | Note |
| --- | --- | --- |
| O1 | Every mutation revalidates **global** entity tags with `{ expire: 0 }` | One goal section save expires every entry of the 13 `goal` readers for every user and id (goal pages, iteration pages, name tree, national matches, liked goals). |
| O2 | effect *, action DELETE, goal DELETE → `goal` + `action` | Hits 19 of the 27 DB readers. |
| O3 | roadmap / iteration DELETE → 3–4 tags | Effectively flushes the DB cache. Acceptable: rare. |
| O4 | comment POST → the object's whole entity tag | Expires every goal (or action, ...) entry to show one comment. |
| O5 | recalculate → `dataSeries` | Expires all goal pages, national matches and liked goals for one series. |
| O6 | `database` on every DB reader, never revalidated | No effect today; a single `revalidateTag('database')` would flush everything. Dead weight. |
| O7 | Dead tags `effect`, `recipe`, `user` | Declared, never revalidated; they protect nothing (S5, S11). |

At current scale (single box, tens of users, writes rare next to reads) O1–O5 cost little; the S list is the real problem.

### Not cached, probably should be
| Reader | Why |
| --- | --- |
| `getUserAccessContext` / `getAccessContextById` | One DB query **per fetcher call** in a render (every wrapper calls it). Must stay fresh per request, so wrap in React `cache()` (request-scoped), not `'use cache'`. Same for the session read. |
| goal page `prisma.recipes.findMany` (source `updated_at`) and parent-version `aggregate` | Two uncached queries per goal view; fold into the goal reader or cache with `goal` + `dataSeries` + `roadmapIteration`. |

Deliberately uncached and fine: `getOrgManagement` (manager page, must be fresh, no tag covers groups), `getOrgOptions` (forms only), `getGuestInvite` (guests disabled), `findTypeFromId`, `getUserHash`.

### Cached readers that turn failure into a cached empty result
Being fixed separately; listed so the fix covers all of them.
- **Every DB reader above** catches the Prisma error and returns `null` / `[]` (getGoalLikeSummary returns `{ 0, false }`, getLikeScopes returns only the org scope). An outage or reset window is cached as "not found" / "empty" for 15 min+.
- `getCachedSeries` (curated): returns `null` on any error, cached `days`. Documented as intentional, but it cannot tell "table has no such area" from "upstream failed".
- `getCachedPxWebTableMetadata`, scbPopulationQuery and scbAreaQuery `getCachedQuery`: the cores (`getPxWebTableMetadata`, `getPxWebTableContent`) return `null` on network errors and 429s, cached `days`.
- Not cached but related: `getAccessContextById` returns `null` on a DB error, so the request renders as anonymous.

## Rules
### Naming
- Entity tags: the singular camelCase model name (`goal`, `roadmapIteration`, `dataSeries`, `goalLike`). One tag per table family; child tables use the parent's tag (`actionFields` → `action`, `accessControls`/grants → `roadmap`, comments → their parent's tag, effects → `action` + `goal`, recipes → `dataSeries`).
- External data: one tag per source/catalog (`curatedHistoricalData`, `scbPopulationQuery`, ...).
- Retire `database`, `effect`, `recipe`, `user` (never revalidated; restart flushes). Do not add new tags nobody revalidates.
- **Per-id tags (`goal:<id>`, `org:<id>`): not now.** The docs allow them (any string ≤ 256 chars, ≤ 128 tags per `cacheTag` call, tags may be computed from the fetched data), but they only pay off if mutations stop revalidating the entity tag, and then every mutation must compute every dependent id: roadmap access cascades to all iterations, goals, actions, effects and series below it; effects link actions and goals; recipes read series across orgs. That bookkeeping is exactly what produced S1–S9. With entries already per user, the miss cost is small. Revisit only if instrumentation shows post-edit misses dominating; first candidates would be purely local mutations (comments, likes → `goal:<id>`) and `org:<id>` for org-landing sections.

### A new cached reader must
1. Put `'use cache'` in a `getCached*` function that takes the access context (or whatever user data it needs) as an argument; never read cookies/session inside.
2. Call `cacheLife` explicitly: `cacheLife('default')` for DB readers (the 15 min revalidate is the safety net), `'days'` for external data.
3. Declare a tag for **every entity whose rows it returns or filters by**:
   - uses `visible*WHERE`, `readableAccessControlWHERE` or `listedGoalsWHERE` → `roadmap` + `roadmapIteration` (visibility comes from roadmap access and iteration status);
   - returns `accessControlSelection` or any org name/area → `org`;
   - returns series values or recipes → `dataSeries`;
   - returns `_count` of goals/actions/effects → `goal` / `action`;
   - returns related rows (effects, goal names on actions, ...) → their tags.
4. **Never cache failure**: let DB and upstream errors throw out of the cached scope. Return `null` / `[]` only for a result that is genuinely empty. Catch in the uncached wrapper or the page if it wants to degrade. For external data, cache "no data for this area" but never "request failed".

### A new mutation must
1. Revalidate the tag of **every table it writes**, nested creates and cascades included (iteration POST creating goals → `goal`; action POST creating an effect → `goal` too; group DELETE cascading grants → `roadmap`).
2. Changes to roadmap access or iteration status also need the tags of everything below them: with rule 3 above in place, `roadmap` / `roadmapIteration` covers it.
3. Use `revalidateTag(tag, { expire: 0 })` in route handlers (read-your-own-writes; `updateTag` is Server Actions only). `'max'` only where serving the old value once is acceptable, which excludes anything the user just edited. Never the one-argument form.
4. Revalidate after the write commits, inside the success path.

### Fixing the audit
Preferred: complete the reader tags per rule 3 (fixes S1–S4, S6, S8, S9 without touching routes), then: recalculate → `{ expire: 0 }` (S7); goal section writes and effect writes → also `dataSeries` (S5, once getOneRecipe drops `recipe`); group DELETE → also `roadmap` (S10); per mutation rule 1, iteration POST/PUT → also `goal` and action POST with an effect → also `goal`; signup → nothing once `user` is retired and getUserInfo stops caching unknown usernames (S11).

## Database pool
`src/lib/prisma/mariadb-adapter.ts` reads pool settings from the `DATABASE_URL` query string (Prisma's parameter names, so the Prisma CLI accepts the same URL) and passes them to the mariadb driver. Absent params keep the driver defaults, i.e. the previous behaviour.

| Param | Driver option | Default when absent |
| --- | --- | --- |
| `connection_limit` | `connectionLimit` | 10 |
| `pool_timeout` (s) | `acquireTimeout` | 10 s |
| `connect_timeout` (s) | `connectTimeout` | 1 s (never above `acquireTimeout`) |

The mariadb pool is **fixed-size**: `minimumIdle` defaults to `connectionLimit`, so it opens `connection_limit` connections and keeps them all open (the 30 min `idleTimeout` only reaps connections above `minimumIdle`). Idle connections on the server are therefore expected and equal to `connection_limit` per pool. Size it, don't leave it implicit.

| Environment | Recommended | Why |
| --- | --- | --- |
| dev (`yarn dev`, local MariaDB) | none (10 / 10 s) | One pool, kept across HMR via `globalThis`. |
| docker test stack (`compose.testing.yaml`, e2e `--workers=3`) | `?connection_limit=10&pool_timeout=20` | Parallel workers burst; a longer wait beats spurious acquire timeouts that read as test flakes. |
| staging | `?connection_limit=5&pool_timeout=10` | Low traffic, shares a box. |
| prod (one app container next to MariaDB) | `?connection_limit=5&pool_timeout=10&connect_timeout=5` | A render is ~23 short queries; 5 is plenty for current traffic and halves the idle footprint. The tunnel incident saw ~20 idle pooled connections with the default 10/10 s, consistent with two pools of 10 (which processes held them was not determined); explicit small pools keep that bounded. |
| tooling over an SSH tunnel (Prisma Studio, scripts) | `?connection_limit=2&connect_timeout=5` | Few connections through the tunnel; 1 s connect is too tight over SSH. |

`pool_timeout` is how long a query waits for a free connection before failing; keep it well under the 60 s cache-fill stall seen in prod so a starved pool fails fast instead of wedging cache fills.
