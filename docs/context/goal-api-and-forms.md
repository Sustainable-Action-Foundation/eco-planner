# Goal API and forms

## One endpoint, tagged payloads
- `/api/goal` (`src/app/api/goal/route.ts`) is the single endpoint for all goal data. Do not add goal sub-endpoints.
- `GoalCreateInput` and `GoalUpdateInput` are discriminated unions tagged by `target`, a `GoalDataTarget` (`src/types/enums.ts`): `Full`, `DataSeries`, `Baseline`, `Historical`, `RecipeSuggestions`. `Full` creates or updates a whole goal; the others write one section of an existing goal (`goalId` plus `timestamp`).
- The route switches on `target`, with a `never` check so a new target fails to compile until handled.
- The type guards (`isGoalCreate`, `isGoalUpdate` in `src/types/typeguards.ts`) use the tag only to choose which validators run. They still validate every field.
- Why: each branch handles one focused shape instead of a mountain of optionals.
- To add goal-write behaviour: a section writer in the route, a validator in the type guards, and `target` on every client payload.
- Goals nested in a version create are typed `GoalCreateFull[]`.

## Guards in the route
- `authorizeGoalWrite` and `createFullGoal` call `assertReadableLinkedSeries`: a recipe may only link data series the user can read (403 `IllegalSource`).
- A declared copy that already exists in the target version is refused with 409; see [scaling-and-leap.md](scaling-and-leap.md).
- A blank name is stored as `null` (`normalizeGoalName`).

## Reading recipe results in a form
Each data series input sits in a `RecipeContextProvider` (see [data-series-and-recipes.md](data-series-and-recipes.md)). A `FormSync` component (`src/components/recipe/output/formSync.tsx`) mirrors the context into hidden inputs: the resulting recipe, the evaluated values, the evaluation error, and a pending flag. Names are in `src/types/form-names.ts`.

Rules:
- The context evaluates on a debounce, so the hidden inputs briefly lag edits. A submit handler that reads them must `await waitForRecipeFormSyncs(form)` (from `@/components/recipe`) before building `FormData`.
- Read results **from the form data** after that wait, including the error (`RECIPE_ERROR`). Do not mirror context state into React state through callbacks: state lags a commit behind the settle marker, and a quick submit then acts on stale values. The hidden inputs land in the same commit as the pending flag.
- "Pending" compares the published recipe with the last recipe whose evaluation results reached state, not with the debounced recipe. The debounced state commits a render before the evaluation effect runs, and that gap is long enough to submit stale results on a loaded machine.
- Tests rely on this: they submit right after the last edit, with no waits of their own.
- The hidden inputs share names across the suggested, manual and custom fieldsets; only the enabled fieldset submits. When probing the DOM, scope to the enabled fieldset.

## Form state rules
- Forms carry a timestamp so the API can refuse a stale save (409). Use `useFormTimestamp` (`src/components/form/forms/useFormTimestamp.ts`) in every form, never `useState(Date.now())`; edit pages also carry `key={updated_at}`. The reason is in [caching-and-navigation.md](caching-and-navigation.md).
- The goal form has a submitting state that every early return must release.
- The goal form uploads attachments right after the goal is created; see [attachments.md](attachments.md).

## Rich-text description
Roadmap, version and goal forms send the description through a hidden `description` input that the editor's callbacks write (`src/components/form/elements/textEditor/editor.tsx`).
- The editor is created with `immediatelyRender: false`. With immediate rendering, tiptap can destroy and recreate the editor when React's effects run late; a submit in between sends an empty description, and saving without changes wipes the text.
- The editor's callbacks are the only writer of that hidden input. Never give it a `defaultValue`: a hidden input has no dirty value, so React re-applies the default on every render and erases what the editor wrote.
- When a test sees an empty or doubled editor, suspect editor re-creation before suspecting the data.

## Direction, not yet in code
- The standalone historical-data pages (`src/app/goal/[goalId]/historical-data/`, `src/components/form/forms/historical.tsx`) are to be removed once the goal form's history section fully replaces them.
