import fs from "node:fs";
import path from "node:path";
import type { APIRequestContext } from "playwright/test";
import { Locales } from "../../i18n.config";
import { Seed } from "../lib/api";
import { expect, test } from "../lib/users";

/*
 * Server rendering must honour each request's language even when requests in
 * different languages overlap. The server-side i18next instance is shared by
 * every request: a per-request language switch on it leaks into whatever else
 * is between fetching its translator and rendering (pages that await the
 * database in between). CI runs the language-switcher spec next to everything
 * else, which showed up as English fragments in cimode pages.
 */

const probed = [Locales.svSE, Locales.enSE] as const;
type Probed = (typeof probed)[number];

function pagesFile(locale: string): Record<string, Record<string, string>> {
  const file = path.join(process.cwd(), "public/locales", locale, "pages.json");
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, Record<string, string>>;
}

/** Pages whose render awaits the database after fetching its translator, with a literal marker per language */
const probes: { url: string, marker: (locale: Probed) => string }[] = [
  // Profile: the "<name>'s posts" heading without its interpolated name
  { url: `/user/${Seed.anita.username}`, marker: locale => pagesFile(locale).profile.user_posts.replace(/\{\{[^}]*\}\}/, "").trim() },
  // Public start page: the search field label up to its nested count
  { url: "/?org=public", marker: locale => pagesFile(locale).home.search_roadmaps.split("$t(")[0].trim() },
];

async function fetchIn(request: APIRequestContext, url: string, locale: Probed) {
  const response = await request.get(url, { headers: { "accept-language": locale } });
  return { status: response.status(), body: await response.text() };
}

test("overlapping requests in different languages each render in their own language", async ({ anita }) => {
  for (const probe of probes) {
    for (const locale of probed) expect(probe.marker(locale).length, `${probe.url} ${locale} marker`).toBeGreaterThanOrEqual(4);
    // Each probe alone renders in the requested language
    for (const locale of probed) {
      const { status, body } = await fetchIn(anita, probe.url, locale);
      expect(status, `${probe.url} ${locale}`).toBe(200);
      expect(body, `${probe.url} ${locale} alone`).toContain(probe.marker(locale));
      for (const other of probed.filter(candidate => candidate !== locale)) {
        expect(body, `${probe.url} ${locale} alone must not contain the ${other} marker`).not.toContain(probe.marker(other));
      }
    }
  }

  const rounds = 6;
  const wanted = Array.from({ length: rounds * probed.length * probes.length }, (_, i) => ({
    probe: probes[Math.floor(i / probed.length) % probes.length],
    locale: probed[i % probed.length],
  }));
  const responses = await Promise.all(wanted.map(({ probe, locale }) => fetchIn(anita, probe.url, locale)));

  for (const [i, { status, body }] of responses.entries()) {
    const { probe, locale } = wanted[i];
    const other = locale === probed[0] ? probed[1] : probed[0];
    expect(status, `request ${i} ${probe.url} (${locale})`).toBe(200);
    expect(body, `request ${i} ${probe.url} (${locale}) html lang`).toContain(`lang="${locale}"`);
    expect(body, `request ${i} ${probe.url} (${locale}) should be in its own language`).toContain(probe.marker(locale));
    expect(body, `request ${i} ${probe.url} (${locale}) leaked ${other}`).not.toContain(probe.marker(other));
  }
});
