import { expect, test } from "../lib/fixtures";
import { createGoal, pageStatus } from "../lib/api";

/*
 * Harness canary: the sandbox fixture every mutating spec builds on must create
 * a roadmap with a published iteration as admin and tear it down afterwards.
 */
test.describe.configure({ mode: "serial" });

let previousRoadmapId = "";

test("sandbox gives a roadmap with a published iteration that accepts a goal", async ({ admin, sandbox }) => {
  expect(sandbox.orgId).toMatch(/^[0-9a-f-]{36}$/);
  const goalId = await createGoal(admin, sandbox.iterationId, { name: `Canary ${sandbox.label}` });
  expect(await pageStatus(admin, `/goal/${goalId}`)).toBe(200);
  expect(await pageStatus(admin, `/roadmap/${sandbox.roadmapId}/v1`)).toBe(200);
  previousRoadmapId = sandbox.roadmapId;
});

test("the sandbox of the previous test is gone", async ({ admin }) => {
  expect(previousRoadmapId).toBeTruthy();
  expect(await pageStatus(admin, `/roadmap/${previousRoadmapId}`)).toBe(404);
});
