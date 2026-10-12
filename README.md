# eco-planner
A tool intended to help planning actions to achieve local environmental goals

## Copyright
Copyright (C) 2023-2026 Sustainable Action Foundation
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, version 3.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.

## Setup
This tool requires the following environment variables to be set:
- `IRON_SESSION_PASSWORD`: Should be a string at least 32 characters long. This is used to encrypt the session cookie from the Iron Session library.
- `DATABASE_URL`: Should be a connection string to a database. This is used by Prisma to connect to the database. The client connects through `@prisma/adapter-mariadb`, so a MySQL/MariaDB database is expected; targeting something else requires changing both the adapter setup in `src/lib/prisma/prisma.ts` and the `provider` in `prisma/schema.prisma`.
- `MAIL_TENANT_ID`, `MAIL_CLIENT_ID`, `MAIL_CLIENT_SECRET`: Credentials for a Microsoft Entra app registration, used to send mail through Microsoft Graph with the client credentials flow.
- `MAIL_USER`: The mailbox mail is sent from, e.g. `noreply@example.org`. Must exist in the tenant.
  - These `MAIL_`-variables are used in `src/mailClient.ts`. The app registration needs the application permissions `Mail.Send`, plus `Mail.ReadWrite` for the mailbox check in `verify()`.
- `BASE_URL` (optional): The public URL of the deployment, used when building absolute links (e.g. in emails). Defaults to `http://localhost:3000` in development and the production URL otherwise, see `src/lib/baseUrl.ts`.

On startup the app runs a self-test (`src/instrumentation.ts`) which checks the session password, mail configuration and database connection, and logs a warning for anything misconfigured.

1. Install dependencies with `yarn install`
2. If you're setting up the database for the first time (for example, a clean development database), run `yarn prisma migrate deploy` to apply the existing migrations to the database..
    - Any local MariaDB/MySQL server works for development, whether installed natively or run as a docker container.

Now you should be able to run the app with `yarn dev` and access it at http://localhost:3000 or build it with `yarn build` and run it with `yarn start`.

Our package.json comes configured with a preinstall script that runs `git update-index --skip-worktree src/lib/LEAPList.json` to prevent git from tracking changes to the LEAPList.json file as this file is regenerated at build time.
If you for some reason need to update the default version of the file, run `git update-index --no-skip-worktree src/lib/LEAPList.json` to allow git to track changes to the file again.

