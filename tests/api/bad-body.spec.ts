import type { APIRequestContext } from "playwright/test";
import { expect, test } from "../lib/users";

/*
 * Every handler that reads a JSON body answers 400 when the body is not JSON,
 * instead of letting `request.json()` throw into a 500. The routes still check
 * the session first where they did before, so these run as admin.
 */

const notJson = { data: "not json", headers: { "content-type": "application/json" } };

type Method = "post" | "put" | "patch" | "delete";
const routes: { method: Method, url: string }[] = [
  { method: "put", url: "/api/org" },
  { method: "post", url: "/api/group" },
  { method: "put", url: "/api/group" },
  { method: "delete", url: "/api/group" },
  { method: "put", url: "/api/org-membership" },
  { method: "post", url: "/api/action" },
  { method: "put", url: "/api/action" },
  { method: "delete", url: "/api/action" },
  { method: "post", url: "/api/roadmap" },
  { method: "put", url: "/api/roadmap" },
  { method: "delete", url: "/api/roadmap" },
  { method: "post", url: "/api/roadmap-iteration" },
  { method: "put", url: "/api/roadmap-iteration" },
  { method: "delete", url: "/api/roadmap-iteration" },
  { method: "post", url: "/api/goal" },
  { method: "put", url: "/api/goal" },
  { method: "delete", url: "/api/goal" },
  { method: "post", url: "/api/effect" },
  { method: "put", url: "/api/effect" },
  { method: "delete", url: "/api/effect" },
  { method: "post", url: "/api/comment" },
  { method: "post", url: "/api/recalculate" },
  { method: "post", url: "/api/goal-like" },
  { method: "delete", url: "/api/attachment" },
  { method: "patch", url: "/api/user" },
];

async function send(request: APIRequestContext, method: Method, url: string) {
  return request[method](url, notJson);
}

for (const { method, url } of routes) {
  test(`${method.toUpperCase()} ${url} answers 400 on a non-JSON body`, async ({ admin }) => {
    const response = await send(admin, method, url);
    const text = await response.text();
    expect(response.status(), text).toBe(400);
    expect((JSON.parse(text) as { message: unknown }).message, "the usual { message } error shape").toEqual(expect.any(String));
  });
}

test("an empty body is a 400 too", async ({ admin }) => {
  const response = await admin.put("/api/org", { headers: { "content-type": "application/json" } });
  expect(response.status(), await response.text()).toBe(400);
});

test("a JSON body that is not an object is a 400, not a crash", async ({ admin }) => {
  for (const data of ["\"a string\"", "[1, 2]", "null"]) {
    const response = await admin.put("/api/org", { data, headers: { "content-type": "application/json" } });
    expect(response.status(), `${data}: ${await response.text()}`).toBe(400);
  }
});
