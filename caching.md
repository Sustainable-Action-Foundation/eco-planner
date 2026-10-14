# Caching

The reference for `'use cache'` tags and invalidation. Check every PR that adds a cached reader or a mutation against [Rules](#rules). Derived from the code on branch `db-slim` (2026-10-14). The [audit](#audit) was first written against `dev` 2026-10-12; findings this branch fixed are kept, marked **fixed**, so reviewers see what changed.

Next.js docs (this Next differs from older versions, read these and not your memory): `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md`, `.../04-functions/{cacheTag,cacheLife,revalidateTag,updateTag}.md`.

## How it works here
- `cacheComponents: true`, no custom `cacheLife` profiles. Self-hosted single container. Two cache handlers (`next.config.ts`):

  | Directive | Handler | Holds | Survives restart |
  | --- | --- | --- | --- |
  | `'use cache'` | Next's default in-memory LRU, `cacheMaxMemorySize: 256 MB` (default 50 MB) | every DB reader | no: **a restart (or deploy) flushes it**. That is also the only way to flush after out-of-band SQL (imports, backfills). |
  | `'use cache: upstream'` | `src/lib/cache/upstreamCacheHandler.mjs`, disk-backed (`SAF_CACHE_DIR`, default `.next/cache/upstream`) | external statistics only: curated series, PxWeb metadata, SCB population/area | yes, also `revalidateTag()` state (`tags.json`). Not across builds: Next puts the build id in the key, so a deploy starts empty; expired files are pruned at startup. Wiped on every `next dev` start unless `SAF_CACHE_DIR` is set. Delete the directory to force a refetch; `SAF_CACHE_DEBUG=1` logs hits and writes. |

- Every DB fetcher in `src/fetchers/` is split into an uncached public wrapper and a `getCached*` function with `'use cache'`:
  - the wrapper reads the session via `getUserAccessContext()` (memoized per request with React `cache()`, never `'use cache'`) and passes the access context **as an argument**. The whole `UserAccessContext` (id, username, super admin flag, memberships with roles and group ids) is part of the cache key, so DB entries are **per user + per arguments**. Membership, role and group changes never need revalidation: they change the key.
  - the cached function runs its queries inside `boundedFill(label, fn)` (`src/fetchers/cacheFallback.ts`) and **throws** on failure; a rejected fill is not stored. A fill that has not settled after `SAF_CACHE_FILL_TIMEOUT_MS` (default 20 s) rejects with `CacheFillTimeoutError`, so requests waiting on the same key stop waiting instead of hanging ~60 s on Next's internal limit (the prod wedge). The Prisma query itself runs on; its late result is dropped.
  - the wrapper calls it through `uncachedFallback(fill, fallback, message)`, which logs and returns `null` / `[]` / the fallback **for this request only** (Next control-flow errors are rethrown).
- No DB reader calls `cacheLife`, so they all run on the `default` profile: stale 5 min, revalidate 15 min (stale-while-revalidate after that), never expire. The 15 min revalidate is the only thing that heals a missed tag.
- Upstream readers pick `cacheLife` once per invocation: `days` (revalidate 1 day, expire 1 week) for an answer, including "no data for this area"; `minutes` (revalidate 1 min, expire 1 h) when the upstream request failed (network error, 5xx, 429), so a rate-limited upstream is not re-hit on every render but recovers quickly. 429s retry once inside the fill, waiting at most `MaxRetryAfterMs` (15 s, `src/lib/api/utility.ts`); a longer `Retry-After` counts as a failure.
- Tags are global entity tags (`goal`, `action`, ...). A `revalidateTag('goal', ...)` hits every entry of every reader that declared `goal`, for every user and id.

### `revalidateTag` second argument
| Call | Meaning (per docs) | Used by |
| --- | --- | --- |
| `revalidateTag(tag, { expire: 0 })` | Expire now; the next request blocks on a fresh fill. Read-your-own-writes from a route handler. | every API route (recalculate included) |
| `revalidateTag(tag, 'max')` | Mark stale; the next request is **served the old entry** and refills in the background. | none (recalculate used it until this branch) |
| `revalidateTag(tag)` | Deprecated (old immediate-expire behaviour). | none, keep it that way |
| `updateTag(tag)` | Immediate expire, **Server Actions only**; throws in route handlers. | none (all mutations are route handlers) |

## Tags
| Tag | Stands for a change to | Revalidated by |
| --- | --- | --- |
| `database` | anything in the DB (catch-all) | **nobody** (dead) |
| `roadmap` | `roadmaps`, their access control (sharing, grants), roadmap comments | roadmap POST/PUT/DELETE, group DELETE, comment on roadmap |
| `roadmapIteration` | `roadmapIterations` (status, version, description), iteration comments | iteration POST/PUT/DELETE, roadmap DELETE, comment on iteration |
| `goal` | `goals`, their sections (series links, recipe suggestions), goal comments | goal POST/PUT/DELETE, iteration POST/PUT/DELETE, effect *, action POST with effect, action DELETE, roadmap DELETE, comment on goal |
| `action` | `actions`, `actionFields`, action comments | action *, effect *, goal DELETE, iteration DELETE, roadmap DELETE, comment on action |
| `effect` | `effects` | **nobody** (effects revalidate `action` + `goal` + `dataSeries`) |
| `dataSeries` | `dataSeries`, their values, and `recipes` | goal POST/PUT (full and section), effect *, recalculate |
| `recipe` | `recipes` | **nobody** (recipe writes revalidate `dataSeries`) |
| `goalLike` | `goalLikes` | goal-like POST/DELETE |
| `org` | `orgs` (name, geo area) | org PUT |
| `user` | `users` | signup |
| `curatedHistoricalData` | upstream SCB/Trafa data behind the curated catalog | nobody (TTL `days`, failures `minutes`; upstream handler) |
| `scbPopulationQuery` | SCB population table TAB6471 | nobody (TTL `days`, failures `minutes`; upstream handler) |
| `scbAreaQuery` | SCB land area table TAB6420 | nobody (TTL `days`, failures `minutes`; upstream handler) |

## Cached readers
Key = arguments; "ctx" = the full `UserAccessContext` (per user, `null` for anonymous). All DB readers use `'use cache'`, the `default` profile, `boundedFill` inside and `uncachedFallback` in their wrapper; every DB reader also declares `database`. "rm + it" = `roadmap`, `roadmapIteration`.

| Function (file) | Tags (besides `database`) | Key | Returns |
| --- | --- | --- | --- |
| `getCachedGoal` (getOneGoal) | goal, action, dataSeries, rm + it, org | id, ctx | goal + series (incl. recipe source series with `updated_at`), effects (with actions), iteration + roadmap (name, type, geo, AC incl. org name), comments |
| `clientSafeGetCachedGoal` (clientSafeGetOneGoal) | goal, action, dataSeries, rm + it | id, ctx | goal scalars + series |
| `getCachedGoalByIndicator` (getGoalByIndicator) | goal, action, dataSeries, rm + it | iterationId, indicator, unit, ctx | slim parent/child goal for the goal page graphs: series values, effects' series + action name, roadmap name |
| `getCachedGoalSiblings` (getGoalSiblings) | rm + it, goal, dataSeries | iterationId, indicator prefixes, ctx | listed sibling candidates with plotted series (one entry per parent path) |
| `getCachedGoalLikeSummary` (getGoalLikes) | goalLike, goal, rm + it | goalId, ctx | like count, liked by viewer |
| `getCachedLikeScopes` (getGoalLikes) | org | orgId | org/area/county scopes |
| `getCachedLikedGoals` (getGoalLikes) | goalLike, goal, rm + it, dataSeries, org | orgId, areaCode, ctx | org landing liked goals + copies |
| `getCachedNationalGoals` (getNationalGoalMatches) | goal, rm + it, dataSeries | indicators, ctx | national goals with series |
| `getCachedAction` (getOneAction) | action, goal, rm + it, dataSeries, org | id, ctx | action, fields, effects (series, goal scalars), iteration + roadmap (name, AC), comments |
| `getCachedActions` (getActions) | action, goal, rm + it, dataSeries, org | ctx | all visible actions, same shape |
| `getCachedActionSummaries` (getActionSummaries) | action, rm + it | ctx, orgId | list-card fields only (name, years, origin, fields, author); org landing and action list |
| `getCachedActionNeighbours` (getActionNeighbours) | action, rm + it, org | rootId, selfId, ctx | origin/copies with org name + geo, roadmap name, fields |
| `clientSafeGetCachedActionOptions` | action, rm + it, org | ctx | id, name, org name, roadmap name |
| `clientSafeGetCachedAllTags` | action, rm + it | ctx | distinct tag values |
| `clientSafeGetCachedAllFieldHeaders` | action, rm + it | ctx | distinct field headers |
| `getCachedEffect` (getOneEffect) | action, goal, effect, rm + it, dataSeries, org | actionId, goalId, ctx | effect + series, action/goal identity, roadmap AC |
| `clientSafeGetCachedDataSeries` | dataSeries, action, goal, rm + it | id, ctx | id, unit, values (also the recipe evaluator's input getter) |
| `getCachedRecipe` (getOneRecipe) | recipe, dataSeries, rm + it | id, ctx | recipe JSON (also read by `/api/recalculate`) |
| `getCachedRoadmap` (getOneRoadmap) | rm + it, goal, org | id, ctx | roadmap, iterations (`_count.goals`), children, comments, AC |
| `getCachedRoadmaps` (getRoadmaps) | rm + it, goal, org | ctx | same, all visible (also the org landing's roadmap tree) |
| `getCachedRoadmapSubset` (getRoadmapSubset) | rm + it, goal, action, org | ctx, actor | iterations + counts + goal ids + action ids |
| `getCachedRoadmapIterations` (getRoadmapIterations) | rm + it, goal, action, org | ctx, ids | iteration list + counts (also picks the goal page's parent version) |
| `getCachedClientSafeRoadmapIterations` | rm + it, goal, action | ctx | iteration list + `_count.goals/actions` |
| `getCachedRoadmapIteration` (getOneRoadmapIteration) | rm + it, goal, action, dataSeries, org | id, ctx | iteration, goals **with series values**, actions, comments, AC |
| `getCachedRoadmapIterationByVersion` | rm + it, goal, action, dataSeries, org | roadmapId, version, ctx | same as above |
| `getCachedClientSafeRoadmapIteration` | rm + it, goal, action, dataSeries | id, ctx | goals + effects **with series values** |
| `getCachedNames` (getNames) | rm + it, goal, action | ctx | name tree for links |
| `getCachedUserInfo` (getUserInfo) | user, rm + it, goal, action, org | username, ctx | authored roadmaps/iterations with counts and comments |
| `getCachedOrgs` (getUserOrgs) | org | org id list | org names + geo area |
| `getCachedSeries` (getCuratedHistoricalData) | curatedHistoricalData; `'use cache: upstream'`, `days` / `minutes` on failure | source, geoArea | one curated external series |
| `getCachedPxWebTableMetadata` (getCuratedHistoricalData) | curatedHistoricalData; upstream, `days` / `minutes` | tableId, dataset | PxWeb table metadata + `failed` flag |
| `getCachedQuery` (scbPopulationQuery) | scbPopulationQuery; upstream, `days` / `minutes` | areaCode | population number |
| `getCachedQuery` (scbAreaQuery) | scbAreaQuery; upstream, `days` / `minutes` | areaCode | land area number |

Request-scoped (React `cache()`, not `'use cache'`): `getUserAccessContext`, `getAccessContextById` (`src/fetchers/getUserAccessContext.ts`). One lookup per render shared by layout, page and every fetcher; route handlers get one lookup per call.

`src/app/layout.tsx`, `src/lib/sorters.ts`, `src/lib/api/guardExternalApi.ts`, `getPxWebTableContent.ts`, `getTrafaTableContent.ts` only mention `use cache` in comments; they hold no cached scope.

### Tag fan-out (29 DB readers)
| Tag | Readers declaring it |
| --- | --- |
| `roadmap`, `roadmapIteration` | 27 (all but `getCachedLikeScopes`, `getCachedOrgs`) |
| `goal` | 21 |
| `action` | 20 |
| `goal` or `action` | 26 |
| `dataSeries` | 14 |
| `org` | 16 |
| `goalLike` | 2 |
| `effect`, `recipe`, `user` | 1 each |

## Mutation → revalidation matrix
✓ = revalidated, always `{ expire: 0 }`. Groups (except DELETE), memberships and auth routes revalidate nothing by design (they only change the per-request access context, i.e. the key).

| Mutation | roadmap | roadmapIteration | goal | action | dataSeries | goalLike | org | user |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| roadmap POST | ✓ | | | | | | | |
| roadmap PUT (name, type, geo, parent, **sharing/grants**) | ✓ | | | | | | | |
| roadmap DELETE | ✓ | ✓ | ✓ | ✓ | | | | |
| iteration POST/PUT (status; **creates and copies goals**) | | ✓ | ✓ | | | | | |
| iteration DELETE | | ✓ | ✓ | ✓ | | | | |
| goal POST full / section, PUT full / section (series, recipes, suggestions) | | | ✓ | | ✓ | | | |
| goal DELETE | | | ✓ | ✓ | | | | |
| action POST / PUT | | | (✓ when POST creates an effect) | ✓ | | | | |
| action DELETE | | | ✓ | ✓ | | | | |
| effect POST/PUT/DELETE (+ series) | | | ✓ | ✓ | ✓ | | | |
| recalculate POST | | | | | ✓ | | | |
| comment POST | object's tag | object's tag | object's tag | object's tag | | | | |
| goal-like POST/DELETE | | | | | | ✓ | | |
| org PUT (name, geo area) | | | | | | | ✓ | |
| group DELETE (grants cascade) | ✓ | | | | | | | |
| signup | | | | | | | | ✓ |
| group POST/PUT, org-membership PUT, verify, password | | | | | | | | |

## Audit
### Stale cache (a mutation does not revalidate a tag the reader would need)
| # | Mutation | Stale readers | Status |
| --- | --- | --- | --- |
| S1 | roadmap PUT → only `roadmap` | goal/action/effect/series/recipe readers lacked `roadmap`: revoked sharing kept serving, widened sharing kept a cached 404, renamed roadmap stale | **fixed**: every access-filtered reader declares `roadmap` + `roadmapIteration` |
| S2 | iteration POST/PUT → only `roadmapIteration` | same readers; publish/unpublish didn't show/hide goals, iteration-form goals stayed `null` in getGoalByIndicator | **fixed**: readers declare `roadmapIteration`; iteration POST/PUT also revalidate `goal` |
| S3 | goal create/delete → `goal` (+`action`) | getOneRoadmap, getRoadmaps, clientSafeGetRoadmapIterations, getRoadmapSubset, getUserInfo (counts/ids) | **fixed**: they declare `goal` |
| S4 | goal rename → `goal` | getOneAction, getActions (`effects.goal` scalars) | **fixed**: they declare `goal` |
| S5 | goal section / effect writes → `goal`/`action` | getOneRecipe (`/api/recalculate` evaluated the pre-edit recipe) | **fixed**: those writes also revalidate `dataSeries` |
| S6 | recalculate → `dataSeries` only | iteration readers, getOneAction, getActions, getOneEffect (series values without `dataSeries`) | **fixed**: they declare `dataSeries` |
| S7 | recalculate used `'max'` | every `dataSeries` reader (first request after recalc saw old values; chained recalc read stale input) | **fixed**: `{ expire: 0 }` |
| S8 | action create/delete → `action` (+`goal`) | clientSafeGetRoadmapIterations, getRoadmapSubset, getUserInfo (action counts/ids) | **fixed**: they declare `action` |
| S9 | org PUT → only `org` | every reader returning `accessControlSelection` or an org name/area | **fixed**: those readers declare `org` |
| S10 | group DELETE → nothing | readers returning `access_control.grants` (sharing editor prefill) | **fixed**: group DELETE revalidates `roadmap` |
| S11 | signup → nothing | getUserInfo (cached `null` for a not-yet-registered username) | **fixed**: signup revalidates `user` (rather than retiring `user`) |

No open S findings against the current matrix and tags.

### Over-invalidation
| # | What | Note |
| --- | --- | --- |
| O1 | Every mutation revalidates **global** entity tags with `{ expire: 0 }` | Worse after the S fixes, by design: one goal section save now expires the 21 `goal` + 14 `dataSeries` readers for every user and id; a roadmap PUT expires 27 of 29 DB readers. |
| O2 | effect *, action DELETE, goal DELETE → `goal` + `action` | Hits 26 of the 29 DB readers. |
| O3 | roadmap / iteration DELETE → 3–4 tags | Effectively flushes the DB cache. Acceptable: rare. |
| O4 | comment POST → the object's whole entity tag | Expires every goal (or action, ...) entry to show one comment. |
| O5 | recalculate → `dataSeries` | Expires 14 readers (goal pages, iteration pages, national matches, liked goals, ...) for one series, now immediately (S7). |
| O6 | `database` on every DB reader, never revalidated | Still open. No effect; a single `revalidateTag('database')` would flush everything. Dead weight. |
| O7 | Dead tags `effect`, `recipe` | Still open: declared (getOneEffect, getOneRecipe), never revalidated, covered by `action`/`goal` and `dataSeries`. `user` is no longer dead (signup). |

At current scale (single box, tens of users, writes rare next to reads) O1–O5 cost little; correctness came first.

### Memory (in-memory LRU)
| # | What | Note |
| --- | --- | --- |
| M1 | Per-user keys multiply entry size | One 531-goal roadmap version entry (`getCachedRoadmapIteration` / `ByVersion`: goals with series values) is ~6.7 MB **per user** (fat seed); an org landing is ~0.15 MB per user and org. With the default 50 MB a few users on big roadmaps evicted everything else. |
| M2 | `cacheMaxMemorySize: 256 MB` | Mitigation, not a fix: holds ~35 big version entries next to the small ones. The fix is a slimmer version page reader (board card); until then size grows with users × big roadmaps. |

### Not cached, probably should be
| Reader | Status |
| --- | --- |
| `getUserAccessContext` / `getAccessContextById` (one DB query per fetcher call) | **fixed**: React `cache()`, one lookup per request (warm page = 3 statements, README "DB instrumentation"). |
| goal page `prisma.recipes.findMany` (source `updated_at`) and parent-version `aggregate` | **fixed**: source `updated_at` comes with getOneGoal's series; the parent version is picked from getRoadmapIterations. The goal page also no longer loads the whole iteration for siblings (getGoalSiblings). |

Deliberately uncached and fine: `getOrgManagement` (manager page, must be fresh, no tag covers groups), `getOrgOptions` (forms only), `getGuestInvite` (guests disabled), `findTypeFromId`, `getUserHash`.

### Cached readers that turn failure into a cached empty result
| What | Status |
| --- | --- |
| Every DB reader caught the Prisma error and returned `null` / `[]` (an outage cached as "not found" for 15 min+) | **fixed**: fills throw (and time out via `boundedFill`); `uncachedFallback` degrades per request only. |
| `getCachedSeries`, `getCachedPxWebTableMetadata`, SCB `getCachedQuery`: network errors and 429s cached as `null` for `days` | **fixed**: failures are reported via an `onFailure` callback and cached for `minutes`; answers (including "no data") for `days`. |
| `getCachedSeries`: an exception thrown inside `fetchSeries` (not reported through `onFailure`) is caught and returned as `null` | **open**: cached for `days` as if the area had no data. |
| `getAccessContextById` returns `null` on a DB error | **open**: the request renders as anonymous (now memoized for that request only). |

## Rules
### Naming
- Entity tags: the singular camelCase model name (`goal`, `roadmapIteration`, `dataSeries`, `goalLike`). One tag per table family; child tables use the parent's tag (`actionFields` → `action`, `accessControls`/grants → `roadmap`, comments → their parent's tag, effects → `action` + `goal`, recipes → `dataSeries`).
- External data: one tag per source/catalog (`curatedHistoricalData`, `scbPopulationQuery`, ...).
- Retire `database`, `effect`, `recipe` (never revalidated; restart flushes). Do not add new tags nobody revalidates.
- **Per-id tags (`goal:<id>`, `org:<id>`): not now.** The docs allow them (any string ≤ 256 chars, ≤ 128 tags per `cacheTag` call, tags may be computed from the fetched data), but they only pay off if mutations stop revalidating the entity tag, and then every mutation must compute every dependent id: roadmap access cascades to all iterations, goals, actions, effects and series below it; effects link actions and goals; recipes read series across orgs. That bookkeeping is exactly what produced S1–S9. With entries already per user, the miss cost is small. Revisit only if instrumentation shows post-edit misses dominating; first candidates would be purely local mutations (comments, likes → `goal:<id>`) and `org:<id>` for org-landing sections.

### A new cached DB reader must
1. Be split in two: an uncached public `getX()` that calls `getUserAccessContext()` (request-memoized) and returns `uncachedFallback(() => getCachedX(..., accessContext), fallback, message)`, and a `getCachedX()` with `'use cache'` that takes the access context (or whatever user data it needs) as an argument; never read cookies/session inside.
2. Run its queries inside `boundedFill("getCachedX", async () => ...)`.
3. Use the `default` profile (no `cacheLife` call today; the 15 min revalidate is the safety net). If a reader ever needs another profile, call `cacheLife` exactly once per invocation.
4. Declare `database` (until retired) plus a tag for **every entity whose rows it returns or filters by**:
   - uses `visible*WHERE`, `readableAccessControlWHERE` or `listedGoalsWHERE` → `roadmap` + `roadmapIteration` (visibility comes from roadmap access and iteration status);
   - returns `accessControlSelection` or any org name/area → `org`;
   - returns series values or recipes → `dataSeries`;
   - returns `_count` or ids of goals/actions/effects → `goal` / `action`;
   - returns related rows (effects, goal names on actions, action names on goals, ...) → their tags.
5. **Never cache failure**: let DB errors throw out of the cached scope (a rejected fill is not stored). Return `null` / `[]` only for a result that is genuinely empty. Degrade in the uncached wrapper (`uncachedFallback`) or the page.
6. Keep the entry small: entries are per user, so a payload that is MBs per user multiplies (M1). Select only what the page reads (`getActionSummaries`, `getGoalSiblings`, `relatedGoalSelection` are the pattern).

### A new cached upstream reader must
1. Use `'use cache: upstream'` (disk-backed, shared by every request). Only for data that is neither user-specific nor derived from our DB. A user-triggered proxy (scb*Query) runs `guardExternalApi()` in its uncached caller, never inside the cached scope.
2. Declare one tag for its source.
3. Track failure with the core's `onFailure` callback and call `cacheLife` **exactly once per invocation**: `minutes` if the request failed, `days` otherwise. Cache "no data for this area" for `days`; never cache a failed request for longer than `minutes`.
4. Keep waits inside the fill bounded (429 retry at most once, `MaxRetryAfterMs`): every request for that key waits on the fill.

### A new mutation must
1. Revalidate the tag of **every table it writes**, nested creates and cascades included (iteration POST creating goals → `goal`; action POST creating an effect → `goal` too; series values or recipes → `dataSeries`; group DELETE cascading grants → `roadmap`).
2. Changes to roadmap access or iteration status also need the tags of everything below them: with reader rule 4 in place, `roadmap` / `roadmapIteration` covers it.
3. Use `revalidateTag(tag, { expire: 0 })` in route handlers (read-your-own-writes; `updateTag` is Server Actions only). `'max'` only where serving the old value once is acceptable, which excludes anything the user just edited or a later computation reads. Never the one-argument form.
4. Revalidate after the write commits, inside the success path.

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
