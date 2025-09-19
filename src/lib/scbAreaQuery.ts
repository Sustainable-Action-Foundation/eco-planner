'use server';

import getPxWebTableContent from "./pxWeb/getPxWebTableContent";
import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from 'next/cache';

/**
 * Queries SCB for area data.
 * @param areaCode The area code of the target area as defined by SCB.
 * @param parentAreaCode The area code of the parent area as defined by SCB. Doesn't have to contain the target area.
 * @returns Object containing the area of the target area and the parent area. Returns null if the query fails.
 */
export default async function scbAreaQuery(areaCode: string, parentAreaCode?: string) {
  const area = await getCachedQuery(areaCode);
  let parentArea: Awaited<ReturnType<typeof getCachedQuery>> = null;
  if (parentAreaCode) {
    parentArea = await getCachedQuery(parentAreaCode);
  }

  return {
    area,
    parentArea
  };
}

async function getCachedQuery(areaCode: string) {
  'use cache';
  cacheTag('scbAreaQuery');
  cacheLife("days");

  const selection = [
    // Selected area
    { variableCode: "Region", valueCodes: [areaCode] },
    // Specifically land areas, not including water
    { variableCode: "ArealTyp", valueCodes: ["01"] },
    // Magic string to get area sizes in square kilometers (as opposed to hectares with "000007E1")
    { variableCode: "ContentsCode", valueCodes: ["000007DY"] },
    // Use the latest time period
    { variableCode: "Tid", valueCodes: ["TOP(1)"] }
  ];

  const result = await getPxWebTableContent("TAB6420", "SCB", selection, undefined);

  if (!result) return null;
  // Get first (hopefully only) value
  const areaData = result.values[0]?.value;
  return areaData ?? null;
}