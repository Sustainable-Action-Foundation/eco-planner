'use server';

import getPxWebTableContent from "./pxWeb/getPxWebTableContent";
import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from 'next/cache';


/**
 * Queries SCB for population data.
 * @param areaCode The area code of the target area as defined by SCB.
 * @param parentAreaCode The area code of the parent area as defined by SCB. Doesn't have to contain the target area.
 * @returns Object containing the population of the target area and the parent area. Returns null if the query fails.
 */
export default async function scbPopulationQuery(areaCode: string, parentAreaCode?: string) {
  const population = await getCachedQuery(areaCode);
  let parentPopulation: Awaited<ReturnType<typeof getCachedQuery>> = null;
  if (parentAreaCode) {
    parentPopulation = await getCachedQuery(parentAreaCode);
  }

  return {
    population,
    parentPopulation
  };
}

async function getCachedQuery(areaCode: string) {
  'use cache';
  cacheTag('scbPopulationQuery');
  cacheLife("days");

  const selection = [
    // Selected area
    { variableCode: "Region", valueCodes: [areaCode] },
    // Include all population, regardless of age (Ålder) or gender (Kön)
    { variableCode: "Alder", valueCodes: ["TotSA"] },
    { variableCode: "Kon", valueCodes: ["TotSA"] },
    // Magic string for population data per month
    { variableCode: "ContentsCode", valueCodes: ["000007SF"] },
    // Use the latest time period
    { variableCode: "Tid", valueCodes: ["TOP(1)"] }
  ];

  const result = await getPxWebTableContent("TAB6471", "SCB", selection, "sv");

  if (!result) return null;
  // Get first (hopefully only) value
  const populationData = result.values[0]?.value;
  return populationData ?? null;
}