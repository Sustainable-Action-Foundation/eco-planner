import { expect } from "playwright/test";
import type { APIRequestContext, Browser, BrowserContext, PlaywrightWorkerArgs } from "playwright/test";
import { memberSlug } from "../../scripts/prisma/seed/places";

/*
 * Typed helpers around `/api/*` for specs that set up their own data instead of
 * leaning on seeded entities (see tests/MANIFEST.md, "Lessons from the old suite").
 * Every creator asserts the expected status and returns the new id; failures
 * include the response body so a contract change is readable in the report.
 */

/** The iron-session cookie set by `/api/login` */
export const SESSION_COOKIE = "eco_planner";

/** Seeded fixtures the specs may rely on (scripts/prisma/seed/*) */
export const Seed = {
  /** Super admin, manager of "Sustainable Action" */
  admin: { username: "admin", password: "admin" },
  /** Plain verified member of "Sustainable Action", in the group */
  anita: { username: "anita", password: "anita" },
  /** Unverified member: cannot log in */
  anton: { username: "anton", password: "anton" },
  /** GUEST in the org and group; guests are disabled so she sees only public content */
  greta: { username: "greta", password: "greta" },
  /** Verified, no org memberships */
  orgless: { username: "orgless", password: "orgless" },
  /** Password of every seeded place member ("First Last" → memberSlug) */
  memberPassword: "password",
  /** The org owning the fixtures; admin manages it, anita/anton members, greta guest */
  orgName: "Sustainable Action",
  /** Group of anita, anton and greta with an RW grant on the national roadmap and RO on the regional one */
  groupName: "Hållbarhetsgruppen",
  /** PUBLIC national roadmap with two published iterations */
  nationalRoadmap: "Rikets färdplan",
  /** ORG-shared regional roadmap (child of the national one): v1 published, v2 draft */
  regionalRoadmap: "Uppsala län",
  /** The imported national LEAP scenario (public) */
  leapScenario: "LEAP Lokal miljöhänsyn",
  /** Unlisted goals on the national v2 / regional v1 iterations */
  unlistedGoals: ["Dold nationell målbana", "Dold regional målbana"],
  /** Template recipe id of the "parent series × scalar" preset */
  scalarPresetId: "scalar-recipe-dummy-uuid",
} as const;

/** Logs the request context in through `/api/login`; the session cookie sticks to the context. */
export async function loginAs(request: APIRequestContext, username: string, password?: string): Promise<void> {
  const send = () => request.post("/api/login", { data: { username, password: password ?? username } });
  // A loaded server occasionally drops the socket ("socket hang up"); a login is safe to resend
  const response = await send().catch(async () => send());
  expect(response.status(), `login of ${username}: ${await response.text()}`).toBe(200);
}

/** A fresh browser context (no stored state) signed in as `username` through the API. */
export async function loginContext(browser: Browser, username: string, password?: string): Promise<BrowserContext> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  await loginAs(context.request, username, password);
  return context;
}

/** A context signed in as a seeded place member by display name, e.g. "Maja Sandberg" (Bodens kommun). */
export async function memberContext(browser: Browser, name: string): Promise<BrowserContext> {
  return loginContext(browser, memberSlug(name), Seed.memberPassword);
}

