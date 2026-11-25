# Reads behind the HTTP API: what the code says (eco-planner, branch `dev` at 2758d277)

> Read-only probe by an agent on 2026-11-25, of branch `dev` at 2758d277. Nothing was run; see "Not verified" at the end.
> It is a snapshot for a decision, not maintained documentation: `docs/context/` is the current reference.

Read-only investigation; nothing in the repo, git or the board was touched, no server was started. Paths are relative to the repository root. Counts come from grep/glob over `src/` and `tests/` in the main checkout; the method is given with each.

## 1. Bottom line

- **Recommendation: option (b)**, a shared read layer with a thin GET route per read and server components calling it in-process, plus real HTTP for the reads the browser already fetches itself.
- **Size:** 42 live read entry points, 0 of them with a JSON GET endpoint today. Three slices are small, three medium, two large (roadmaps/versions and goals).
- **Pilot:** `GET /api/data-series?id=`. It is the smallest read that is used both from the browser and in-process on the server.

## 2. Where the premise is off

1. **No domain read endpoint exists.** There are 6 GET handlers and none returns domain JSON (section 4).
2. **Pages are not the only read channel.** 11 reads are already called from the browser as Next server actions: 7 `clientSafe*` fetchers and 4 external-statistics proxies. They are Next-specific RPC and the natural first conversions.
3. **View access is already inside the read.** 28 of 31 cached DB scopes filter in the query through `src/lib/accessFilters.ts`. Two things are not in the read:
   - 7 readers leave an access decision to the caller or have none (section 3).
   - Edit/admin level is computed in pages: 36 `accessChecker` / `isSuperAdminAccess` call sites in 16 page files, 2 components and 1 fetcher. They work from `access_control.grants`, which travels with the payload (`src/fetchers/inclusionSelectors.ts:8-20`).
4. **"Org report" and "server-rendered SVG" are not on `dev`.** All 12 graph components are client components on ApexCharts. A branch `org-pdf-export` exists in a worktree, which I did not read.
5. **The app is already mostly client-rendered.** 110 of 169 `.tsx` files under `src/app` and `src/components` are `"use client"`. Pages are thin loaders that pass whole Prisma payloads as props.
6. **The test suite already works around the missing read API.** 139 helper calls in specs scrape the RSC flight payload (section 8).

Docs versus code:
- `caching.md` lists 29 DB readers; the code has 31 cached DB scopes. `getCachedUserComments` and `getCachedLikeArea` are missing from it, and `getCachedRoadmaps` now also keys on `hidden`.
- Its mutation matrix names removed routes (verify, password) and "signup" for the `user` tag, which is now `PATCH /api/user` (`src/app/api/user/route.ts:35`). Attachment and banner revalidations are absent.
- "Every DB reader is a wrapper plus `getCached*`" has four exceptions: `getOrgManagement`, `getOrgOptions`, `getGuestInvite` (uncached by design) and a direct Prisma read in `src/app/welcome/page.tsx:39`.
- `docs/context/caching-and-navigation.md` says dates come back from the cache as strings. The code is mixed: 27 `new Date(...)` wraps, and 16 direct Date-method calls on fetched fields (for example `src/app/roadmap/[roadmapId]/[version]/page.tsx:174`). I did not check which holds at runtime.

## 3. Read inventory

Method: exported async functions in `src/fetchers/*.ts`, plus every importer of `@/lib/prisma` and every `"use server"` file in `src/`.

| Group | Count | Notes |
| --- | --- | --- |
| Exported async read entry points in `src/fetchers` | 42 | 37 live, 4 dead, 1 internal (`resolveSeriesRef`) |
| Dead | 4 | `getActions`, `getNames`, `getRoadmapSubset` (no callers), `getGuestInvite` (its page answers 404) |
| Live reads outside `src/fetchers` | 5 | welcome page Prisma read; 4 statistics server actions |
| **Live reads in total** | **42** | 37 + 5 |
| Called from the browser today (server actions) | 11 | 7 `clientSafe*`, 4 statistics proxies |
| With a JSON GET endpoint | 0 | |
| Cached DB scopes (`'use cache'`) | 31 | default profile, entity tags, key includes the full `UserAccessContext` |
| Upstream cached scopes (`'use cache: upstream'`) | 4 | disk-backed, `days` / `minutes` |
| Uncached DB reads | 4 | `getOrgManagement`, `getOrgOptions`, `getGuestInvite`, welcome page |