### I18N
We use i18next for internationalization. See [locales.md](/locales.md) for the full documentation on namespaces, key conventions and formatters. If you use VS Code we recommend installing the [i18n ally](https://marketplace.visualstudio.com/items?itemName=Lokalise.i18n-ally) extension to help keep track of translation keys. It might require some configuration to work with our project, namely enabling [namespaces](vscode://settings/i18n-ally.namespace) and setting [default namespace](vscode://settings/i18n-ally.defaultNamespace) to `common`.

## Recipe Editor notes
The recipe editor lives in a context provider and keeps the recipe state there. There are a whole bunch of components that may live inside of it to allow for viewing, editing and evaluating recipes.

## Backend notes
We use the `'use cache'` directive from Next.js together with `cacheTag()` for caching fetcher results, which currently returns cached `Date`s in stringified form (see this [GitHub issue](https://github.com/vercel/next.js/issues/51613) about the same behavior in `unstable_cache`). Remember to always create a `new Date()` from the date value whenever you use one, until this problem is fixed.

## Database structure
Refer to [schema.prisma](/prisma/schema.prisma) for the full, up-to-date schema.

## Testing
This project uses [Playwright](https://playwright.dev/) for both unit tests and end-to-end tests.

```bash
# Unit tests (no running app needed)
yarn test:unit

# End-to-end tests; starts the app and a database via docker compose (docker/compose.testing.yaml) and runs against http://localhost:8081
yarn test:e2e

# Both of the above
yarn test
```

To run the e2e tests against an app you host yourself instead of the docker stack, set `SAF_LOCAL_TESTS=true` (and optionally `SAF_SKIP_BUILD=true` to skip rebuilding); the test runner will then start the app with `yarn build && yarn start`. The target URL can be overridden with `BASE_URL`.

### DB instrumentation
Every Prisma statement is counted in-process (`src/lib/prisma/dbStats.ts`; cheap and always on).

- `SAF_DB_TRACE=true yarn next dev` additionally prints a summary per burst of queries (flushed 250 ms after the last one, so roughly per request): count, DB time, span, the 3 slowest statements and a per-table histogram. Dev only: it logs SQL. Note that statement durations are wall time around the driver call, so a busy event loop (e.g. a large render) inflates them.
- `GET /api/test/db-stats` returns the cumulative `{ queries, dbMs }`. It is 404 in production builds unless `TEST_ENVIRONMENT=testing` (the docker test stack) and never touches the DB.
- `tests/e2e/db-budget.spec.ts` is a query-budget canary: it measures how many statements a warm load of the startpage, an org landing, a goal page and a roadmap iteration costs (admin, fat seed) and fails past the budgets at the top of the file (measured baseline + ~25%). It runs in its own `db-budget` project after all browser projects, since the counters are process-global. Run it alone with `yarn playwright test -c tests/playwright.e2e.config.ts --project=setup` followed by `--project=db-budget --no-deps`. Playwright request interception (`page.route`) makes Chromium send `Cache-Control: no-cache`, which makes `next dev` bypass every `'use cache'` entry, so the canary must not use it.
- Baseline (2026-10-12, `next dev`, fat seed, admin): a warm load of any of the four pages costs 3 statements, the per-request access-context lookup (`getUserAccessContext` is memoized with React `cache()`; every DB fetcher is served from `'use cache'`). A cold load (`curl -H 'Cache-Control: no-cache'`, which bypasses every `'use cache'` entry in dev) costs about 39 statements for the startpage / org landing (62 before the landing fetched org-scoped slim actions and built its roadmap tree from `getRoadmaps`), 58 for a goal page and 28 for a roadmap iteration.
- External statistics (the curated catalog's series and PxWeb metadata, the SCB population/area queries) use `'use cache: upstream'`, a disk-backed handler (`src/lib/cache/upstreamCacheHandler.mjs`, registered under `cacheHandlers` in `next.config.ts`) that keeps them across server restarts in `SAF_CACHE_DIR` (default `.next/cache/upstream`). Entries are JSON files keyed by a hash of the cache key; `revalidateTag()` (e.g. `curatedHistoricalData`) is honoured and persisted too. Next puts the build id in every cache key, so a new production build starts empty; expired files are pruned at startup. `next dev` has a fixed build id, so the directory is wiped on every dev start unless `SAF_CACHE_DIR` is set explicitly. Delete the directory to force a refetch. `SAF_CACHE_DEBUG=1` logs its hits and writes.
- Cached DB fills are bounded by `SAF_CACHE_FILL_TIMEOUT_MS` (default 20000, see `boundedFill` in `src/fetchers/cacheFallback.ts`): a fill that hangs longer rejects, is not cached, and each waiting request falls back instead of stalling.

## Components

### Generic components
Generic components are components whose functionality is not tied to this project. They are independently redistributable and function on their own within other next.js projects without any dependencies. Examples include the [attributedImage.tsx component](/src/components/generic/images/attributedImage.tsx) or the [header component](/src/components/generic/header/).

All generic components are located within the [generic folder.](/src/components/generic)

### Project specific components
Project specific components are located directly under the [components folder.](/src/components/) These are components which are dependent on this project's structure in order to function. This may include files such as [goals.tsx](/src/components/tables/goals.tsx) which depend on project types like `RoadmapIteration` and `AccessLevel`.

***Component folder structure***
```
└── components/
    ├── projectSpecificComponent/
    │   ├── projectSpecificComponent.tsx
    │   └── projectSpecificComponent.module.css
    └── generic/
        ├── genericComponent/
        │   ├── genericComponent.tsx
        │   └── genericComponent.module.css
        └── GenericComponentGroup/
            ├── genericComponent1
            ├── genericComponent2
            ├── genericComponent3
            └── genericComponentGroup.module.css
```

## CSS

There are 3 different ways of writing css for this project: [Semantic Style Sheets](#semanticstylesheets), [CSS Modules](#cssmodules) and [Global CSS](#globalcss).

> **<span style="color:#4169E1;">🛈</span> Note**
>
> Global CSS and Semantic Style Sheets use kebab-case but CSS Modules use camelCase.

<div id="semanticstylesheets"></div>

### Semantic Style Sheets
This project uses a custom made version of [Semantic Style Sheets v.0.4.0](https://github.com/Axelgustavschnurer/semantic-style-sheets) to add commonly used utility classes. The code for this can be located within [/src/styles/main.css](/src/styles/main.css), which is pulled in through [global.css](/src/styles/global.css).

<!-- TODO remove this and replace with site docs when those are added -->

<div id="cssmodules"></div>

### CSS modules
In some areas there is a larger requirement to have more complicated styling, which usually isn't suitable for [Semantic Style Sheets](https://github.com/Axelgustavschnurer/semantic-style-sheets). For this usecase we define custom classes within [CSS modules](https://github.com/css-modules/css-modules). A page, component or group of components should have an accompanying css module file for this case. The CSS module stylesheet should be named after the file or group of files, which it belongs to.

> **<span style="color:#4169E1;">🛈</span> Note**
>
> CSS modules use camelCase instead of kebab-case.

#### Setup CSS module
1. Create file `component.tsx`
```jsx
export default function Component() {
  return (
    <p>Hello World!</p>
  );
}
```

2. Create file `component.module.css`
```css
.componentStyling {
  color: red;
}
```
3. Import `component.module.css` to `component.tsx`
```jsx
import styles from "./component.module.css";

export default function Component() {
  return (
    <p>Hello World!</p>
  );
}
```

4. Add the styling to the `component.tsx` component

```jsx
import styles from "./component.module.css";

export default function Component() {
  return (
    <p className={styles.componentStyling}>Hello World!</p>
  );
}
```

<div id="globalcss"></div>

### Global CSS

> **<span style="color:red;">⚠</span> Warning**
>
> *Using global styling often leads to css files which are difficult to read and maintain. It may also cause specificity problems. Ensure that your decision to use global styling is well thought through.*

This project contains a [global.css](/src/styles/global.css) file to style elements which should have a consistent appearance across the application. This may for example include buttons or forms. The color variables live in [colors.css](/src/styles/colors.css), contained within the css `:root{}` element and imported by global.css.

## Styling

### Color Palette
The base colors below are defined in [colors.css](/src/styles/colors.css), each with a `--name-10` to `--name-90` lightness ramp.

![Color Palette](/public/images/palette.png "Color Palette")