/** A unique label per project, retry and run, for names and indicator parameters */
export function uniqueLabel(testInfo: { project: { name: string }, retry: number }, prefix = "t"): string {
  return `${prefix} ${testInfo.project.name} ${testInfo.retry} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** `{ "2020-01-01T00:00:00.000Z": v0, "2021-...": v1, ... }` */
export function yearlyDateValues(values: readonly number[], startYear = 2020): Record<string, number> {
  return Object.fromEntries(values.map((value, i) => [`${startYear + i}-01-01T00:00:00.000Z`, value]));
}

/** POSTs JSON and asserts the status; resolves with the parsed body (`{ id }` for creators). */
export async function postJson<T = { id?: string }>(request: APIRequestContext, url: string, data: unknown, expectedStatus = 201): Promise<T> {
  const response = await request.post(url, { data });
  expect(response.status(), `POST ${url} -> ${await response.text()}`).toBe(expectedStatus);
  return await response.json() as T;
}

/** PUTs JSON and asserts the status; resolves with the parsed body. */
export async function putJson<T = { id?: string }>(request: APIRequestContext, url: string, data: unknown, expectedStatus = 200): Promise<T> {
  const response = await request.put(url, { data });
  expect(response.status(), `PUT ${url} -> ${await response.text()}`).toBe(expectedStatus);
  return await response.json() as T;
}

async function createdId(request: APIRequestContext, url: string, data: unknown): Promise<string> {
  const body = await postJson(request, url, data);
  expect(typeof body.id, `${url} response id`).toBe("string");
  return body.id ?? "";
}

/**
 * The id of an org by name, read off the start page as the logged-in user (there
 * is no org listing API). The switcher's orgs travel in the RSC payload as
 * `{"id":"<uuid>","name":"<name>"}` (quote-escaped inside the flight script).
 */
export async function orgIdByName(request: APIRequestContext, name: string): Promise<string> {
  const response = await request.get("/");
  expect(response.status(), "start page").toBe(200);
  const html = await response.text();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`\\\\?"id\\\\?":\\\\?"([0-9a-f-]{36})\\\\?",\\\\?"name\\\\?":\\\\?"${escaped}\\\\?"`))
    // Members of a few orgs get chips (`<Link href="/?org=<id>">name</Link>`) instead of the select
    ?? html.match(new RegExp(`href\\\\?":\\\\?"/\\?org=([0-9a-f-]{36})\\\\?",[^}]*children\\\\?":\\\\?"${escaped}\\\\?"`));
  expect(match, `org "${name}" on the start page`).toBeTruthy();
  return match?.[1] ?? "";
}

/** The `home-title` heading of the start page: the selected org's name on an org landing, the public title key otherwise. */
export async function startPageTitle(request: APIRequestContext, url = "/"): Promise<string> {
  const payload = await flightPayload(request, url);
  const match = payload.match(/"data-testid":"home-title","children":"([^"]*)"/);
  return match?.[1] ?? "";
}

export type RoadmapOverrides = Partial<{
  name: string;
  description: string;
  type: "NATIONAL" | "REGIONAL" | "MUNICIPAL" | "LOCAL" | "ORGANIZATIONAL" | "OTHER";
  actor: string | null;
  geoAreaCode: string | null;
  access: { sharing: "GROUPS" | "ORG" | "PUBLIC" | undefined, grants: { groupId: string, accessLevel: "RO" | "RW" }[] | null | undefined } | undefined;
  parentRoadmapId: string | null;
}>;

/** POST /api/roadmap as the context's user; resolves with the roadmap id. */
export async function createRoadmap(request: APIRequestContext, orgId: string, overrides: RoadmapOverrides = {}): Promise<string> {
  return createdId(request, "/api/roadmap", {
    name: overrides.name ?? `Roadmap ${Date.now().toString(36)}`,
    description: overrides.description ?? "",
    type: overrides.type ?? "OTHER",
    actor: overrides.actor ?? null,
    geoAreaCode: overrides.geoAreaCode ?? null,
    orgId,
    access: overrides.access,
    parentRoadmapId: overrides.parentRoadmapId ?? null,
  });
}

/** POST /api/roadmap-iteration (published by default); resolves with the iteration id. */
export async function createIteration(request: APIRequestContext, roadmapId: string, overrides: Partial<{ status: "DRAFT" | "PUBLISHED", description: string | null, targetVersion: number | null }> = {}): Promise<string> {
  return createdId(request, "/api/roadmap-iteration", {
    roadmapId,
    description: overrides.description ?? null,
    targetVersion: overrides.targetVersion ?? null,
    status: overrides.status ?? "PUBLISHED",
    goals: null,
  });
}

export type GoalOverrides = Partial<{
  name: string | null;
  description: string | null;
  indicatorParameter: string;
  listing: "LISTED" | "UNLISTED" | "FEATURED";
  unit: string | null;
  dateValues: Record<string, number>;
}>;

/** POST /api/goal with a manual data series (target FULL); resolves with the goal id. */
export async function createGoal(request: APIRequestContext, iterationId: string, overrides: GoalOverrides = {}): Promise<string> {
  const label = Date.now().toString(36);
  return createdId(request, "/api/goal", {
    target: "FULL",
    iterationId,
    name: overrides.name === undefined ? `Goal ${label}` : overrides.name,
    description: overrides.description ?? null,
    indicatorParameter: overrides.indicatorParameter ?? `Test\\${label}`,
    listing: overrides.listing,
    rawTags: null,
    dataSeries: {
      unit: overrides.unit === undefined ? "ton" : overrides.unit,
      dateValues: overrides.dateValues ?? yearlyDateValues([1, 2, 3, 4, 5]),
    },
  });
}

export type ActionField = { header: string, value: string, type: "PARAGRAPH" | "DATE" | "SHORT" };

export type ActionOverrides = Partial<{
  name: string;
  orgId: string;
  goalId: string;
  indicatorParameter: string;
  startYear: number | null;
  endYear: number | null;
  fields: ActionField[] | null;
  parentActionId: string | null;
  originActionId: string | null;
}>;

/** POST /api/action in an iteration (or roadmapless with `orgId` when `iterationId` is undefined); resolves with the action id. */
export async function createAction(request: APIRequestContext, iterationId: string | undefined, overrides: ActionOverrides = {}): Promise<string> {
  return createdId(request, "/api/action", {
    actionId: undefined,
    iterationId,
    orgId: overrides.orgId,
    goalId: overrides.goalId,
    name: overrides.name ?? `Action ${Date.now().toString(36)}`,
    indicatorParameter: overrides.indicatorParameter,
    startYear: overrides.startYear ?? null,
    endYear: overrides.endYear ?? null,
    fields: overrides.fields ?? [],
    parentActionId: overrides.parentActionId ?? null,
    originActionId: overrides.originActionId,
    dataSeries: undefined,
    impactType: undefined,
    timestamp: undefined,
  });
}

/** POST /api/effect linking an action to a goal with a yearly series. */
export async function createEffect(request: APIRequestContext, goalId: string, actionId: string, overrides: Partial<{ unit: string | null, dateValues: Record<string, number>, impactType: "ABSOLUTE" | "DELTA" | "PERCENT" }> = {}): Promise<void> {
  await postJson(request, "/api/effect", {
    goalId,
    actionId,
    impactType: overrides.impactType,
    dataSeries: { unit: overrides.unit === undefined ? "ton" : overrides.unit, dateValues: overrides.dateValues ?? yearlyDateValues([1, 1, 1]) },
    timestamp: undefined,
  });
}

/** DELETE /api/roadmap; cascades to iterations, goals, series, actions and effects. */
export async function deleteRoadmap(request: APIRequestContext, id: string, expectedStatus = 200): Promise<void> {
  // Cleanup must survive a momentary dropped connection (ECONNRESET on a loaded dev server): retry once
  const send = () => request.delete("/api/roadmap", { data: { id } });
  let retried = false;
  const response = await send().catch(async () => {
    retried = true;
    return send();
  });
  if (retried && expectedStatus === 200 && response.status() !== 200) {
    // The lost first attempt may have deleted it already; what matters is that it is gone
    expect(await pageStatus(request, `/roadmap/${id}`), `cleanup of roadmap ${id} after a retry`).toBe(404);
    return;
  }
  expect(response.status(), `cleanup of roadmap ${id}: ${await response.text()}`).toBe(expectedStatus);
}

/** DELETE /api/goal */
export async function deleteGoal(request: APIRequestContext, id: string, expectedStatus = 200): Promise<void> {
  const response = await request.delete("/api/goal", { data: { id } });
  expect(response.status(), `delete of goal ${id}: ${await response.text()}`).toBe(expectedStatus);
}

/** DELETE /api/action */
export async function deleteAction(request: APIRequestContext, id: string, expectedStatus = 200): Promise<void> {
  const response = await request.delete("/api/action", { data: { id } });
  expect(response.status(), `delete of action ${id}: ${await response.text()}`).toBe(expectedStatus);
}

/**
 * The effective status of a page route fetched without a browser. Pages stream
 * (cacheComponents), so a `notFound()` thrown after the shell is sent still
 * answers 200 and carries the 404 fallback digest in the body instead; this
 * reads that digest back into a 404. Use it for "can this user see this page"
 * checks instead of `response.status()`.
 */
export async function pageStatus(request: APIRequestContext, url: string): Promise<number> {
  const response = await request.get(url);
  if (response.status() !== 200) return response.status();
  const body = await response.text();
  return body.includes("NEXT_HTTP_ERROR_FALLBACK;404") || body.includes("NEXT_NOT_FOUND") ? 404 : 200;
}

/**
 * A standalone request context (no browser, no stored state), optionally signed
 * in through `/api/login`. For API specs that need several users side by side:
 * `requestAs(playwright, baseURL)` is anonymous, `requestAs(playwright, baseURL, "anita")`
 * is anita. Dispose it when done.
 */
export async function requestAs(playwright: PlaywrightWorkerArgs["playwright"], baseURL: string | undefined, username?: string, password?: string): Promise<APIRequestContext> {
  // The test server is shared with browser runs; give slow streamed pages room
  const request = await playwright.request.newContext({ baseURL, timeout: 60_000 });
  if (username) {
    await loginAs(request, username, password);
  }
  return request;
}

/** A client timestamp the stale-data checks accept: newer than any write made before the call. */
export function freshTimestamp(): number {
  return Date.now() + 5_000;
}

/** Reads a quote-escaped JSON fragment (`\"key\":\"value\"`) off a streamed page */
function flightField(html: string, pattern: string): string | null {
  const match = html.match(new RegExp(pattern.replace(/"/g, '\\\\?"')));
  return match?.[1] ?? null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The org-management payload of `/org/<orgId>/groups` (see `getOrgManagement`), scraped
 * off the RSC stream. Manager-only: the requester must manage the org (or be a super admin).
 */
async function orgManagementPage(request: APIRequestContext, orgId: string): Promise<string> {
  const response = await request.get(`/org/${orgId}/groups`);
  expect(response.status(), `groups page of org ${orgId}`).toBe(200);
  return await response.text();
}

/** The org membership id of a user (by username) in an org the requester manages. */
export async function membershipIdByUsername(request: APIRequestContext, orgId: string, username: string): Promise<string> {
  const html = await orgManagementPage(request, orgId);
  const id = flightField(html, `"membershipId":"([0-9a-f-]{36})","username":"${escapeRegExp(username)}"`);
  expect(id, `membership of "${username}" in org ${orgId}`).toBeTruthy();
  return id ?? "";
}

/** The current role of a user (by username) in an org the requester manages. */
export async function membershipRole(request: APIRequestContext, orgId: string, username: string): Promise<string> {
  const html = await orgManagementPage(request, orgId);
  const role = flightField(html, `"membershipId":"[0-9a-f-]{36}","username":"${escapeRegExp(username)}","role":"([A-Z]+)"`);
  expect(role, `role of "${username}" in org ${orgId}`).toBeTruthy();
  return role ?? "";
}

/**
 * The token the verification / password-reset mail would carry for `email`,
 * from the test-only `/api/test/mail-token` route (TEST_ENVIRONMENT=testing;
 * mail itself is stubbed there, see `@/mailClient`).
 */
export async function mailToken(request: APIRequestContext, email: string): Promise<string> {
  const response = await request.get(`/api/test/mail-token?email=${encodeURIComponent(email)}`);
  expect(response.status(), `mail token for ${email}: ${await response.text()}`).toBe(200);
  const body = await response.json() as { hash: string };
  return body.hash;
}

// ── Additional helpers for the API contract specs (tests/api/*) ─────────────

/** A fresh API-only request context signed in as `username` (no browser; dispose it when done). */
export async function userRequest(playwright: { request: { newContext: (options?: { baseURL?: string }) => Promise<APIRequestContext> } }, baseURL: string | undefined, username: string, password?: string): Promise<APIRequestContext> {
  const request = await playwright.request.newContext({ baseURL });
  await loginAs(request, username, password);
  return request;
}

/** A fresh anonymous API-only request context (no session cookie). */
export async function anonymousRequest(playwright: { request: { newContext: (options?: { baseURL?: string }) => Promise<APIRequestContext> } }, baseURL: string | undefined): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL });
}

/**
 * The id of a group in an org by name, read off the org's groups page as a
 * manager (`/org/<orgId>/groups`; there is no group listing API). The groups
 * travel in the RSC payload as `{"id":"<uuid>","name":"<name>",...}`.
 */
export async function groupIdByName(request: APIRequestContext, orgId: string, name: string): Promise<string> {
  const response = await request.get(`/org/${orgId}/groups`);
  expect(response.status(), "groups page").toBe(200);
  const html = await response.text();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`\\\\?"id\\\\?":\\\\?"([0-9a-f-]{36})\\\\?",\\\\?"name\\\\?":\\\\?"${escaped}\\\\?"`));
  expect(match, `group "${name}" on the groups page of org ${orgId}`).toBeTruthy();
  return match?.[1] ?? "";
}