Further facts:
- **Shape of a reader.** A public wrapper resolves the session itself through `getUserAccessContext()` (React `cache()`, `src/fetchers/getUserAccessContext.ts:72`) and calls a module-private `getCached*` that takes the context as an argument (example: `src/fetchers/getOneGoal.ts:18-45`). No public reader takes the session as an argument.
- **Errors are swallowed.** The wrapper's `uncachedFallback` turns a failure into `null` or `[]` (`src/fetchers/cacheFallback.ts:17`). A GET route cannot tell 404 from 500 unless it calls the throwing inner function, which is not exported today.
- **Seven readers take a translator `t`** and return translated labels: the three `getCuratedHistorical*`, `getNationalGoalMatches`, `resolveSeriesRef`, `getGoalPrefill`, `getScaledPreviewPrefill`.
- **Write routes do their own reads.** 71 Prisma `find*` / `count` calls inside `src/app/api` use the per-item checker and bypass the fetchers.
- **Other Prisma reads** (`src/lib/session.ts:59`, `enrollment.ts`, `seriesInvariants.ts`, `attachments.ts`, `pruneOrphans.ts`, `persistence.ts`) are session or write-path internals.
- **Two more dead server actions:** `scbPopulationQuery` and `scbAreaQuery` have no UI caller.

Access control per read:

| Where the decision lives | Readers |
| --- | --- |
| In the query (filters) | 26 live readers: all roadmap, version, goal, action, effect, series, recipe, user-info readers and the 7 `clientSafe*` |
| In the function body | `getOrgManagement` (managers), `getOrgOptions`, `getUserOrgs`, `getLikeArea` |
| Partly in the caller | `getLikedGoals` (needs only a login; org membership is checked in `src/app/page.tsx:64-69`), `getLikedGoalsInArea` ("Callers check", `src/fetchers/getGoalLikes.ts:191-199`), `getUserComments` (any author id; the page restricts it to the own profile, `src/app/user/[username]/page.tsx:72`) |
| None | `getLikeScopes(orgId)`, the three `getCuratedHistorical*` ("Not a public endpoint", `src/fetchers/getCuratedHistoricalData.ts:30`) |
| Login plus rate limit | the 4 statistics actions (`src/lib/api/guardExternalApi.ts:40`) |

The 7 readers in the "partly" and "none" rows are safe only because nothing outside a server component can call them. Exposing them 1:1 would leak or open an upstream amplifier.

## 4. Existing API surface

Method: `find src/app/api -name route.ts` and exported handlers.

| | Count |
| --- | --- |
| Route files | 24 |
| Handlers | 43 (16 POST, 9 PUT, 10 DELETE, 2 PATCH, 6 GET) |
| GET serving domain data as JSON | 0 |
| GET serving domain binaries | 2: `attachment/[attachmentId]` (access check, 302 to a presigned link), `org/[orgId]/banner` (image, `seesOrg`) |
| Other GET | `locales`, `health`, `test/db-stats`, `test/outbox` |

Conventions a GET would inherit:
- **Auth:** `getSession(await cookies())` then `getAccessContextFor(session.user)`. 401 carries `Location: /login`. The two domain GETs call `getUserAccessContext()` and allow anonymous visitors.
- **Authorisation:** `accessChecker` per item, or a filter in the `where`.
- **Validation:** hand-written type guards (`src/types/typeguards.ts`, 508 lines; recipe guards 545 lines). There is no zod or other schema library in `package.json`.
- **Errors:** `{ message }` with a translated text from `serveTea("api")`; 308 of 318 `Response.json` calls have that shape. No machine-readable error codes.
- **Addressing:** ids travel in the body for PUT/DELETE; only two routes use path params. `docs/context/goal-api-and-forms.md` says not to add goal sub-endpoints, so reads fit as `GET /api/goal?id=`.
- **Casing:** write inputs are camelCase (`orgId`, `accessLevel`); reads return Prisma snake_case payloads. A read contract has to pick one.

## 5. Consumers

33 `page.tsx`, 1 layout. 27 pages perform domain reads; 6 do not (info, login, login/link, signup, two test pages). The layout's sidebar reads the session and access context on every page.

