# Test manifest

Written 2026-10-07 when the whole test suite was deleted for a clean slate. It records what the
old suite covered, what it got wrong, and which tests the new suite should contain. The old
files are recoverable from git at `a3edab07` (`git show a3edab07:tests/e2e/goals-tests.spec.ts`
and so on; `goal-copy.spec.ts` only ever existed on dev, see `7ecdee09`).

The screenshot layer (config, spec, viewer templater, GitHub Pages workflow) was removed outright
rather than reset: it was unused and slow.

Three sections:

1. [Harness](#harness) — what is still in `tests/` and how it runs.
2. [The deleted suite](#the-deleted-suite) — inventory, coverage map, and lessons.
3. [Tests to write](#tests-to-write) — prioritised suggestions for the new suite.

---

## Harness

Everything here survived the reset. Playwright is the runner for both layers.

| Script | Config | Matches | Needs |
|---|---|---|---|
| `yarn test:unit` | `playwright.unit.config.ts` | `unit/**/*.test.ts` | nothing (no DB, no app) |
| `yarn test:e2e` | `playwright.e2e.config.ts` | `e2e/**/*.spec.ts` | app on :8081 (docker stack or `SAF_LOCAL_TESTS=true`) |
| `yarn test` | both | | |

Both scripts pass `--pass-with-no-tests` so an empty layer is green rather than "No tests found".

- **Auth states.** `login.setup.ts` logs in through the `/login` form and saves
  `tests/.auth/{admin,verified,guest}.json` (gitignored). The e2e config runs it as the `setup`
  project before the browser projects. It also holds two `setup.fail` negatives
  (unverified user, bad credentials) which are the only login-failure checks left.
- **Seed users** (`scripts/prisma/seed/seed-users.ts`): `admin/admin` (super admin, manager of
  "Sustainable Action"), `anita/anita` (plain member), `anton/anton` (unverified, cannot log in),
  `greta/greta` (GUEST, guests disabled), `orgless/orgless` (no memberships). Every place org in
  `places.ts` has members `first.last` with password `password`, reachable via `memberSlug()`.
- **Seed content** the old specs leaned on: roadmaps "Rikets färdplan" v1+v2 (public), "Uppsala
  län" v1 (ORG sharing, RO grant to "Hållbarhetsgruppen"), the LEAP scenario and its per-place
  copies, unlisted goals "Dold nationell/regional målbana", preset recipe id
  `scalar-recipe-dummy-uuid`.
- **Helpers kept in `tests/lib/`:** `env.ts` (`boolEnv`, used by configs), `org-switcher.ts`
  (`orgLandingHref` reads `/?org=<id>` off the start page), `switch-language.ts` (sidebar
  language dialog), `stemFixtures.ts` (deterministic PxWeb `/tables` + metadata for STEM
  EN0123_1, for `page.route` mocks and fetch stubs).
- **CI** (`.github/workflows/build-and-publish.yaml`) runs `yarn test` on push/PR to `main` and
  `dev`; a failed test step blocks the image push. The docker test stack is
  `docker/compose.testing.yaml` (mariadb + seed image + app).
- **Config gotchas.** `locale: "cimode"` means UI text renders as i18n keys, so assert on keys
  (`home.title`), not prose. `fullyParallel` is off; `workers: "80%"`; `retries: 1`; e2e test
  timeout 90 s because goal-edit flows were slow on loaded CI webkit. Hidden Activity routes
  stay mounted (`cacheComponents`), so locators need `.filter({ visible: true })`.
- `tests/i18nTestVariables.ts` was deleted: nothing imported it, and it duplicated
  `i18n.config.ts`.

---

## The deleted suite

39 test files and 1 screenshot spec, roughly 8 200 lines. Numbers are per file at `a3edab07`
(`goal-copy.spec.ts` at `7ecdee09`).

### Unit (`tests/unit/`, 19 files, 3 055 lines)

| File | Module under test | What it checked |
|---|---|---|
| `recipe-unit.test.ts` (1035) | `functions/recipe/*`, `math.ts` | Recipe serialize/deserialize round trip, legacy display-name placeholders, id normalisation and collisions, evaluate with injected data-series/external getters, overlap-only years, non-Jan-1 timestamps, no-overlap error; extractors for scalars/series/externals incl. pick-by-year and missing-getter errors; `pickDateValues` first/last/mean/median/year/reverse; vector ↔ date-values with NaN gaps and unit-mismatch → `Missing`; sanity-check warnings; `reachBy` line through start/target; `trend` fit, horizon, no backcast, rejects <2 points. |
| `table-catalog.test.ts` (160) | `lib/api/tableCatalog.ts` | Free-text, variable (ANDed), time-unit and coverage-year filters incl. `2020K1` periods; variable facets exclude the PxWeb contents placeholder, merge case-insensitively, sort by count; time-unit facets in canonical order. Near-complete. |
| `curated-historical.test.ts` (204) | `lib/curatedHistoricalData.ts` | Catalog shape lint: unique keys, categories in enum, every source resolvable, region variable left unselected, PxWeb needs ContentsCode / Trafa needs metric, names are literal keys present in every locale; `findRegionCodeByLabel` prefix match; `buildRegionSelection` for code / label-prefix / Trafa (county + municipality) / none; national goal mappings point at existing series with a municipal candidate. |
| `leap-scaling.test.ts` (170) | `lib/leapScaling.ts`, `leapSuggestedRecipes.ts`, `math.extend` | Rule table re-asserted (copy / population / ratio / fuel class / vehicle class / share / point); suggested methods fill regions, use `extend(year, …)`, latest uses `pick: Last`; exact equation string snapshot for the share rule; `extend()` fills leading/interior/trailing NaN. |
| `leap-copy-plan.test.ts` (160) | `scripts/lib/leapCopyPlan.ts`, `statisticsSnapshot.ts` | Seed tooling: method ladder per LEAP row, externals materialised once, copies evaluate to national × local share, local statistic becomes history, missing statistic falls to next method, required-statistics key set, snapshot round trip. Doubles as an integration test of real recipe evaluation. |
| `action-origins.test.ts` (120) | `scripts/lib/actionOrigins.ts`, `fields.actionContentDiffers` | One-off prod backfill (done 2026-09-14): clustering by catalogue number, umbrella org reuse, drift flags, SQL string contains, `actionContentDiffers` ignores origin-only headers. |
| `parse-goal-csv.test.ts` (110) | `functions/parseGoalCsv.ts` | `;` and `,` detection, RFC 4180 quoting, CRLF, BOM, Windows-1252 fallback; `csvToGoalList` full-target goals with ISO keys, decimal comma and grouped thousands, metadata/blank rows, missing header throws, hide column (`Hide`/`Unlisted`/`Dold`) → UNLISTED, deprecated `Scale` warning. Solid. |
| `orgless-access.test.ts` (106) | `lib/accessChecker.ts` | Orgless user: PUBLIC → View, ORG → None, foreign-group grants → None, DRAFT hidden, comment allowed; members: ORG → View, RW grant → Edit, manager → Admin. One tautological test re-implemented the sidebar can-create predicate inline. |
| `suggested-recipes.test.ts` (93) | `defaultSuggestedRecipes.ts` | Population preset fills regions from geo area (TAB628, 00 + muni), Trafa preset takes county + muni, template without areas, copy preference LocalScale → Population → Scalar, `prefillForArea` per target area, `isUnscaledSuggestion`. |
| `national-historical.test.ts` (77) | `scripts/lib/nationalHistorical.ts`, `getHistoricalSourceFromRecipe` | One-off fill script: fetched series kept verbatim, scaled historical wrapped via `${x} * ${omrakning}`, SQL and report string contains. |
| `leap-national-series.test.ts` (67) | `lib/leapNationalSeries.ts` | Pure re-assertion of the STEM/Trafa table ids, value codes and scale factors in the mapping. No logic. |
| `locale-files.test.ts` (535) | `public/locales/**`, `src/**/*.tsx`, `scripts/lib/localeKeyScan.ts` | Repo lint: namespace files exist / no extras / not empty per locale; en keys ⊆ every locale and vice versa; `$t()` nested keys resolve; balanced braces; no root-level strings outside `common`; `t("…")` literals in code are defined everywhere; `<Trans>` keys and `components` props; server/client mixing heuristic. Three tests permanently skipped (common-value duplication ×2, hard-coded Swedish). |
| `local-scale.test.ts` (39) | `functions/localScale.ts` | Anchor at local latest year, nearest-goal-year fallback, scale by ratio, null for empty/zero. |
| `px-web-tables.test.ts` (45) | `lib/api/pxWeb/getPxWebTables.ts` | Happy path only, stubbing `globalThis.fetch`: label gets `(id)` suffix, variableNames/timeUnit/periods kept. |
| `parse-decimal-input.test.ts` (33) | `functions/parseDecimalInput.ts` | Signed decimals, `1e3`, decimal comma, NBSP/thin-space grouping, null not NaN for garbage. |
| `goal-name.test.ts` (29) | `functions/goalName.ts` | Named goal keeps name, unnamed → indicator leaf, blank → null, context drops leaf and leading key. `goalTitleWithLevel` untested. |
| `action-fields.test.ts` (25) | `functions/fields.parseCsvList` | Splits on `, ; tab newline`, strips quotes, drops empties. |
| `series-ref.test.ts` (24) | `lib/seriesRef.ts` | `curated:<entry>/<series>` round trip, case-insensitive kind, 13 malformed inputs rejected. Complete. |
| `listing.test.ts` (23) | `lib/listing.isGoalListed` | LISTED/FEATURED for viewers, UNLISTED only for editors. |

### E2E (`tests/e2e/`, 20 files, 3 935 lines, chromium + firefox + webkit at 1920×1080)

| File | Auth | What it checked |
|---|---|---|
| `roadmaps-tests.spec.ts` (558) | admin, serial | Create roadmap (all fields: tiptap description, org, type, actor, geo area "Uppsala län", sharing ORG, RW grant to group, parent Rikets) → redirected to iteration create → publish → `/roadmap/<id>/v<n>`; edit iteration and roadmap with and without changes; `/iteration/<id>` redirects to the version slug (also with a bogus roadmap id); required-fields variant of all of the above; sharing GROUPS + grant round trip. No cleanup, so each run left two roadmaps per browser. |
| `action-effect.spec.ts` (513) | admin, serial | Create/edit action with required and all fields (descriptive field rows COST_EFFICIENCY etc., years); create from the roadmap admin panel; **field order persists as entered** (list items too); goal page separates own actions (`goal-action-row`, collapsible) from foreign effects (`goal-foreign-effect-row`) created via `/effect/create` on a v1 action. |
| `goals-tests.spec.ts` (418) | admin | Create manual goal required-only and all fields (30 rows, baseline INITIAL_NON_ZERO, featured); **decimal comma and grouped values in the grid (#110)**; edit round trips for every field incl. unnamed-goal placeholder from `indicatorParameterLeaf`; switch to suggested inheritance with the scalar preset and a 3-level tree pick of a parent series. Relied on create running before edit without `describe.serial`; 31 `expect.soft`. |
| `caching.spec.ts` (390) | admin, own API fixtures | Regression suite for cacheComponents/Activity: goal and action edit forms still save after browser back and after a Link revisit (no stale alert); half-filled roadmap form keeps input across a round trip; org rename shows in the start-page switcher; **stale-form guard: second context's PUT → 409 + one alert** after another save. Best-isolated spec: creates its own roadmap/iteration/goal/action via `/api/*` and deletes them in `finally`. |
| `goal-likes.spec.ts` (216) | anita; Kiruna + Boden members via `/api/login`; admin | Like toggles aria-pressed and count, survives reload, lists on org landing without a copy link; unlike from the list; a like from another municipality shows only in the county scope (`?likes=county`), org-count badge; managers set org area, unknown area code → 400. |
| `unlisted-goals.spec.ts` (202) | admin / anita / anonymous | Editors get an unlisted tab, unlisted goals absent from list and featured strip; read-only members and anonymous visitors see neither tab nor goal; direct link still resolves for read access; create unlisted via `#isUnlisted` and find it only under the tab. |
| `query-builder.spec.ts` (187) | admin, `page.route` mock of STEM API with `stemFixtures` | Catalog search, variable facet, time-unit and coverage-year filters narrow the list; single-metric table auto-selects its metric and unlocks the variable selects; changing form page scrolls the dialog to top. No data fetch (server action, unmockable). |
| `org-management.spec.ts` (178) | admin serial; anita | Member list collapsed and complete, GUEST row shows no role select; own role locked, promote/demote Anita round trip; seeded group renders as a row; create group via searchable multiselect; duplicate name rejected; rename + change members; delete requires arming; non-managers get 404 page and PUT `/api/org-membership` 404 / POST `/api/group` 403. |
| `recipe-tests.spec.ts` (174) | admin | Suggested scalar recipe over a picked parent series evaluates (`RESULTING_DATE_VALUES` hidden input); custom recipe `${s} - ${s}` evaluates to all-zero series; external-data variant skipped. |
| `toast.spec.ts` (169) | admin | Login empty submit shows inline error; action/roadmap/goal forms reject invalid submits natively, roadmap without description → warning toast, success toasts on create and publish; goal year-without-value → error toast. Non-unique entity names, no cleanup. |
| `goal-visibility.spec.ts` (163) | admin, serial | Visibility menu (`admin-panel-visibility`): listed → featured (in featured strip and table) → unlisted (gone from both, under tab) → listed; flags mirrored in edit form checkboxes. |
| `historical-data-tests.spec.ts` (107) | admin | Both tests skipped stubs. |
| `locales-page.spec.ts` (97) | anonymous | `/tests/locale` dev page: formatters change their input, > 400 keys with equal server/client counts in en and sv, no `[EMPTY]`/`[MISSING]` after switching. |
| `org-landing.spec.ts` (97) | admin / anita / anonymous | Super admin gets a select with every org + public; can traverse a non-member org; default view is an org landing; landing shows readable roadmaps, search and manage link; `?org=public` restores hero; `searchFilter` deep link works; single-org member gets chips and no manage link; anonymous gets no switcher. |
| `action-origin.spec.ts` (93) | admin, serial, afterAll DELETE | Create origin, create copy linked via `#origin-action` picker → neighbours section with origin badge and one drifted row; origin lists the copy; unlink removes the section on both sides (poll with reload). |
| `goal-copy.spec.ts` (131) | Boden and Kiruna members via `/api/login`; admin to look up the goal | "Use in roadmap" from a LEAP goal page → `/goal/create?from=` prefill → pick the member's roadmap, wait for `RECIPE_EVALUATION_PENDING` to clear; a copy the roadmap already has → POST 409, `already_in_roadmap` toast, submit button re-enabled without spinner; first copy into an empty roadmap → 201 and redirect, second → 409; deletes the copy in `finally`. Added by PR #155. |
| `scaled-preview.spec.ts` (91) | Boden member; anita | On a copied-as-is LEAP goal the preview toggle names the org, says "as is", persists across reload; no toggle for a member without an org area. Scaling methods untested (live statistics APIs). |
| `guest-disabled.spec.ts` (67) | greta; admin | Guest gets public page without org tabs, no org-readable content despite RO grant, no edit despite RW grant; invite links 404; guest-invite API 404 for managers; signup domain allowlist enforced. |
| `sidebar.spec.ts` (55) | anonymous | Language switcher initial language is "Test", option aliases, switching changes `home-title` to "Roadmaps" then "Färdplaner". |
| `login.spec.ts` (29) | anita | Logout removes the `eco_planner` cookie. |

### Screenshot (removed, not reset)

`tests/screenshots/screenshot-tests.spec.ts` (348 lines) took viewport and full-page JPEGs of the
start page, popovers, auth pages and every create/view/edit page across 18 viewport × browser
projects, and a templater built a gallery that CI published to GitHub Pages. It asserted nothing
beyond `expect.soft` landmark visibility, nobody looked at the gallery, and the job was the
slowest in CI. Config, spec, templater and workflow are gone; `tests/out` is only in `.gitignore`
through the generic `out` rule.

### Coverage map at deletion

| Area | Depth |
|---|---|
| Recipe evaluator, extractors, date-value utilities | good (unit) |
| CSV / decimal parsing, series refs, table catalog filters | good (unit) |
| Access checker ladder | partial (orgless + 3 member cases; no super admin, guest, anonymous, GROUPS) |
| Roadmap / iteration create, edit, publish, redirects | good (e2e) |
| Goal manual-series create/edit, visibility, unlisted, likes, duplicate copy 409 | good (e2e) |
| Action create/edit, field order, origin linking, effects on goal page | good (e2e) |
| Org landing, switcher, groups, roles, rename, area | good (e2e) |
| Caching / Activity / stale-form guard | good (e2e) |
| i18n switcher and locale-file lint | good |
| Query builder | UI only, mocked catalog, no data |
| Recipes with external data, scaling methods, `/api/recalculate` | none |
| Historical-data pages, data-series edit, baseline edit | none |
| Signup, verify, password reset, profile page, `/info` | none |
| Comments, UI delete flows, effect edit | none |
| Copy / use-goal flow | 409 path only (`goal-copy`); scaled methods untested |
| API route contracts (validation, status codes, 403/404/409) | incidental only |
| Mobile / narrow viewports | none (one test at 1280×600) |
| Typeguards (`src/types/typeguards.ts`, recipe typeguards, ~1 000 lines) | none |
| `accessFilters.ts` (Prisma WHERE mirror of the access checker) | none |
| `unit.ts` (parse/serialize, diacritic stripping), `cancelMatchingUnits`, `externalSelectionKey` | none |
| Sorters, `goalsToTree`, `findSiblings`, `versionSlug`, `username`, `parsePeriod` | none |

### Lessons from the old suite

Keep these in mind when writing the new one.

- **Test data hygiene was the biggest problem.** Only `caching`, `action-origin`, `goal-likes`
  and `goal-copy` cleaned up. Everything else piled entities onto "Rikets färdplan v2" per browser per retry,
  which made `.first()` picks and name lookups drift and is the root of the "seed-fattened
  e2e DB" bug card. `org-management` mutated Anita's role mid-run while other specs assumed she
  was a plain member. New e2e specs should create what they need through `/api/*` in a fixture
  and delete it in `finally`, or run against a throwaway roadmap per spec.
- **Shared helpers were copy-pasted** five ways: fill-manual-data-series grid, switch to table
  view, open goal form on Rikets v2, pick Rikets v2 in the action form, member context via
  `/api/login`, the Firefox/WebKit grid-focus workaround. Put them in `tests/lib/` first.
- **Hard-coded prose despite cimode.** "Rikets färdplan", "Hållbarhetsgruppen", "Roadmaps",
  "Färdplaner", "Test page for translations". Prefer test ids and i18n keys; read seed names
  from the seed modules (`places.ts` already exports them).
- **Wait strategies.** `hover()` and `waitForLoadState("networkidle")` as load waits, 45 s
  tree-pick timeouts, click-retry probes for a WebKit swallowed click, `.catch(() => goto again)`
  for Firefox aborted navigations. Many of these masked real slowness (goal page SSR on a fat
  DB). Decide on one pattern: wait for the specific response or test id, never for idleness.
- **Implicit ordering.** `goals-tests` depended on create running before edit without
  `describe.serial`. Either make each test self-sufficient or declare serial.
- **Constant re-assertion.** `leap-national-series` and the first half of `leap-scaling` restated
  data tables; they broke on every legitimate mapping edit and caught nothing. Test the logic
  that consumes the table, or lint the table's shape as `curated-historical` did.
- **Exact string snapshots** of equations and generated SQL (`leap-scaling`, `action-origins`,
  `national-historical`) were brittle; two of the three tested one-off scripts that already ran
  on prod.
- **Permanently skipped tests** (five across `locale-files`, `historical-data-tests`,
  `recipe-tests`) should either be written or not exist.
- **Unit config boilerplate.** Each unit file had its own identical project entry; the global
  `testMatch` already picks up new files. The config now has one project.
- **`yarn test` used `&`,** so a unit failure never failed CI. Now `&&`.

---

## Tests to write

Ordered by value within each layer. P1 is "write before the next feature", P2 "when touching
the area", P3 "nice to have". Each bullet is one spec file or describe block.

### Unit (`tests/unit/`, pure modules, no DB)

**P1**

- `unit.test.ts` — `parseUnit` / `serializeUnit` / `isUnitFlag` from `src/functions/unit.ts`:
  blank → Missing, null → Unitless, `invånare` → `invanare`, `µg` → `ug`, round trip through
  serialize, flags survive as flags. This is the db-boundary convention and has no test.
- `recipe-evaluate.test.ts` — rebuild the evaluator half of the old `recipe-unit` (round trip,
  injected getters, overlap-only years, non-Jan-1 timestamps, legacy placeholders, id
  collisions, no-overlap error) and add: mixed-unit add (kg + g), unit-cancelling division via
  `cancelMatchingUnits`, `.*` and `./` vector ops, division by zero → NaN not throw, template
  variables skipped, `withEditableExternals`, `copy`, `areRecipesEqual`, `normalizeRecipeObject`
  legacy shapes, `meta.isManual` round trip, `fromManualDateValues` / `fromInitialDateValue` /
  `fromLinkedDataSeries` factories.
- `recipe-percent.test.ts` — regression for the open bug card: `procent` must not collapse to a
  bare number in a product, and a copied percent goal must not come out 100× too small.
- `recipe-utils.test.ts` — `pickDateValues` (incl. Mean/Median with NaN entries, Default, ISO
  with and without `.000Z`, empty series), vector ↔ date-values, `externalSelectionKey`
  order-insensitivity asserted directly (the old suite pinned it only via literal strings),
  `extend` / `trend` / `reachBy` / `firstNonZero` edge cases (all-NaN, empty, single point).
- `access-checker.test.ts` — table-driven ladder over `src/lib/accessChecker.ts`: anonymous,
  orgless, GUEST (ORG sharing, RO grant), member, RW grant via group, manager, super admin,
  DRAFT × each, `Sharing.GROUPS` with no grants, null item; `hasAdminAccess`,
  `hasCommentAccess` with null user.
- `access-filters.test.ts` — same user contexts fed to `src/lib/accessFilters.ts`, asserting the
  WHERE shapes agree with the checker (the module comment says they must stay in sync and
  nothing enforces it). Can be done without Prisma by comparing the returned objects.
- `typeguards.test.ts` — `isGoalCreate` / `isGoalUpdate` / `isRoadmapCreate` / `isRoadmapUpdate` /
  `isAccessControlInput` / `isDateValues` / `isISOIshDate` / `isUnit` from
  `src/types/typeguards.ts`, and `isRecipe` / variable guards / `isExternalSelection` /
  `isStringifiedExternalSelection` from the recipe typeguards. These gate every API body and
  have zero coverage; one accept and two reject cases per guard is enough.
- `parse-goal-csv.test.ts` and `parse-decimal-input.test.ts` — restore the old ones (they were
  good) and add: delimiter-detection tie, quoted cell at EOF without newline, duplicate year
  columns, `12abc` must not parse as 12.
- `table-catalog.test.ts`, `series-ref.test.ts`, `goal-name.test.ts` (add `goalTitleWithLevel`
  for each roadmap type), `local-scale.test.ts` (add tie-break and negative values),
  `listing.test.ts` (add None and Admin) — restore, they were sound.

**P2**

- `period-parsing.test.ts` — `parsePeriod`, `filterToInitialYearlyRecords`, `formQueryHelper`,
  `isDataSetKeys` in `src/lib/api/utility.ts`: `2024K2`, `2024Q2`, `2024M05`, `2024W10`,
  `2024V10`, `2024`, week-1 edge years.
- `px-web.test.ts` — `getPxWebTables` pagination re-fetch, non-ok → null, thrown fetch → null,
  unknown dataset fallback; `getPxWebTableMetadata` shaping using `stemSolarMetadataFixture`;
  the 429 path once the retry sleep is injectable. Same shape for the Trafa
  `getTrafaTables` / metadata / content and `getTrafaSearchQueryString`.
- `suggested-recipes.test.ts` — restore and add county-level target for the Trafa preset,
  `withParentSeries`, `PARENT_VALUE_ID` substitution, stored suggestions path, unsupported area
  type.
- `leap-scaling.test.ts` — keep only the logic tests (suggested methods fill regions, `extend`
  in yearly equation, latest uses `pick: Last`, copied goal shows only own methods); drop the
  rule-table re-assertion and the exact equation snapshot.
- `curated-historical.test.ts` — restore the shape lint and region resolution; add the
  `areaName` interpolation and a true Trafa county derivation case.
- `sorters.test.ts` — the 15 comparators in `src/lib/sorters.ts` (null names via
  `goalDisplayName`, `commentSorter` with Date and string, iteration version order).
- `goal-tree.test.ts` — `goalsToTree` and `findSiblings` over indicator-parameter paths and
  listing.
- `url-helpers.test.ts` — `parseVersionSlug` / `iterationPath`, `isValidUsername` (Unicode),
  `usernameFromParam` (`%40` and decode fallback), `truncateText` (no-space input).
- `historical-dataset.test.ts` — `getHistoricalSource`, `getHistoricalDatasetFromRecipe`,
  `getHistoricalDataset`.
- `locale-key-scan.test.ts` — the regexes and helpers in `scripts/lib/localeKeyScan.ts`
  (`tCallRegex`, `keyPropRegex`, `nestedTRegex`, `isKeyDefined`, `stripPluralSuffix`,
  `flattenTree`, `collectUsedKeys`). Without this the locale lint can pass vacuously.
- `locale-files.test.ts` — restore the lint but move the work out of `describe` bodies into the
  tests, and either implement or delete the three skipped checks. Scan `.ts` catalogs too.
- `weighted-average-delta.test.ts` — needs a `now` parameter injected into `dataSeriesInterest`
  first; then test decay and `derive()`.
- `rate-limit.test.ts` — `consumeToken` bucket refill and per-user isolation (inject the clock).
- `allowed-domains.test.ts` — every alias in `orgDomainAliases` points at a listed domain.
- `fields.test.ts` — restore `parseCsvList`, add `parseActionFieldType` on untrusted input,
  `groupActionFields`, `getActionFieldValue`, `defaultActionFieldType`.

**P3**

- `leap-copy-plan.test.ts` — restore if the seed keeps using the copy planner; it is the only
  thing that runs the LEAP rules through real evaluation. Replace literal selection-key strings
  with `externalSelectionKey()` calls.
- Skip `action-origins` and `national-historical`: both are one-off scripts that already ran on
  prod. Delete the scripts or move them to `ignore/` rather than re-testing them.
- `persistence.test.ts` — `manualDataSeriesCreateData` (the only pure function there).

### API (`tests/api/`, new layer: request fixtures against the running app, no browser)

The old suite only hit `/api/*` incidentally. A thin API layer catches contract regressions far
faster than UI flows and is where 403/404/409 behaviour belongs. Add an `api/**/*.spec.ts`
project to the e2e config (reusing the `setup` auth states, or logging in via `/api/login`).

**P1**

- `auth.spec.ts` — `/api/login` success sets `eco_planner`, wrong password 4xx, unverified user
  rejected, `/api/logout` clears; `/api/signup` happy path auto-joins by domain, allowlist
  rejection, duplicate username/email; `/api/verify` and `/api/password` token flows (mail is
  MS Graph, so stub or read the token from the DB in the docker stack).
- `access.spec.ts` — for each of roadmap, iteration, goal, action, effect: anonymous GET of
  ORG-shared content → 404; member RO → GET ok, PUT 403; RW grant → PUT ok; orgless POST → 403;
  super admin everything. This replaces the scattered negative checks in `guest-disabled`,
  `org-management` and `unlisted-goals`.
- `goal.spec.ts` — POST with each `GoalDataTarget` tagged union, invalid body → 400 with a
  message, duplicate copy → 409 (`iteration + indicator + recipe source`), PUT stale timestamp
  → 409, blank name → null, DELETE cascades (series, effects, likes), `IllegalSource` when the
  linked series is not visible.
- `roadmap.spec.ts` / `roadmap-iteration.spec.ts` — create with grants, sharing transitions,
  publish/draft visibility for non-editors, `latest` alias, version slug conflicts, DELETE of a
  roadmap removes iterations and goals.
- `action.spec.ts` / `effect.spec.ts` — field order persisted and returned in order, origin
  link/unlink on both sides, effect on a goal in another roadmap, effect edit and delete.
- `org.spec.ts` / `org-membership.spec.ts` / `group.spec.ts` — rename, set area (unknown code
  400), promote/demote, cannot change own role, create/rename/delete group, duplicate name,
  non-manager 403/404.
- `goal-like.spec.ts` — like/unlike idempotence, counts per org/area/county.
- `guest-invite.spec.ts` — all methods 404 while guests are disabled (keep the canary).

**P2**

- `recalculate.spec.ts` — recalculation after a parent series changes propagates through
  linked recipes.
- `comment.spec.ts` — post, list in `commentSorter` order, delete own, cannot delete others'.
- `health.spec.ts` / `locales.spec.ts` — 200 and shape.
- `external-proxy.spec.ts` — SCB/Trafa proxy routes require login and rate-limit per user.

### E2E (`tests/e2e/`, browser flows; keep these to what a user would notice)

**P1**

- `smoke.spec.ts` — every page route in `src/app` renders without a client error for the role
  that may see it (anonymous, anita, admin): `/`, `/?org=`, `/info`, `/login`, `/signup`,
  `/verify`, `/password`, `/password/reset`, `/user/[username]`, `/actions`, `/roadmap/*`,
  `/goal/*`, `/action/*`, `/effect/*`, `/org/[id]/groups`,
  `/org/[id]/historical-data/[entryKey]`, `/invite/[token]`. Assert a landmark test id and no
  `console.error`. This single file replaces the "page loads" tests scattered across six old
  specs and gives the smoke coverage the signup/verify/password/profile/info pages never had.
- `roadmap-lifecycle.spec.ts` — one serial flow in a throwaway org: create roadmap → iteration →
  publish → edit → new iteration → draft hidden from anita → delete via the UI confirm input.
  Cleanup in `afterAll`.
- `goal-manual.spec.ts` — create a manual goal (decimal comma, grouped thousands), edit every
  field, baseline types, visibility menu listed → featured → unlisted → listed, delete. The
  unnamed-goal placeholder from `indicatorParameterLeaf`.
- `goal-recipe.spec.ts` — suggested scalar over a picked parent series, custom equation
  evaluates, recipe error surfaces via the form (read `RECIPE_ERROR` from the form data after
  `waitForRecipeFormSyncs`), unfinished external selection blocks submit.
- `goal-copy.spec.ts` — restore the old one (prefill, 409 on duplicate with the toast and the
  button coming back, cleanup) and add: local share recipe, copied badge, scaled preview toggle
  on a national goal (as-is method; scaling methods need a statistics stub).
- `action-lifecycle.spec.ts` — create with descriptive fields, order persists, origin link and
  unlink, effect on the goal page (own vs foreign rows), effect edit, delete action.
- `org.spec.ts` — landing per role (select vs chips vs none), traverse as super admin,
  `?org=public`, search deep link, groups page CRUD with arming delete, rename reflects in the
  switcher, area form, likes list scopes.
- `caching.spec.ts` — restore as is: it was the one well-isolated spec and guards a class of
  regressions (`useFormTimestamp`, Activity preservation, stale 409) that nothing else does.
- `auth.spec.ts` — login form error, logout cookie, signup → verify link → login, password
  reset link → new password (needs a mail stub or DB token read; the docker stack has no
  outbound mail).

**P2**

- `historical-data.spec.ts` — the pages that were skipped stubs: add manual historical data,
  pick an external series from the mocked STEM catalog, edit, and the curated entry page
  `/org/[id]/historical-data/[entryKey]` with its series refs prefilling `/goal/create`.
- `query-builder.spec.ts` — restore with the `page.route` mock; add Trafa and SCB fixtures,
  429 handling, and the cleared-selection empties-the-recipe case.
- `i18n.spec.ts` — restore language switcher and `/tests/locale` checks but assert on keys and
  `localeAliases`, not "Roadmaps"/"Färdplaner".
- `toasts.spec.ts` — one test per toast kind (success, warning, error) on the form that
  produces it, with unique names and cleanup.
- `guest-disabled.spec.ts` — keep the three UI negatives; the API ones move to the API layer.
- `mobile.spec.ts` — Galaxy S9+ project: sidebar drawer, create menu, goal table horizontal
  scroll, language dialog.

**P3**

- Graph assertions on the goal page (main/relative/delta switch renders the expected series
  count via the chart's data attributes).
- Roadmap tree view interactions and child-roadmap nesting.
- Comments on a goal.

### Visual regression (only if someone will look at the diffs)

The gallery is gone and should not come back. If visual checks are ever wanted, use
`toHaveScreenshot` with committed baselines on at most five design-sensitive pages (start, org
landing, goal, roadmap, create goal), chromium only, inside the e2e project, so the job fails on
a diff instead of publishing pictures. The old spec's full-page clip at 32 767 device pixels is
the one piece worth copying from `a3edab07:tests/screenshots/screenshot-tests.spec.ts`.

### Harness work that unblocks the above

- `tests/lib/api.ts` — typed helpers around `/api/*` with the auth cookie: `createRoadmap`,
  `createIteration`, `createGoal`, `createAction`, `deleteRoadmap`, `loginAs(username)`.
- `tests/lib/fixtures.ts` — a Playwright fixture that gives each test a throwaway roadmap +
  published iteration in "Sustainable Action" and deletes it after, as `caching.spec.ts` did.
- `tests/lib/forms.ts` — `fillManualDataSeries`, `useTableView`, `pickIteration`, `pickTreeSeries`.
- `tests/lib/mocks.ts` — `page.route` installers for STEM/SCB/Trafa using `stemFixtures.ts` plus
  new SCB and Trafa fixtures.
- Mail: a stub transport or a test-only route that returns the last verification/reset token,
  gated on `TEST_ENVIRONMENT=testing`.
- Inject `now` into `weightedAverageDelta` and the sleep into `getPxWebTables`' 429 retry so
  they become unit-testable.
