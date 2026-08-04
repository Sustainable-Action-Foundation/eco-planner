// Seeds the static GeoAreas lookup from the same source the app uses.
// Mirrors the derivation in the production migration: "00" is the nation,
// 2-digit codes are counties parented to "00", 4-digit codes are municipalities
// parented to their first two digits.

import { prisma } from "@/lib/prisma";
import { GeoAreaType } from "@/lib/prisma/generated";
import areaCodes from "@/lib/areaCodes.json" with { type: "json" };

export async function seedGeoAreas(): Promise<void> {
  const rows = Object.entries(areaCodes).map(([name, code]) => {
    if (!/^\d{2}(\d{2})?$/.test(code)) {
      throw new Error(`Unexpected geo area code format: ${code} (${name})`);
    }
    if (code === "00") {
      return { code, name, type: GeoAreaType.NATION, parent_code: null };
    }
    if (code.length === 2) {
      return { code, name, type: GeoAreaType.COUNTY, parent_code: "00" };
    }
    return { code, name, type: GeoAreaType.MUNICIPALITY, parent_code: code.slice(0, 2) };
  });

  // Parents before children, so the self-referencing FK holds row by row
  rows.sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code));

  await prisma.geoAreas.createMany({ data: rows });
}