| Page | Reads (×2 = repeated in `generateMetadata`) |
| --- | --- |
| `/` | `getRoadmaps`, `getUserOrgs`; streamed: `getActionSummaries`, `getLikeScopes` + `getLikedGoals`, `getNationalGoalMatches`, `getCuratedHistoricalData` |
| `/goal/[id]` | `getOneGoal` ×2 (+ secondary goal), `getGoalSiblings`, `getRoadmapIterations`, `getGoalByIndicator` × (parent + each child); streamed: `getGoalLikeSummary`, `getUserOrgs` + `getCuratedHistoricalEntries`, `getScaledPreviewPrefill` |
| `/roadmap/[id]/[version]` | `getRoadmapIterationByVersion` ×2 |
| `/roadmap/[id]`, `/roadmap/[id]/edit`, `/roadmap/create`, `/roadmap/[id]/iteration/create`, `/roadmap/[id]/[version]/edit` | `getOneRoadmap` or `getRoadmapIterationByVersion` (×2), plus `getRoadmaps` and `getOrgOptions` for the forms |
| `/goal/create`, `/goal/[id]/edit`, 4 goal section pages | `getOneGoal` ×2, `getRoadmaps`, `getOneRoadmapIteration`, `getGoalPrefill` |
| `/action/[id]`, `/action/[id]/edit`, `/action/create`, `/actions` | `getOneAction` ×2, `getActionNeighbours`, `getActionSummaries`, `getOneGoal`, `getOneRoadmapIteration`, `getRoadmapIterations` |
| `/effect/create`, `/effect/[a]/[g]/edit` | `getOneEffect`, `getOneAction`, `getOneGoal`, `getRoadmapIterations` |
| `/user/[username]` | `getUserInfo`; own page also `getRoadmapIterations`, `getRoadmaps`, `getUserComments` |
| `/likes/[areaCode]`, `/org/[orgId]/groups`, `/org/[orgId]/historical-data/[entryKey]` | `getLikeArea` + `getLikedGoalsInArea`; `getOrgManagement`; `getUserOrgs` + `getCuratedHistoricalEntry` |
| `/welcome`, `/roadmap/.../iteration/[iterationId]`, `/invite/[token]` | direct Prisma; redirect lookup; dead |

Patterns:
- **Every page is a server component passing data to client components.** 35 client components import Prisma-payload entity types from `@/types`.
- **Streaming is rare.** 7 `<Suspense>` boundaries in 2 pages (start page 4, goal page 3). No `loading.tsx` or `error.tsx`. The layout sets `instant = false` (`src/app/layout.tsx:14`).
- **Parallel fetching** uses `Promise.all` in nearly every page.
- **De-duplication relies on `'use cache'`**, not on React `cache()`: 30 pages have `generateMetadata`, and many repeat the entity read there.
- **`getRoadmaps` is loaded by 7 pages**, mostly to fill pickers, although it returns full roadmaps with versions, comments and access controls.
- **Client-side reads via server actions:** 14 call sites of `clientSafeGet*` in 9 client files. `src/components/recipe/context/roadmapDataCache.ts:53` loads every visible version and then each one in full (its own TODO at line 37 says so).

Awkward over HTTP:
- **Version payload.** One big version is about 6.7 MB per user in the cache (531 goals, `next.config.ts:42`). It already goes to the browser in full, because `Goals` and `AdminPanel` are client components that receive the whole `iteration` (`src/app/roadmap/[roadmapId]/[version]/page.tsx:95-98`, `212-213`). JSON over HTTP is no larger; going through HTTP on the server would serialise it twice.
- **Composite readers.** `getGoalPrefill`, `getScaledPreviewPrefill`, `getNationalGoalMatches` and the curated catalog combine DB reads, upstream statistics, catalog config and translated names.
- **Server i18n.** 79 `serveTea` call sites in 51 non-API files.
- **Server-side recipe evaluation** happens only in `/api/recalculate` (`src/app/api/recalculate/route.ts:75`); pages parse recipes but do not evaluate them.

## 6. Serialisation boundary

