import type { APIRequestContext } from "playwright/test";
import sharp from "sharp";
import { expect, test as base } from "../lib/fixtures";
import { flightPayload, orgIdByName, requestAs, Seed } from "../lib/api";
import { memberSlug } from "../../scripts/prisma/seed/places";
import { MaxOrgBannerBytes, OrgBannerMaxSide } from "../../src/functions/orgBanner";

/*
 * Contract of /api/org/[orgId]/banner: the org's landing banner, one WebP per org in
 * the bucket. Setting (POST, multipart) and removing (DELETE) take the org's manager
 * or a super admin; fetching (GET) takes a membership. Everyone else gets a 404 (or a
 * 401 when anonymous on a write), the org's existence not leaked.
 *
 * Mutations target the seeded place org "Bodens kommun" (manager Maja Sandberg, member
 * Nils Forsberg, admin a plain member) and are undone in `finally`. No other spec changes
 * that org's settings. Without a bucket the upload answers 503 and the round trip is skipped.
 */

const org = {
  name: "Bodens kommun",
  manager: memberSlug("Maja Sandberg"),
  member: memberSlug("Nils Forsberg"),
};

type Actors = {
  anonymous: APIRequestContext;
  orgless: APIRequestContext;
  /** Maja, manager of the org */
  manager: APIRequestContext;
  /** Nils, plain member of the org */
  member: APIRequestContext;
};

const test = base.extend<{ actors: Actors }>({
  actors: async ({ playwright, baseURL }, use) => {
    const [anonymous, orgless, manager, member] = await Promise.all([
      requestAs(playwright, baseURL),
      requestAs(playwright, baseURL, Seed.orgless.username),
      requestAs(playwright, baseURL, org.manager),
      requestAs(playwright, baseURL, org.member),
    ]);
    await use({ anonymous, orgless, manager, member });
    await Promise.all([anonymous, orgless, manager, member].map(request => request.dispose()));
  },
});

// Page read-backs poll for the fresh render on a shared, loaded dev server; give them room
test.slow(true, "read-after-write polling against the shared dev server");

/** A solid raster of the given size as PNG */
function png(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: "#1b5e4a" } }).png().toBuffer();
}

/** Sends `content` as the banner of `orgId`, named `name` */
function upload(request: APIRequestContext, orgId: string, name: string, content: Buffer | string) {
  return request.post(`/api/org/${orgId}/banner`, { multipart: { file: { name, mimeType: "application/octet-stream", buffer: Buffer.from(content) } } });
}

/** The banner URL the org landing renders in its hero, or null when it shows none */
async function landingBannerUrl(request: APIRequestContext, orgId: string): Promise<string | null> {
  const payload = await flightPayload(request, `/?org=${orgId}`);
  return payload.match(new RegExp(`"(/api/org/${orgId}/banner\\?v=\\d+)"`))?.[1] ?? null;
}

