import { expect, test } from "playwright/test";
import { allNamespaces, Locales, uniqueLocales } from "../../i18n.config";

/*
 * /api/locales?lng=<locale>&ns=<namespace>: the client-side i18next backend. Serves
 * public/locales/<lng>/<ns>.json for a known locale and namespace; 400 on either
 * being unknown or the namespace missing; 404 when the locale has no files
 * (cimode is a valid locale with none on disk).
 */

test("every real locale serves every namespace as a non-empty object", async ({ request }) => {
  for (const lng of uniqueLocales.filter(locale => locale !== Locales.test)) {
    for (const ns of allNamespaces) {
      const response = await request.get(`/api/locales?lng=${lng}&ns=${ns}`);
      expect(response.status(), `${lng}/${ns}: ${await response.text()}`).toBe(200);
      const body = await response.json() as Record<string, unknown>;
      expect(Object.keys(body).length, `${lng}/${ns} keys`).toBeGreaterThan(0);
    }
  }
});

test("the language defaults to the default locale", async ({ request }) => {
  const [defaulted, explicit] = await Promise.all([
    request.get("/api/locales?ns=common"),
    request.get(`/api/locales?lng=${Locales.default}&ns=common`),
  ]);
  expect(defaulted.status(), await defaulted.text()).toBe(200);
  expect(await defaulted.json()).toEqual(await explicit.json());
});

test("an unknown language or namespace is a 400 with an error field", async ({ request }) => {
  const language = await request.get("/api/locales?lng=xx-XX&ns=common");
  expect(language.status(), await language.text()).toBe(400);
  expect(await language.json()).toEqual({ error: "Invalid language" });

  const namespace = await request.get(`/api/locales?lng=${Locales.default}&ns=nope`);
  expect(namespace.status(), await namespace.text()).toBe(400);
  expect(await namespace.json()).toEqual({ error: "Invalid namespace" });

  const missing = await request.get(`/api/locales?lng=${Locales.default}`);
  expect(missing.status(), await missing.text()).toBe(400);
});

test("cimode is a valid locale without files on disk", async ({ request }) => {
  const response = await request.get(`/api/locales?lng=${Locales.test}&ns=common`);
  expect(response.status(), await response.text()).toBe(404);
  expect(await response.json()).toEqual({ error: "Locale file not found" });
});