- **Dates are the only non-JSON scalar.** The schema has 27 `DateTime` columns, one `Float`, one `Json` (`Recipes.recipe`), and no Decimal, BigInt or Bytes. Date fields from readers are used at 48 places in 25 files outside the API. Tests already see them as `$D<iso>` in the flight payload.
- **Recipe JSON.** The column holds either a JSON string or a plain object (`docs/context/data-series-and-recipes.md`). Only `Recipe.from` normalises it, so a DTO should carry `SerializedRecipe`. No reader returns a `Recipe` instance; no Map or Set crosses a reader boundary.
- **Units.** The database uses `null` for unitless and `""` for missing; the documented wire rule is flags (`UNITLESS`, `MISSING_UNIT`). Readers return the raw database convention today. `parseUnit` cannot be reused as the mapper: it also strips diacritics for mathjs (`src/functions/unit.ts:17-25`).
- **Types are shared by import.** `Prisma.XGetPayload<typeof selector>` in `src/types/types.ts` is the contract on both sides. That exposes relation names such as `_count` and `recipe_used.source_data_series`, and four overlapping shapes for a version.
- **A typed contract needs** explicit JSON-safe DTO types per read and, if another language is to implement it, a schema that can be exported. Nothing of that exists. Adding a schema library is a decision for the owner.

## 7. Auth and caching consequences

- **Cost of authenticating one request:** 3 statements (measured, `tests/e2e/db-budget.spec.ts:20`). React `cache()` shares that lookup only within one render; "route handlers get one lookup per call" (`src/fetchers/getUserAccessContext.ts:10`). The access context is deliberately not cached across requests (line 66).
- **If server components fetched the API over HTTP:** each read pays those 3 statements again. My estimate from the reads per page, not measured: start page about 24, goal page 27 or more, against a budget of 4. The spec records 24 / 24 / 29 / 12 as the numbers before request memoisation (`db-budget.spec.ts:23`), so this would undo that work. Avoiding it needs a cross-request access-context memo with invalidation on every membership, group and grant write, like `forgetProxySession`.
- **Also needed for server-side HTTP:** forwarding the session and `locale` cookies and `Accept-Language`; an internal base URL (`src/lib/baseUrl.ts` holds the public one); a second pass through `src/proxy.ts`, which has no matcher and runs for `/api` too.
- **Cache tags map cleanly at the reader.** A route handler can call a `'use cache'` reader: `/api/recalculate` already calls `getOneRecipe` and `clientSafeGetOneDataSeries`. Tags, per-user keys and `revalidateTag(..., { expire: 0 })` stay as they are. Responses are per user, so HTTP caching should be `private, no-store`.
- **If reads move to the browser:** `revalidateTag` does not reach it. Today freshness after a write comes from 22 `router.refresh()` sites and navigation. Client-side reads need their own invalidation, and no data library (SWR or similar) is installed.

## 8. Options

| | (a) server components fetch the API | (b) shared read layer + thin GET, in-process for pages | (c) load data in client components now |
| --- | --- | --- | --- |
| Buys | The Next app truly uses its API | One place per read for access; a tested HTTP contract; pages unchanged | Closest to the Vite end state |
| Costs | N × 3 statements per page; double serialisation; cookie and locale forwarding; internal URL | Two entry points per read; DTO work per slice | 34 server pages/layout, 15 async server components and 79 `serveTea` sites to rewrite; a client cache and invalidation layer |
| Breaks | Query budget; the bundled Next docs advise against it ("do not call Route Handlers from Server Components", `node_modules/next/dist/docs/01-app/02-guides/production-checklist.md:63`) | Nothing at runtime | Server rendering of public pages and metadata that depends on data; streamed 404s |
| Incremental | Yes, per read | Yes, per read | Per section, but each needs the endpoint first |

**Why (b).** The readers are already close to a service layer, with view access in the query and cache at the function. What is missing is the HTTP face, error mapping, JSON-safe DTOs, and moving the 7 caller-side checks inside. Each slice pays for itself:
- the 11 server-action reads become plain endpoints that tests can mock (the manifest calls the content fetch "unmockable", `tests/MANIFEST.md:102`);
- API specs can read entities back with a GET where they scrape pages today;
- access on reads gets a contract test per endpoint.

It also keeps the budget and streaming intact, and it is the prerequisite for (c), which can follow section by section.

**Strongest argument against (b).** The pages still do not use the HTTP contract, so only tests and the browser-initiated reads exercise it. A backend in another language reuses none of the read layer, only the contract and the specs. And the expensive part of a Vite move, server components and server i18n, is untouched. Mitigation: pages consume the same JSON-safe DTO the route returns, and browser-initiated reads go over HTTP from the first slice.

## 9. Sizing by slice

