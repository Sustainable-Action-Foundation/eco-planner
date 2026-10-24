import { expect, test as base } from "playwright/test";
import type { APIRequestContext } from "playwright/test";
import { freshContext, newLinkUser } from "../lib/login-link";

/*
 * PATCH /api/user: the signed-in user's own first and last name, set at first login
 * (onboarding on /welcome) and editable from the profile page. Every test here
 * creates its own user through the login-link flow, so seeded users keep their names.
 */

const test = base.extend<{ request: APIRequestContext }>({
  request: async ({ playwright, baseURL }, use, testInfo) => {
    const context = await freshContext(playwright, baseURL, testInfo.workerIndex);
    await use(context);
    await context.dispose();
  },
});

/** The h1 of a profile page, read off the RSC payload (the page streams; quotes are escaped there) */
async function profileHeading(request: APIRequestContext, username: string): Promise<string> {
  const response = await request.get(`/user/${encodeURIComponent(username)}`);
  expect(response.status(), `profile of ${username}`).toBe(200);
  return (await response.text()).match(/\\?"h1\\?",null,\{\\?"className\\?":\\?"margin-bottom-0\\?",\\?"children\\?":\\?"([^"\\]*)/)?.[1] ?? "";
}

test("anonymous callers are refused", async ({ request }) => {
  const response = await request.patch("/api/user", { data: { firstName: "Nobody", lastName: "Nobodysson" } });
  expect(response.status(), await response.text()).toBe(401);
});

test("the name replaces the username wherever the person is shown", async ({ playwright, baseURL }, testInfo) => {
  const { email, request } = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "named", false);
  try {
    const username = email.split("@")[0];
    expect(await profileHeading(request, username), "username until the name is set").toBe(username);

    const response = await request.patch("/api/user", { data: { firstName: "  Maja   Lisa ", lastName: "Sandberg\n" } });
    expect(response.status(), await response.text()).toBe(200);
    expect(await response.json()).toMatchObject({ firstName: "Maja Lisa", lastName: "Sandberg" });
    expect(await profileHeading(request, username), "whitespace normalized").toBe("Maja Lisa Sandberg");
  }
  finally {
    await request.dispose();
  }
});

test("both names are required and kept within bounds", async ({ playwright, baseURL }, testInfo) => {
  const { request } = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "bounds");
  try {
    const bad = [
      {},
      { firstName: "Only" },
      { firstName: "", lastName: "Empty" },
      { firstName: "   ", lastName: "Blank" },
      { firstName: 5, lastName: "Number" },
      { firstName: "x".repeat(101), lastName: "Long" },
      { firstName: "Ctrl\u0007", lastName: "Char" },
      [],
      null,
    ];
    for (const data of bad) {
      const response = await request.patch("/api/user", { data });
      expect(response.status(), `${JSON.stringify(data)} -> ${await response.text()}`).toBe(400);
    }
    // The onboarding name from newLinkUser is untouched by the refusals
    const ok = await request.patch("/api/user", { data: { firstName: "Still", lastName: "Fine" } });
    expect(ok.status()).toBe(200);
  }
  finally {
    await request.dispose();
  }
});