/**
 * The decoded React Server Components payload of a page (the strings pushed to
 * `self.__next_f`), which carries every object the page's client components
 * receive as props: goals with their series values, actions with their fields,
 * iterations with their goals. Dates come back as `$D<iso>` strings. Server
 * components arrive as element tuples (`["$","h1",null,{"children":"..."}]`),
 * so a rendered heading or test id can be asserted on this text too; the
 * response carries no server-rendered HTML body under cacheComponents.
 */
export async function flightPayload(request: APIRequestContext, url: string): Promise<string> {
  const response = await request.get(url);
  expect(response.status(), `GET ${url}`).toBe(200);
  const html = await response.text();
  const parts: string[] = [];
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    parts.push(JSON.parse(match[1]) as string);
  }
  return parts.join("");
}

/**
 * Extracts the JSON object starting at `start` (a `{`) from a flight payload,
 * respecting strings; null when unbalanced. Pair with `text.lastIndexOf('{"effects":', text.indexOf(marker))`
 * to read the props of a client component (`{"effects":[...],"testId":"goal-action-row"}`).
 */
export function flightObjectAt(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** A page entity read back from the RSC payload (see {@link pageEntity}); nested objects are plain JSON. */
export type PageEntity = Record<string, unknown> & { id: string };

/**
 * The richest object with the given id in the page's RSC payload, or null when
 * the page doesn't carry it. The cheapest way to read an entity back without a
 * GET API: `pageEntity(admin, `/goal/${id}`, id)` gives the goal with
 * `data_series.values`, `effects`, `baseline_id` etc. as the page renders them.
 */
export async function pageEntity(request: APIRequestContext, url: string, id: string): Promise<PageEntity | null> {
  const text = await flightPayload(request, url);
  const needle = `{"id":"${id}"`;
  let best: PageEntity | null = null;
  let index = text.indexOf(needle);
  while (index !== -1) {
    const raw = flightObjectAt(text, index);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PageEntity;
        if (!best || Object.keys(parsed).length > Object.keys(best).length) best = parsed;
      }
      catch { /* a partial chunk; keep looking */ }
    }
    index = text.indexOf(needle, index + needle.length);
  }
  return best;
}