| Slice | Live reads | Complications | Size |
| --- | --- | --- | --- |
| Data series and recipes | 2 | Access derived from the goal or effect slot; unit convention; `getOneRecipe` is only used by API routes | S (pilot) |
| Action option readers | 3 | Already called from the browser; `string[]` or small lists | S |
| Comments, attachments | 0 own | Embedded in parent payloads; the download GET exists | S (comes with parents) |
| Orgs, users, identity | 7 | A "who am I" read with the effective super-admin flags; `getUserComments` ownership moves in; `getOrgManagement` is uncached and manager-only | M |
| Likes | 5 | 3 of 5 have caller-side or no access checks; already camelCase DTOs | M |
| Actions and effects (rest) | 4 | Few; follows the roadmap access rules | M |
| External statistics | 7 | Guard and rate limit in every route; the curated readers have none; translated catalog names; disk cache | M |
| Roadmaps and versions | 7 | Largest payloads; four overlapping version shapes; grants in the payload versus a computed access level; picker use of `getRoadmaps`; the recipe editor's load-everything pattern | L |
| Goals | 7 | 4 plain reads are M; 3 composite prefill readers mix DB, upstream, i18n and recipes; single-endpoint rule | L |

Cross-cutting groundwork, size S: a throwing `read*` function per reader, a GET helper for parameter parsing and error mapping, DTO types, a client fetch helper, a test `getJson` helper, and deleting the 6 dead readers before exposing anything.

## 10. Order and pilot

Order: groundwork, data series (pilot), action option readers and `clientSafeGetOneGoal`, orgs/users/identity (largest test payoff), likes, actions and effects, plain goal reads, roadmaps and versions, external statistics and the composite goal readers.

**Pilot: `GET /api/data-series?id=<uuid>`.** The reader `clientSafeGetOneDataSeries` is already used from the browser (`src/components/recipe/context/recipeContext.provider.tsx:98`, `src/components/pages/sections/scaledGoalPreviewToggle.tsx:70`) and in-process (`src/app/api/recalculate/route.ts:75`), through the evaluator's injected `dataSeriesGetter`.

