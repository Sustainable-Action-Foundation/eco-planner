// The seeded places as geo area references, the way the app describes areas,
// plus where the national scenario's export lives. Shared by the seed and the
// statistics refresh script so both talk about the same areas and rows.

import path from "node:path";
import areaCodes from "@/lib/areaCodes.json" with { type: "json" };
import { GeoAreaType } from "@/lib/prisma/generated";
import type { GeoAreaRef } from "@/types";
import { seedPlaces } from "./places";
import type { SeedPlace } from "./places";

/** The LEAP export of the national scenario, in the layout the goal CSV import reads (see parseGoalCsv) */
export const LEAP_CSV_PATH = path.join("scripts", "prisma", "seed", "data", "leap-lokal-miljohansyn.csv");

const nameByCode = new Map(Object.entries(areaCodes).map(([name, code]) => [code, name]));

export function placeArea(place: SeedPlace): GeoAreaRef {
  const name = nameByCode.get(place.geoCode);
  if (!name) throw new Error(`Seed place ${place.name} has an unknown geo area code ${place.geoCode}`);
  return { code: place.geoCode, name, type: place.geoCode.length === 2 ? GeoAreaType.COUNTY : GeoAreaType.MUNICIPALITY };
}

/** The areas that get a copy of the national scenario */
export function placeAreas(): GeoAreaRef[] {
  return seedPlaces.filter(place => place.leapCopy).map(placeArea);
}
