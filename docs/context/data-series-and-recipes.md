# Data series and recipes

## One recipe per series
- Every `DataSeries` is produced by exactly one recipe (`recipe_used_id` is required and unique). The recipe is the provenance; the `DateRecords` are its evaluated result.
- A recipe is JSON: variables (scalars, linked data series, external statistics, inline series) and an equation that references them as `${id}`. The class is `Recipe` in `src/functions/recipe/recipe.ts`.
- `Recipes.source_data_series` records which stored series a recipe reads. "This goal is a copy of that one" is derived from it; there is no goal-origin column.
- Readers hand out a series' sources, and a recipe that names them, only to viewers who may get those sources; everyone else gets the series' own values with an empty recipe. The rule is in [access-control.md](access-control.md#where-access-lives). Code that reads `recipe_used.recipe` from a reader's result must cope with an empty recipe (`Recipe.isEmpty()`); the stored one is read server-side with `getOneRecipe`.
- External statistics used by a stored recipe are materialized as data series of their own (`materializeRecipeExternals` in `src/functions/recipe/persistence.ts`).

## Every input goes through the recipe context
All data series inputs in forms live inside a `RecipeContextProvider` and submit both a recipe and its evaluated values:
- Manual grid input: `Recipe.fromManualDateValues` builds a recipe with one inline series variable and the equation `${id}`, tagged `meta.isManual`. `Recipe.isManual()` reads it back. Component: `src/components/recipe/input/manualDataSeriesInput.tsx`.
- External statistic: `Recipe.fromExternalSource`, pushed by `ExternalDataSeriesInput`. It talks to the form only through the recipe context, no side-channel callbacks.
- Inherited from another series: `Recipe.fromLinkedDataSeries`.
- Baseline from the first value: `Recipe.fromInitialDateValue`, tagged `meta.baselineDerivation`.
- Forms decide which mode to show from the recipe (`resolveDataSeriesType`, `resolveBaselineType`, `resolveHistoricalDataType` in `src/components/form/forms/goalSections.ts`): the meta tags first, then `isManual()`. Never from whether a recipe id exists.

How forms read the result is in [goal-api-and-forms.md](goal-api-and-forms.md).

## The evaluator
- The year axis runs from the earliest year any series has (`DefaultAxisStartYear` 2020 when there are only scalars) to at least `AxisHorizonYear` 2050.
- A year a series lacks is `NaN` in its vector. `NaN` propagates through elementwise arithmetic and is skipped when the result is turned back into date values, so `${a} + ${b}` covers only the years both have. There are no masks.
- A result that is all `NaN` throws the "no overlapping years" `RecipeError`.
- Why: a goal started from historical data needs years no input has. An AND-mask over inputs could never let a function fill years in.
- Aggregates such as `mean(${x})` over a series with gaps yield `NaN`. If that becomes a problem, add NaN-skipping wrappers; do not bring masks back.
- Between two year vectors, `*` and `/` are matrix operations in mathjs ("Matrix must be square"). Use `.*` and `./` for elementwise.

## Custom functions (`src/math.ts`)
The evaluator puts the axis in scope as `year`; series-shaping functions take it as their first argument, skip `NaN` entries and return one value per axis entry.
- `trend(year, series, untilYear?)`: least-squares line through the known years.
- `reachBy(year, start, target, startYear, endYear)`: projects from a value to a target.
- `extend(year, series)`: carries values across leading, interior and trailing gaps (statistics offices suppress cells).
- `firstNonZero(series)`.

## Dependency injection, not imports
`src/functions/recipe/extractors.ts` has no default way to fetch a stored series or an external table. `dataSeriesGetter` and `externalTableContentGetter` are injected: by `persistence.ts` on the server, by the recipe context provider on the client. Without one, evaluation throws a `RecipeError`.

Why: the guarded fetchers pull in `server-only` and `next/headers`, which plain node cannot load. The recipe barrel (`src/functions/recipe/index.ts`) is imported by unit tests and must never import them. `persistence.ts` stays outside the barrel for that reason.

## Units
- `Unit` (`src/types/types.ts`) is a branded string or one of two sentinels from `UnitFlags` (`src/types/enums.ts`): `Unitless` and `Missing`.
- The database keeps its older convention: `""` means missing, `null` means intentionally unitless. Convert only through `src/functions/unit.ts`: `parseUnit` at every database read, `serializeUnit` at every write.
- The flags are truthy strings. `unit ? a : b` is always a bug; so is rendering a unit without mapping the flags, or handing a flag to mathjs. Check `isUnitFlag` first.
- On the wire (hidden form fields, API payloads) a unit is always a non-empty string, flags verbatim.
- In a recipe, no declared unit is `Missing`; an explicit `Unitless` overrides the result's unit.
- ESLint bans importing mathjs' `Unit` un-aliased; write `Unit as MathJSUnit`.

## Percent
- mathjs is created with `predictable: true` in `src/math.ts`. Without it, multiplying or dividing collapses the dimensionless `procent` unit into a bare number (its value × 0.01) and results come out 100 times too small.
- `convertToDeclaredUnit` in `src/functions/recipe/vectorAndMaskUtils.ts` converts a convertible result into the declared unit instead of relabelling it. A bare number declared as percent stays a label, which manual input needs.
- Keep both when touching evaluation. Tests: `tests/unit/recipe-percent.test.ts`.
- When auditing stored data for this class of error, a 100× ratio alone does not prove a series is wrong: a recipe may contain a scalar that compensates. Check the recipe.

## Renamed stored values
- A recipe's JSON outlives the code that wrote it. When a stored value is renamed, old rows keep the old spelling: `RecipeDataTypes.DataSeries` was `dataSeries` until 2026-07-30 and the stored recipes were not rewritten (the levelling SQL that gave every recipe-less series a manual recipe also wrote it literally).
- `Recipe.from` is the only place stored recipes are parsed. It maps the named old spellings to the current ones first (`legacyRecipeDataTypes` in `src/functions/recipe/legacyTypes.ts`); the type guards stay strict, and serializing writes the current value, so a re-saved recipe is current.
- Renaming a stored value therefore takes two things: an entry in that map, and a rewrite of the stored rows (`scripts/maintenance/rewrite-legacy-recipe-types.ts`, a dry run unless `--apply`). Tests: `tests/unit/recipe-legacy-types.test.ts`.
- The column holds either a JSON string with the serialized recipe (what the app writes) or a plain JSON object (hand-written SQL). Do not match stored recipes with `LIKE` on exact spacing or quoting; parse them.

## Recalculation
`POST /api/recalculate` re-evaluates a stored series from its recipe. Stored values do not follow their sources automatically; the goal page offers a recalculation when a source series is newer than the result.

A series is recomputed from all of its sources or not at all, and nothing recomputes from what a page was sent:
- The route reads the stored recipe (`getOneRecipe`) and refuses with 403 `IllegalSource` when the user may not read one of the series it links (`visibleSourceSeriesWHERE`). The evaluator would fail on the missing series anyway (`extractDataSeries` throws when the getter answers null), but its error names the variable, and a variable is labelled with the goal it reads.
- The forms evaluate in the browser from the sources the page carried, then from `clientSafeGetOneDataSeries`. Someone who may not see a source gets an empty recipe instead, which evaluates to an error, and the form does not save a series whose recipe has one.
- The "a source is newer" notice only looks at the sources the viewer got.