1. **Reader.** New `src/fetchers/getOneDataSeries.ts` with `server-only`. It cannot stay in the current file: every export of a `"use server"` file becomes a public action. Export `readDataSeries(id, ctx)` (today's cached body, same tags, throws) and `getOneDataSeries(id)` (wrapper, `null` on failure).
2. **Route.** `src/app/api/data-series/route.ts`, `GET`.
   - Bad or missing id: 400.
   - `getUserAccessContext()`, anonymous allowed.
   - Call `readDataSeries` directly; a throw answers 500 with `{ message }`.
   - `null` answers 404, the same for "missing" and "no access".
   - 200 with `Cache-Control: private, no-store`.
3. **DTO.** `{ id, unit, values: [{ timestamp: ISO string, value }] }`, ascending. Trim `values`: the current selection returns whole `DateRecords` rows (`src/fetchers/inclusionSelectors.ts:349-353`).
4. **Callers.** The two client sites use a fetch helper; recalculate uses `getOneDataSeries`. Then delete `src/fetchers/clientSafeGetOneDataSeries.ts` and its export in `src/fetchers/client/index.ts`.
5. **Spec.** `tests/api/data-series.spec.ts` in project `api`, on the `sandbox` fixture:
   - 400 and 404;
   - public series readable anonymously;
   - ORG sharing: anonymous and orgless 404, member 200;
   - draft version: RO 404, RW 200;
   - effect series needs both action and goal;
   - response shape;
   - a goal series write shows at once (`dataSeries` tag);
   - a sharing change flips access at once (`roadmap` tag).
6. **Docs.** Update the reader table in `caching.md`.

Decision for the owner in the pilot: which unit convention the wire uses. Keeping the database convention (`string | null`) changes no consumer but contradicts the documented wire rule; flags need a mapper that is not `parseUnit`. The evaluator accepts either: `src/functions/recipe/extractors.ts:175` parses the unit and line 185 wraps the timestamp in `new Date`.

## 11. Test safety net

- **Today:** 150 API tests in 25 spec files, 106 e2e tests, 596 unit tests (counted by `test(` lines). API specs cover writes thoroughly.
- **Reads are asserted indirectly.** `pageStatus` / `expectPageStatus` (99 calls) checks that a page is visible. The rest scrape the RSC payload (`tests/lib/api.ts:100`, `:409`):

| Helper | Calls in specs |
| --- | --- |
| `pageEntity` | 51 |
| `flightPayload` | 19 |
| `orgIdByName` | 25 |
| `groupIdByName` | 21 |
| `membershipIdByUsername` | 8 |
| `membershipRole` | 9 |
| `startPageTitle` | 5 |
| `flightObjectAt` | 1 |
| **Total** | **139** |

- **The ladder is pinned at unit level.** `tests/unit/access-filters.test.ts` (24 tests) checks the filters against the checker (19 tests).
- **Needed while moving reads:**
  - a contract spec per GET: the access ladder across the seeded users, response shape, 400/404, read-after-write per tag;
  - a negative test for each of the 7 readers whose check moves inside;
  - the budget spec unchanged as the guard against accidental HTTP hops;
  - migrating the scrape helpers to GETs as each slice lands.

## 12. Logic shared between browser and server

Method: modules under `src/functions`, `src/lib`, `src/types` and `src/math.ts` imported directly by at least one client file and by at least one API route, fetcher or `persistence.ts`. Result: 29 modules, 3,660 lines; transitive imports are not counted.

| Area | Size | Constraint on another backend language |
| --- | --- | --- |
| Recipe evaluator (`recipe.ts` 814, `extractors.ts` 260, `vectorAndMaskUtils.ts` 298, `src/math.ts` 264, recipe type guards 545) | about 2,200 lines plus mathjs | The server evaluates only in `/api/recalculate`; goal writes store values the browser evaluated. It must be ported or recalculation moved to the client. |
| External statistics clients (`src/lib/api`) | 1,884 lines | Used by browser, server actions, curated catalog and seed. |
| Validation guards (`src/types/typeguards.ts`) | 508 lines | The write contract; would be re-specified as a schema. |
| Access ladder (`accessChecker.ts` 117, `accessFilters.ts` 266) | 383 lines | Implemented twice and kept in sync by a unit test; a third copy would be needed. |
| Unit parsing, sorters, goal names, fields, enums | about 800 lines | Small, but `sorters.ts` has 11 server importers. |
| Translated API messages (`serveTea("api")`) | 308 responses | A backend needs the `api` namespace or error codes. |
| Scaling rules and curated catalog (`leapScaling.ts` 392, `curatedHistoricalData.ts` 427, suggestion builders 733) | about 1,550 lines | Run on the server for prefill and seed, in the browser for forms. |

## 13. Risks and unknowns

- A read contract in Prisma shapes freezes database naming. Deciding the DTO style (snake_case selection shapes or camelCase like the write inputs and the like/org DTOs) before the large slices avoids doing them twice.
- Grants are in page payloads today. Replacing them with a computed, viewer-specific access level changes 36 call sites, but stops publishing group ids.
- Per-user cache entries make large JSON reads expensive to cache twice; keep the cache at the reader.
- Mapping "not found" and "failed" needs the throwing path. Pages keep the swallowing wrapper, so behaviour differs by entry point on purpose.
- A separate-origin frontend raises CORS, cookie scope and CSRF questions that this step does not answer.

Not verified:
- Anything at runtime. The statement estimates for option (a) are arithmetic from reads per page; the 3-statement and 6.7 MB figures are taken from comments in the repo.
- Whether dates survive `'use cache'` as Date objects.
- That a GET handler calling a cached reader behaves like the existing POST handlers that do so.
- The worktree branches, including `org-pdf-export`.
- The bodies of the e2e specs and most write routes beyond their structure.
- Whether PxWeb table list and metadata calls, which run directly from the browser, depend on CORS behaviour of the sources.
- Next docs beyond the lines cited.

Key files:
- `src/fetchers/` (readers; `clientSafeGetOneDataSeries.ts`, `getGoalLikes.ts`, `getUserComments.ts`, `getCuratedHistoricalData.ts`, `inclusionSelectors.ts`, `cacheFallback.ts`, `getUserAccessContext.ts`)
- `src/lib/accessFilters.ts`, `src/lib/accessChecker.ts`, `src/lib/session.ts`, `src/proxy.ts`
- `src/app/api/` (24 route files; `recalculate/route.ts` shows a route calling cached readers)
- `src/types/types.ts`, `src/functions/unit.ts`, `src/functions/recipe/extractors.ts`
- `src/components/recipe/context/recipeContext.provider.tsx`, `src/components/recipe/context/roadmapDataCache.ts`
- `tests/lib/api.ts`, `tests/e2e/db-budget.spec.ts`, `tests/api/access.spec.ts`
- `caching.md`, `next.config.ts`
