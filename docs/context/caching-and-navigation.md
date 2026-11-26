# Caching and navigation

[`caching.md`](../../caching.md) is the reference for `'use cache'`: tags, the mutation → revalidation matrix, and the rules every new cached reader and mutation must follow. [`README.md`](../../README.md#db-instrumentation) covers the query counters, `SAF_DB_TRACE` and the upstream cache directory. This file only adds what those do not say.

## Mental model in five lines
- Every database reader is an uncached wrapper plus a `getCached*` function. The wrapper reads the access context and passes it as an argument, so entries are per user.
- Failures are never cached: errors throw out of the cached scope and the wrapper degrades for that request only.
- Database entries live in an in-memory LRU. A restart flushes it, and that is the only way to flush after writing to the database out of band.
- External statistics use a separate disk-backed handler (`'use cache: upstream'`).
- A warm page load costs about three statements (the access context). `tests/e2e/db-budget.spec.ts` fails if that grows.

## Lessons behind the rules
- A cache fill that never settles makes every request for that key wait on it, and the page stalls for a minute while the server looks idle. Hence `boundedFill` around every cached query and a pool timeout well under that minute.
- Caching "empty" on failure hides outages for the lifetime of the entry. Hence throw inside, fall back outside.
- A reader that filters by visibility must declare `roadmap` and `roadmapIteration`, or a sharing change is served stale.
- The same goes for everything else a reader returns: an org name needs `org`, series and recipes `dataSeries`, counts and ids `goal` / `action`. A missed tag fails nowhere; the old value is just served for up to 15 minutes. `tests/unit/cache-tags.test.ts` therefore checks the declared tags against each reader's source.
- Author names on bylines are the one deliberate exception: the content readers embed them without the `user` tag, so a changed name shows within the cache life (15 minutes by default) or when anything else revalidates the entry. Tagging them made every first login and every name change expire all content pages for everyone; per-user tags (`user:<id>`) are the way to go if fresh bylines ever matter. `user` is only on the readers about people (profiles, org people, org comments).
- Tags are global per entity (`goal`, not `goal:<id>`), so a write expires that entity's readers for everyone. Routes revalidate with `{ expire: 0 }`; `'max'` would serve the old value once more, also to a recalculation reading it as input.
- Dates come back from the cache as strings. Wrap them in `new Date()` before use.
- Keep entries small: they multiply per user.

## Navigation keeps old routes mounted
`cacheComponents` is on (`next.config.ts`). Client navigation then uses React `<Activity>`: a route you have visited stays mounted, hidden, with its state, and comes back as it was on back/forward. There is no opt-out. Consequences:

- **Forms.** A stale-save timestamp taken at mount is wrong when the form is shown again: the second save sends the pre-save timestamp and gets a 409. `useFormTimestamp` refreshes it on re-show (effects re-run when an Activity becomes visible). The guard therefore means "stale since last shown"; `key={updated_at}` on edit pages remounts the form when the data changes.
- **Drafts.** A half-filled create form survives navigating away and back. That is intended.
- **Tests.** A page-level locator can match the hidden copy of a route as well as the visible one. Scope with `.filter({ visible: true })`; see [testing.md](testing.md).
- `tests/e2e/caching.spec.ts` pins all of this: saving after re-show, draft preservation, tag revalidation over client navigation. Its request-only companion `tests/api/caching.spec.ts` pins the tags: after a write, the next read of a warm reader shows it (sharing narrowed and widened, version status, org rename, a new account, recalculation).

## Streaming
Pages stream. A `notFound()` page can answer HTTP 200 with the not-found marker in the body, so a status code alone does not tell whether a page exists (tests use `pageStatus()` in `tests/lib/api.ts`).

## Pending links
`PendingLink` (`src/components/generic/links/pendingLink.tsx`) shows a spinner while a navigation is pending. If the navigation is dropped the pending state never settles, so the link falls back to a full page load after `PENDING_NAVIGATION_LIMIT_MS`.

## Request bodies
`src/proxy.ts` runs for every request and Next buffers bodies for it. `experimental.proxyClientMaxBodySize` in `next.config.ts` must stay above the largest upload, or bodies are silently truncated.

## Dev-only traps
- Playwright's request interception makes Chromium send `Cache-Control: no-cache`, and `next dev` then bypasses every `'use cache'` entry. Handy as a cold-path probe, wrong for measuring.
- `next dev` does not prefetch links; production does. Costs that come from prefetching (for example a database lookup in the proxy per prefetched link) only show against a production build.
- Next refuses to run two dev servers from one checkout.
