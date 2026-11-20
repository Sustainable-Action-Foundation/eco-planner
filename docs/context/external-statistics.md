# External statistics sources

The app reads three public statistics APIs: SCB and Energimyndigheten (STEM), both PxWeb v2, and Trafa. The clients are in `src/lib/api/`; dataset definitions are in `src/lib/api/utility.ts`.

## Guarded proxies
- The server actions that proxy these APIs call `guardExternalApi()` (`src/lib/api/guardExternalApi.ts`): a signed-in session is required and each user gets a token bucket (60 burst, about 60 per minute; `src/lib/rateLimit.ts`).
- Why: the actions are directly callable POST endpoints. Unguarded, anyone could make the server hammer a statistics office.
- The guard sits **inside each action**, not in the client dispatcher.
- The limiter is in memory. That is valid only because production runs a single app container. If the app is ever scaled out, move it to a shared store.
- `guardExternalApi()` reads cookies, so it must not run inside `'use cache'`. Each client is split into a cache-safe core (`getPxWebTableContent`, `getTrafaTableContent`) and a guarded action (`...Action`). Cached callers use the core and guard in their uncached wrapper.
- A 429 is retried once inside the fetch, waiting at most `MaxRetryAfterMs`.

## Caching
External answers are cached on disk with `'use cache: upstream'`: an answer (including "no data for this area") for days, a failed request for minutes. Rules and the handler are described in [`caching.md`](../../caching.md).

## Source quirks
**Energimyndigheten (PxWeb)**
- Value codes are positional (`"0"`, `"1"`, ...). The region code is only a label prefix ("0180 Stockholm"): resolve it through the table metadata and match `"<code> "` with the trailing space (`CuratedRegionKind.PxWebLabelPrefix`).
- It never declares a time role. `getPxWebTableMetadata` treats dimensions named Tid, År, Year, Månad, Kvartal, Vecka or Period as time when the role is absent.
- Its contents dimension is reported under a placeholder name (`PXWEB_CONTENTS_PLACEHOLDER` in `src/lib/api/tableCatalog.ts`).
- It rate-limits bursts: fetch its series one at a time per dataset (`getCuratedHistoricalData.ts` keeps a per-dataset worker pool; Trafa takes three at a time).
- Few of its tables have a regional dimension. For municipal energy data use SCB's municipal and regional energy statistics instead.
- Its API has shipped an incomplete TLS chain after a certificate rotation. Browsers fetch the missing intermediate themselves; Node does not, so every server-side fetch fails with "unable to verify the first certificate" and the energy sections degrade. Check with `openssl s_client -connect <host>:443 -servername <host>` (verify return code 0, two certificates). The stopgap is to ship the intermediate certificate in the image and point `NODE_EXTRA_CA_CERTS` at it; the real fix is on their side.

**SCB (PxWeb)**
- Data calls need `ContentsCode` selected.
- Dimensions marked eliminable may be left out and are then summed. The selection UI offers this as "all values" and does not require them. Only SCB marks dimensions this way.
- Secrecy-suppressed cells are null; `extend()` exists for that (see [data-series-and-recipes.md](data-series-and-recipes.md)).

**Trafa**
- A municipality query returns no rows unless its county is selected too (`reglan` plus `regkom`). No region dimension means the national total.
- It returns no rows, not zeros, for categories an area has none of.

## Selection UI
`src/components/form/api/externalData.tsx` shows a status line while a selection is built: missing dimensions, fetching, no values, or a summary of the series. When a previously complete selection becomes incomplete, `ExternalDataSeriesInput` empties the recipe, and the goal form refuses to save a history section without one. Why: an unfinished selection used to save a goal silently without history.

## Curated catalog
- `src/lib/curatedHistoricalData.ts` is a hand-picked catalog: entry → series → one source per geo level (`sources` keyed by `GeoAreaType`), each with a `CuratedRegionKind` saying how an area is put into the query (`buildRegionSelection`).
- It is browse-only: series are fetched at render (`src/fetchers/getCuratedHistoricalData.ts`) and cached; no data series rows are created until a user adopts one into a goal.
- It shows on the org landing for orgs with a geo area, and per entry at `/org/[orgId]/historical-data/[entryKey]`.
- `getNationalGoalMappings()` in the same file maps national scenario indicators to catalog series; that mapping drives "use locally" (see [scaling-and-leap.md](scaling-and-leap.md)).

## Series refs
- A series ref is a small URL-safe string, today only `curated:<entry>/<series>` (`src/lib/seriesRef.ts`). `/goal/create?org=<id>&series=<ref>` prefills the goal form's history and substitutes the series for the parent value in every suggested method (`src/fetchers/resolveSeriesRef.ts`).
- Refs are the intended publishing surface for a future data lab: add a `SeriesRefKind` and a resolver case. Do not invent a second prefill mechanism.

## Charts
ApexCharts renders an empty chart, silently, when its options contain an explicit `title: undefined`. Use a conditional spread.

## Direction, not yet in code
- Cache the table catalog per dataset and language on the server and keep the rich PxWeb fields (variable names, time unit, period range), so the query builder never runs live searches against the source. The client-side filter (`filterTableCatalog`) already works on the rich shape.
- A "true municipality level" filter needs metadata enrichment: variable names alone are ambiguous.
