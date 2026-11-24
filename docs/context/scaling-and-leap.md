# Suggested methods, copying goals and LEAP scaling

Builds on [data-series-and-recipes.md](data-series-and-recipes.md) and [external-statistics.md](external-statistics.md).

## One path for starting from another goal
- "Use this goal in my roadmap" is always a link to the goal form with a prefill: `/goal/create?from=<goalId>`, plus `org=` and `series=<ref>` when a local statistic should anchor it. Do not build a separate dialog or a second prefill mechanism.
- `getGoalPrefill` in `src/fetchers/resolveSeriesRef.ts` resolves the link into a `GoalPrefill`: the historical series, the copied goal's series as a linked variable (the "parent"), copy fields, and local statistics per area the user can edit (`byArea`).
- Entry points: the `UseGoalInRoadmap` panel on goal pages (`src/components/pages/sections/useGoalInRoadmap.tsx`), the national goals section on the org landing, "copy all" (`copyAllNationalGoals.tsx`, sequential posts to `/api/goal`), and the curated data entry page.
- Wording in these sections avoids the plural "ni/er" register: "Använd i färdplan".

## Suggested methods
A suggested method is a recipe template offered in the goal form. `src/components/recipe/suggestions/defaultSuggestedRecipes.ts`:
- `getSuggestedRecipesFor(t, context)` returns the goal's own methods if it has any, otherwise the defaults. Own methods are those stored on the copied goal (`recipe_suggestions`), a local-scale method when a local statistic exists, and the LEAP rules below. **A goal with methods of its own shows only those.**
- Defaults (`DefaultSuggestedRecipeId`): `Scalar`, `ReachTarget`, `LocalScale`, `Population`, `Trend`.
- `preferredSuggestedRecipeId` picks the preselected one: the goal's first own method, else `LocalScale` when there is a local statistic, else `Population` when both areas resolve, else `Scalar`. Local statistics beat population, population beats a plain factor.
- `LocalScale` is "follow the national goal from the local value": `local(latest) * goal / goal(anchor year)`, where the anchor is the year of the local series' latest value (`src/functions/localScale.ts`). The goal's unit cancels, so the copy is in the statistic's unit.
- The population preset reads SCB `TAB628` (population at year end, selectable by region).

## Area scaling
- A copy scales by the **target roadmap's** area, not the user's org. The form derives the target area from the chosen version's roadmap, merges `byArea[target]` over the prefill (`prefillForArea`) and remounts the series sections so method and history re-seed when the target changes.
- The same selection logic (`copySuggestionContext`, `preferredSuggestion`, `isUnscaledSuggestion`) drives the "Förhandsvisa lokalt" preview on goal pages of national roadmaps (`scaledGoalPreview.tsx`), so the preview matches what a copy would produce. It is evaluated in the browser only when the box is ticked.
- The "only goals that can be used locally" checkbox on a national version page (`localizableIndicators` on `src/components/tables/goals.tsx`) is a filter, not a preview.

## Duplicate copies
- The create payload of a copy carries `copiedFromGoalId`. `findCopyInIteration` in the goal route answers 409 `api:goal.already_in_roadmap` when the target version already holds a goal with the same indicator parameter whose recipe reads the copied goal's series.
- Only a declared copy is checked. A derived goal that happens to read the same source under the same indicator must never be refused. Do not detect copies by name or indicator alone.

## LEAP rules
The national scenario comes from a LEAP energy model; its goals are identified by indicator parameter. `getLeapScalingRule(indicator)` in `src/lib/leapScaling.ts` says how each row should be localised (`LeapScalingKind`):

| Kind | Rule |
| --- | --- |
| `Copy` | intensities and shares are copied unchanged |
| `Population` | resident-driven totals scale by population, per year with the forecasts |
| `Ratio` | a sector total scales by the ratio of a local statistic to the national one (the sector's own category, never population); fuel detail scales by its aggregate class |
| `Share` | a share composed locally over the same share nationally, so definitional bias cancels |
| `Point` | point sources (process industry, nuclear, data centres) have no honest scaler: as is, or zero |

- Only direct matches are mapped: the same quantity, or an exact sum of LEAP rows. Proxies (employment, land area, emission totals) are left out to keep assumptions few.
- `leapSuggestedRecipes.ts` builds a per-year method (`goal .* extend(year, local) ./ extend(year, national)`) and a latest-value method from each rule.
- The rules apply only when the copied goal comes from a roadmap of type `NATIONAL` (`SuggestedRecipeContext.nationalScenario`). They must not fire for arbitrary goals with LEAP-like indicators.
- Municipal workhorses: SCB's municipal and regional energy statistics (`TAB3654` final use by consumer category and fuel, `TAB3451` electricity production, `TAB3452` district heating) and Trafa's vehicle tables. Energimyndigheten's own API is almost entirely national.
- `getLeapNationalSource(indicator)` in `src/lib/leapNationalSeries.ts` names the national statistic behind a LEAP row for rows the curated catalog lacks. `scripts/prisma/fill-national-historical.ts` uses it to give national goals a historical series (report, `--sql` or `--write`).
- Catalog entries can be `listed: false`: present for mappings only, not shown as browsable data.
- After adding a rule, a curated mapping or a seed place, refresh the seed's statistics snapshot; see [testing.md](testing.md).