/** `[{ timestamp: "$D2020-01-01T00:00:00.000Z", value: 1 }, ...]` from a page entity's series → `[1, ...]` sorted by year */
export function seriesValues(series: unknown): number[] {
  const values = (series as { values?: { timestamp: string, value: number }[] } | null)?.values ?? [];
  return [...values].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map(value => value.value);
}

/**
 * The target a streamed page redirects to (`redirect()` in a server component
 * answers 200 and carries a `NEXT_REDIRECT;replace;<url>;307;` digest in the
 * body under cacheComponents), or null when the page doesn't redirect.
 */
export async function pageRedirect(request: APIRequestContext, url: string): Promise<string | null> {
  const response = await request.get(url, { maxRedirects: 0 });
  const location = response.headers()["location"];
  if (location) return location;
  const body = await response.text();
  return body.match(/NEXT_REDIRECT;(?:replace|push);([^;"\\]+);/)?.[1] ?? null;
}

/** A serialized recipe (`Recipe.serialize()` shape) for `<linked series> * <scalar>`, as the goal form sends when inheriting from a parent series. */
export function linkedScalarRecipe(options: { dataSeriesId: string, unit: string, scalar: number, name?: string, seriesVariableId?: string, scalarVariableId?: string }): string {
  const series = options.seriesVariableId ?? "parent";
  const scalar = options.scalarVariableId ?? "factor";
  return JSON.stringify({
    name: options.name ?? "Linked series times a scalar",
    equation: `\${${series}} * \${${scalar}}`,
    variables: [
      { id: series, name: "Parent series", type: "data-series", pick: "whole", unit: options.unit, dataSeriesId: options.dataSeriesId, value: null },
      { id: scalar, name: "Factor", type: "scalar", unit: "UNITLESS", value: options.scalar },
    ],
    unit: "MISSING_UNIT",
    meta: { v: 1, isSuggestedRecipe: false, isManual: false },
  });
}

/** A serialized scalar-only recipe (`<scalar> * 2`), usable as a recipe suggestion. */
export function scalarRecipe(name: string, value: number): string {
  return JSON.stringify({
    name,
    // eslint-disable-next-line no-template-curly-in-string -- recipe variable syntax, not a template
    equation: "${k} * 2",
    variables: [{ id: "k", name: "k", type: "scalar", unit: "UNITLESS", value }],
    unit: "UNITLESS",
    meta: { v: 1, isSuggestedRecipe: true, isManual: false },
  });
}

/** POST /api/comment; resolves with the comment id. */
export async function createComment(request: APIRequestContext, objectId: string, commentText: string): Promise<string> {
  const body = await postJson(request, "/api/comment", { commentText, objectId }, 200);
  expect(typeof body.id, "comment id").toBe("string");
  return body.id ?? "";
}

/** DELETE /api/roadmap-iteration */
export async function deleteIteration(request: APIRequestContext, id: string, expectedStatus = 200): Promise<void> {
  const response = await request.delete("/api/roadmap-iteration", { data: { id } });
  expect(response.status(), `delete of iteration ${id}: ${await response.text()}`).toBe(expectedStatus);
}

/** DELETE /api/effect */
export async function deleteEffect(request: APIRequestContext, goalId: string, actionId: string, expectedStatus = 200): Promise<void> {
  const response = await request.delete("/api/effect", { data: { goalId, actionId } });
  expect(response.status(), `delete of effect ${actionId}→${goalId}: ${await response.text()}`).toBe(expectedStatus);
}

/**
 * Waits for a page's effective status. Deletes revalidate their tags with
 * `max` (stale-while-revalidate), so the first fetch after one may still serve
 * the cached page; creates and updates expire immediately.
 */
export async function expectPageStatus(request: APIRequestContext, url: string, status: number): Promise<void> {
  await expect.poll(() => pageStatus(request, url), { message: `${url} to answer ${status}`, timeout: 60_000 }).toBe(status);
}

/**
 * A page entity once `predicate` holds, polling the page. The first page read
 * after an update can still serve the pre-write cache entry even though the
 * routes revalidate with `{ expire: 0 }` (observed on the dev server), so a
 * read-after-write check has to wait for the fresh render instead of reading once.
 */
export async function pageEntityWhen(request: APIRequestContext, url: string, id: string, predicate: (entity: PageEntity | null) => boolean, message = `${url} to reflect the write`): Promise<PageEntity | null> {
  let latest: PageEntity | null = null;
  await expect.poll(async () => {
    latest = await pageEntity(request, url, id);
    return predicate(latest);
  }, { message, timeout: 60_000 }).toBe(true);
  return latest;
}

/**
 * The id of a goal of a public roadmap by its indicator parameter's leaf, e.g.
 * `publicGoalId(admin, Seed.leapScenario, "andel låginblandad HVO")`. The
 * roadmap's newest version is found on the public landing (`/?org=public`)
 * and the goal in that version's RSC payload; read as an editor, since the
 * seeded scenario keeps some goals unlisted.
 */
export async function publicGoalId(request: APIRequestContext, roadmapName: string, leaf: string): Promise<string> {
  const landing = await flightPayload(request, "/?org=public");
  const at = landing.indexOf(`"${roadmapName} (v`);
  expect(at, `roadmap "${roadmapName}" on the public landing`).toBeGreaterThan(-1);
  const href = landing.slice(landing.lastIndexOf('"href":"/roadmap/', at)).match(/^"href":"(\/roadmap\/[0-9a-f-]{36}\/v\d+)"/)?.[1];
  expect(href, `link of roadmap "${roadmapName}"`).toBeTruthy();

  // The seeded scenario's version page is several megabytes; give it more than the default request timeout
  const response = await request.get(href ?? "", { timeout: 300_000 });
  expect(response.status(), `GET ${href}`).toBe(200);
  const html = await response.text();
  const roadmap = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map(match => JSON.parse(match[1]) as string).join("");
  const goalAt = roadmap.indexOf(`\\\\${leaf}","listing"`);
  expect(goalAt, `goal "${leaf}" in ${href}`).toBeGreaterThan(-1);
  const id = roadmap.slice(roadmap.lastIndexOf('{"id":"', goalAt)).match(/^\{"id":"([0-9a-f-]{36})"/)?.[1];
  expect(id, `id of goal "${leaf}"`).toBeTruthy();
  return id ?? "";
}