test("a manager sets the banner, members see it on the landing and fetch it as WebP, and the manager removes it", async ({ actors, admin }) => {
  const orgId = await orgIdByName(actors.manager, org.name);
  const bannerPath = `/api/org/${orgId}/banner`;

  // Starts clean: nothing to fetch, nothing to remove
  expect((await actors.member.get(bannerPath)).status()).toBe(404);
  expect((await actors.manager.delete(bannerPath)).status()).toBe(404);

  const uploaded = await upload(actors.manager, orgId, "hero.png", await png(2400, 800));
  if (uploaded.status() === 503) {
    test.info().annotations.push({ type: "skipped", description: "no object storage configured; the upload answered 503 as it should" });
    return;
  }
  expect(uploaded.status(), await uploaded.text()).toBe(200);
  const result = await uploaded.json() as { url: string, width: number, height: number };
  expect(result.url).toMatch(new RegExp(`^/api/org/${orgId}/banner\\?v=\\d+$`));
  // Fitted to the cap, aspect kept
  expect([result.width, result.height]).toEqual([OrgBannerMaxSide, OrgBannerMaxSide / 3]);

  try {
    // Members fetch the image; the current version is cacheable for a long time
    const image = await actors.member.get(result.url);
    expect(image.status(), await image.text().catch(() => "")).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/webp");
    expect(image.headers()["cache-control"]).toContain("immutable");
    const bytes = await image.body();
    const meta = await sharp(bytes).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", OrgBannerMaxSide, OrgBannerMaxSide / 3]);
    // Without the current version it is still served, but must be revalidated
    expect((await actors.manager.get(bannerPath)).headers()["cache-control"]).toContain("no-cache");
    // The super admin sees every org; strangers and anonymous visitors get a 404
    expect((await admin.get(result.url)).status()).toBe(200);
    expect((await actors.orgless.get(result.url)).status()).toBe(404);
    expect((await actors.anonymous.get(result.url)).status()).toBe(404);

    // The landing page renders it in the hero
    await expect.poll(() => landingBannerUrl(actors.member, orgId), { timeout: 60_000 }).toBe(result.url);

    // Replacing bumps the version; the old URL keeps answering (same object), the new one is what the page uses
    const replaced = await upload(actors.manager, orgId, "hero2.jpg", await sharp(await png(600, 300)).jpeg().toBuffer());
    expect(replaced.status(), await replaced.text()).toBe(200);
    const next = await replaced.json() as { url: string, width: number, height: number };
    expect(next.url).not.toBe(result.url);
    expect([next.width, next.height]).toEqual([600, 300]);
    await expect.poll(() => landingBannerUrl(actors.member, orgId), { timeout: 60_000 }).toBe(next.url);

    // Only managers remove it
    expect((await actors.member.delete(bannerPath)).status()).toBe(404);
    expect((await actors.orgless.delete(bannerPath)).status()).toBe(404);
    expect((await actors.anonymous.delete(bannerPath)).status()).toBe(401);
  } finally {
    const removed = await actors.manager.delete(bannerPath);
    expect(removed.status(), await removed.text()).toBe(200);
  }

  expect((await actors.member.get(bannerPath)).status()).toBe(404);
  expect((await actors.manager.delete(bannerPath)).status()).toBe(404);
  await expect.poll(() => landingBannerUrl(actors.member, orgId), { timeout: 60_000 }).toBeNull();
});

test("anonymous 401; members, strangers and unknown orgs 404; no file 400; wrong type 415; oversize 413; not an image 400", async ({ actors }) => {
  const orgId = await orgIdByName(actors.manager, org.name);
  const image = await png(10, 10);

  expect((await upload(actors.anonymous, orgId, "hero.png", image)).status()).toBe(401);
  expect((await upload(actors.member, orgId, "hero.png", image)).status()).toBe(404);
  expect((await upload(actors.orgless, orgId, "hero.png", image)).status()).toBe(404);
  expect((await upload(actors.manager, "00000000-0000-0000-0000-000000000000", "hero.png", image)).status()).toBe(404);

  const noFile = await actors.manager.post(`/api/org/${orgId}/banner`, { multipart: { other: "x" } });
  expect(noFile.status(), await noFile.text()).toBe(400);
  expect((await upload(actors.manager, orgId, "report.pdf", image)).status()).toBe(415);
  expect((await upload(actors.manager, orgId, "index.html", "<p>")).status()).toBe(415);
  // One byte over the cap, refused on the declared length
  expect((await upload(actors.manager, orgId, "big.png", Buffer.alloc(MaxOrgBannerBytes + 1, 0))).status()).toBe(413);
  // The extension says image, the bytes don't
  const notAnImage = await upload(actors.manager, orgId, "hero.png", "definitely not a png");
  expect(notAnImage.status(), await notAnImage.text()).toBe(400);

  // Nothing of the above stuck
  expect((await actors.member.get(`/api/org/${orgId}/banner`)).status()).toBe(404);
});
