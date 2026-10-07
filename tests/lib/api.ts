import { expect } from "playwright/test";
import type { APIRequestContext, Browser, BrowserContext } from "playwright/test";
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
  const response = await request.post("/api/login", { data: { username, password: password ?? username } });
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
  const match = html.match(new RegExp(`\\\\?"id\\\\?":\\\\?"([0-9a-f-]{36})\\\\?",\\\\?"name\\\\?":\\\\?"${escaped}\\\\?"`));
  expect(match, `org "${name}" on the start page`).toBeTruthy();
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
  const response = await request.delete("/api/roadmap", { data: { id } });
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
