# Testing

[`tests/MANIFEST.md`](../../tests/MANIFEST.md) is the plan and the record of what the previous suite got wrong; read its "lessons" before writing tests. [`README.md`](../../README.md#testing) has the commands and the database instrumentation. This file is the working knowledge on top.

## Layout
| Layer | Where | Runs against |
| --- | --- | --- |
| Unit | `tests/unit/**/*.test.ts`, config `tests/playwright.unit.config.ts` | nothing: pure modules, no database, no app |
| API | `tests/api/**/*.spec.ts`, project `api` in `tests/playwright.e2e.config.ts` | the running app, request only, no browser |
| E2E | `tests/e2e/**/*.spec.ts`, one project per browser plus `mobile chromium` | the running app in a browser |
| Query budget | `tests/e2e/db-budget.spec.ts`, project `db-budget` | runs last, alone: its counters are process-global |

- Playwright is the runner for all layers. `setup` (`tests/login.setup.ts`) saves the auth states the other projects depend on.
- A new unit test file needs no registration: the config's `testMatch` picks it up.
- Keep e2e to what a user would notice. Put contract and permission checks in the API layer.
- There is no screenshot layer; it was removed as unused and slow.

## Conventions
- **Keys, not prose.** Tests run in the `cimode` locale, so assert on translation keys.
- **Visible filters.** Visited routes stay mounted and hidden (see [caching-and-navigation.md](caching-and-navigation.md)), so page-level locators can match a hidden copy. Scope with `.filter({ visible: true })`; `visible(page, selector)` in `tests/lib/forms.ts` does it.
- **Own your data.** Specs that mutate build on the `sandbox` fixture (`tests/lib/fixtures.ts`): a throwaway roadmap created through the API and deleted afterwards, so runs, retries and browser projects never see each other's leftovers. Do not mutate seeded roadmaps.
- **Sign in through the test login.** `loginAs(request, username)` in `tests/lib/api.ts` uses `/api/test/login`. The mailed-link flow is covered by its own specs; helpers in `tests/lib/login-link.ts` (each test uses its own forwarded IP because of the throttle).
- **No test-side waits for recipes.** Forms wait for the recipe context themselves; see [goal-api-and-forms.md](goal-api-and-forms.md). A test that needs a sleep there has found a bug.
- **Page status.** Pages stream, so a missing page can answer 200. Use `pageStatus()` from `tests/lib/api.ts`.
- **Seeded users have names.** UI assertions use the display name, not the username.
- **No request interception in the budget spec.** It makes `next dev` bypass the cache.
- External APIs are stubbed with fixtures in `tests/lib/mocks.ts` and `tests/lib/stemFixtures.ts`.
- `setup.fail` tests show as ✘ in the list reporter. They are expected failures.

## Running locally
- Default: `yarn test:e2e` builds and starts the docker stack (`docker/compose.testing.yaml`: database, seed, app, S3 gateway) and tears it down afterwards. Do not run two at once.
- Against your own server: set `SAF_LOCAL_TESTS=true` and `BASE_URL`. Playwright then starts `yarn build && yarn start` (or `yarn start` with `SAF_SKIP_BUILD=true`) unless something already answers on that URL, in which case it is reused; a running `yarn next dev -p <port>` works and needs no rebuilds.
- That server must run with `TEST_ENVIRONMENT=testing`: it enables the test-only routes (`/api/test/*`), the `cimode` default, the mail outbox, and non-secure cookies.
- Use a database that only the tests touch, freshly seeded. Leftover rows and a differently named seed org produce failures that are data, not code.
- One project: `yarn playwright test -c tests/playwright.e2e.config.ts --project=setup`, then `--project=api` or `--project="chromium 1080p"`. For the budget spec add `--project=db-budget --no-deps`.
- Local runs use two workers on purpose: the server shares the machine with the browsers and more workers only cause navigation timeouts that CI never sees.
- WebKit depends on system libraries that newer distributions may lack. If it will not launch locally, leave it to CI.
- `SAF_E2E_BROWSERS=chromium` leaves the firefox and webkit projects out. CI sets it for pull requests into `dev`; the push to `dev` after a merge, and anything aimed at `main`, runs every browser. A firefox- or webkit-only failure therefore shows up on `dev`, before a release, not on the pull request.
- Long runs outlive a tool call's timeout. Run them detached and watch the log.

## The query-budget canary
`db-budget.spec.ts` counts database statements for a warm load of four pages and fails past its budgets. Run it against a **production build** when touching the proxy, sessions or cached readers: `next dev` does not prefetch links, so prefetch-driven costs never show there.

## Seed
`yarn prisma db seed` runs `scripts/prisma/seed.ts`.
- Orgs are real, geo-tagged places (`scripts/prisma/seed/places.ts`), so the area-aware flows have something to run on. The e2e suite reads the same roster.
- The national scenario is seeded from a committed CSV in the layout the goal CSV import parses (`scripts/prisma/seed/data/`). Places flagged for it get every goal as a scaled copy, built with the same suggestion builders the goal form uses (`scripts/lib/leapCopyPlan.ts`).
- The seed must work offline and deterministically (the staging seed container has no internet). Every external series it needs is frozen in `scripts/prisma/seed/data/statistics-snapshot.json`, keyed like the app keys selections.
- After adding a LEAP rule, a curated mapping or a place, refresh the snapshot and commit it: `yarn tsx --conditions=react-server scripts/prisma/refresh-seed-statistics.ts --missing` (incremental; the full refresh is slow because it is sequential by design).
- The seed uses a Swedish i18next instance (`scripts/prisma/seed/i18n.ts`) so recipe and variable names match what the app would write.
- Scripts that import app code run with `yarn tsx --conditions=react-server`, which turns `server-only` into a no-op.
