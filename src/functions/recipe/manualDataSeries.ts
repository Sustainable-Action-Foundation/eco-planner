import { Recipe } from "@/functions/recipe/recipe";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import { serializeUnit } from "@/functions/unit";
import type { DateValuesWithUnit } from "@/types";

/**
 * Builds the nested create data for a hand-entered data series: the series plus
 * its producing inline manual recipe (`meta.isManual`), both owned by `orgId`.
 * Usable in any nested `create:` position for a DataSeries relation.
 *
 * Pure (no Prisma, no `server-only`) so it can be unit tested; re-exported from
 * `./persistence` where the rest of the recipe persistence lives.
 */
export function manualDataSeriesCreateData(dateValues: DateValuesWithUnit, orgId: string, authorId: string) {
  return {
    org: { connect: { id: orgId } },
    author: { connect: { id: authorId } },
    unit: serializeUnit(dateValues.unit), // db keeps the legacy convention
    values: { createMany: { data: dateValuesToDBDateRecord(dateValues.dateValues) } },
    recipe_used: {
      create: {
        recipe: Recipe.fromManualDateValues(dateValues).serialize(),
        org: { connect: { id: orgId } },
      },
    },
  };
}
