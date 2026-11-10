import { expect, test } from "playwright/test";
import sharp from "sharp";

import {
  allowedOrgBannerAccept,
  MaxOrgBannerBytes,
  OrgBannerMaxSide,
  OrgBannerRejection,
  orgBannerPath,
  orgBannerStorageKey,
  rejectOrgBanner,
} from "../../src/functions/orgBanner";
import { transcodeOrgBanner } from "../../src/lib/orgBannerImage";

/*
 * The guards the banner API and management form share, and the transcoder that turns
 * any upload into the one WebP the landing page shows.
 */

test.describe("org banner guards", () => {
  test("accepts the image types by extension, case-insensitively", () => {
    for (const name of ["hero.png", "Hero.JPG", "photo.jpeg", "x.webp", "x.avif", "x.gif", "logo.svg"]) {
      expect(rejectOrgBanner({ name, size: 10 }), name).toBeNull();
    }
    expect(allowedOrgBannerAccept.split(",")).toEqual(expect.arrayContaining([".png", ".jpg", ".svg"]));
  });

  test("refuses documents, markup, empty and oversize files", () => {
    expect(rejectOrgBanner({ name: "report.pdf", size: 10 })).toBe(OrgBannerRejection.TypeNotAllowed);
    expect(rejectOrgBanner({ name: "index.html", size: 10 })).toBe(OrgBannerRejection.TypeNotAllowed);
    expect(rejectOrgBanner({ name: "noextension", size: 10 })).toBe(OrgBannerRejection.TypeNotAllowed);
    expect(rejectOrgBanner({ name: "hero.png", size: 0 })).toBe(OrgBannerRejection.Empty);
    expect(rejectOrgBanner({ name: "hero.png", size: MaxOrgBannerBytes })).toBeNull();
    expect(rejectOrgBanner({ name: "hero.png", size: MaxOrgBannerBytes + 1 })).toBe(OrgBannerRejection.TooLarge);
  });

  test("one key per org, and a URL versioned by the upload time", () => {
    expect(orgBannerStorageKey("abc")).toBe("org-banners/abc.webp");
    const at = new Date("2026-11-10T09:00:00.000Z");
    expect(orgBannerPath("abc", at)).toBe(`/api/org/abc/banner?v=${at.getTime()}`);
    expect(orgBannerPath("abc", at.toISOString())).toBe(orgBannerPath("abc", at));
    expect(orgBannerPath("a b", at)).toContain("/api/org/a%20b/banner");
  });
});

test.describe("org banner transcoding", () => {
  /** A solid raster of the given size as PNG */
  const png = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#1b5e4a" } }).png().toBuffer();

  test("fits a large photo within the cap, keeps the aspect ratio and encodes WebP", async () => {
    const result = await transcodeOrgBanner(new Uint8Array(await png(3000, 1000)));
    expect(result).not.toBeNull();
    expect(result?.width).toBe(OrgBannerMaxSide);
    expect(result?.height).toBe(OrgBannerMaxSide / 3);
    const meta = await sharp(result?.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(OrgBannerMaxSide);
  });

  test("caps a tall image on its height, and never enlarges a small one", async () => {
    const tall = await transcodeOrgBanner(new Uint8Array(await png(1000, 4000)));
    expect([tall?.width, tall?.height]).toEqual([OrgBannerMaxSide / 4, OrgBannerMaxSide]);
    const small = await transcodeOrgBanner(new Uint8Array(await png(300, 100)));
    expect([small?.width, small?.height]).toEqual([300, 100]);
  });

  test("drops metadata and applies the EXIF orientation", async () => {
    // A 400x100 image tagged as rotated 90°: shown as 100x400, and that is what gets stored
    const tagged = await sharp(await png(400, 100)).withMetadata({ orientation: 6, exif: { IFD0: { ImageDescription: "secret" } } }).jpeg().toBuffer();
    const result = await transcodeOrgBanner(new Uint8Array(tagged));
    expect([result?.width, result?.height]).toEqual([100, 400]);
    const meta = await sharp(result?.data).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  test("rasterises an SVG at the cap instead of its nominal size, keeping transparency", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40"><circle cx="20" cy="20" r="15" fill="#0a0"/></svg>';
    const result = await transcodeOrgBanner(new Uint8Array(Buffer.from(svg)));
    expect(result?.width).toBe(OrgBannerMaxSide);
    expect(result?.height).toBe(OrgBannerMaxSide / 3);
    expect((await sharp(result?.data).metadata()).hasAlpha).toBe(true);
  });

  test("answers null for bytes that are not an image", async () => {
    expect(await transcodeOrgBanner(new Uint8Array(Buffer.from("not an image at all")))).toBeNull();
    expect(await transcodeOrgBanner(new Uint8Array(Buffer.from("<html><body>hi</body></html>")))).toBeNull();
    expect(await transcodeOrgBanner(new Uint8Array(0))).toBeNull();
  });
});
