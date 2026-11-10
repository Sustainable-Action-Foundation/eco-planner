import { OrgBannerMaxSide, OrgBannerQuality } from "@/functions/orgBanner";
import sharp from "sharp";

/*
 * Turns whatever image a manager uploads into the one WebP the landing page shows.
 * Node-only (sharp), but without a `server-only` marker so the unit tests can run it.
 */

/** Cap on the decoded input, in pixels (50 MP): bounds memory per upload; a phone photo is a tenth of that. */
const maxInputPixels = 50e6;

/** sharp refuses densities above this */
const maxDensity = 100_000;

export type TranscodedBanner = { data: Buffer, width: number, height: number };

/**
 * Decodes the upload, applies its EXIF orientation, fits it within `OrgBannerMaxSide`
 * on both sides (never enlarging) and encodes a WebP at `OrgBannerQuality` with all
 * metadata dropped. Transparency is kept (a logo-like SVG sits on the hero's colour).
 * Resolves null when the bytes don't decode as an image.
 */
export async function transcodeOrgBanner(input: Uint8Array): Promise<TranscodedBanner | null> {
  try {
    let density: number | undefined;
    const metadata = await sharp(input, { limitInputPixels: maxInputPixels }).metadata();
    if (metadata.format === "svg") {
      // An SVG has no pixels of its own and is drawn at 72 dpi, which turns a logo-sized
      // viewBox into a thumbnail: scale the density so its longer side lands on the cap
      const longest = Math.max(metadata.width ?? 0, metadata.height ?? 0);
      if (longest > 0) density = Math.min(maxDensity, Math.max(1, 72 * OrgBannerMaxSide / longest));
    }

    const { data, info } = await sharp(input, { limitInputPixels: maxInputPixels, density })
      .rotate()
      .resize({ width: OrgBannerMaxSide, height: OrgBannerMaxSide, fit: "inside", withoutEnlargement: true })
      .webp({ quality: OrgBannerQuality })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    return null;
  }
}
