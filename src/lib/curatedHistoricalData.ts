import type { ApiSelectionItem, DatasetKeys } from "@/lib/api/apiTypes";
import type { TFunction } from "i18next";

export const CuratedHistoricalCategory = {
  Emissions: "EMISSIONS",
  Population: "POPULATION",
  Geography: "GEOGRAPHY",
} as const;
export type CuratedHistoricalCategory = (typeof CuratedHistoricalCategory)[keyof typeof CuratedHistoricalCategory];

export type CuratedHistoricalEntry = {
  /** Stable identifier for the entry; also used as a React key. */
  key: string;
  category: CuratedHistoricalCategory;
  name: string;
  description: string;
  dataset: DatasetKeys;
  tableId: string;
  /**
   * Dimension selection excluding Region, which is injected per geo area when
   * the entry is fetched. The time dimension is omitted on purpose: the pxWeb
   * layer expands a missing time dimension to all available periods, which is
   * exactly what a browsable series wants.
   */
  selection: ApiSelectionItem[];
  /**
   * Display unit. Declared here rather than read from the source table, since
   * table metadata units are inconsistent (e.g. TAB4357 reports one unit string
   * across substances that differ by a factor of a thousand).
   */
  unit: string | null;
};

/**
 * The curated set of historical statistics shown on an org's landing page,
 * localized to the org's geo area. Entries only need Region + fixed dimension
 * codes; areas missing from a table (e.g. counties in the municipality-only
 * emissions table) simply drop that entry.
 */
export function getCuratedHistoricalCatalog(t: TFunction): CuratedHistoricalEntry[] {
  return [
    {
      key: "ghg-emissions",
      category: CuratedHistoricalCategory.Emissions,
      name: t("pages:home.curated_historical.ghg_emissions_name"),
      description: t("pages:home.curated_historical.ghg_emissions_description"),
      dataset: "SCB",
      tableId: "TAB4357",
      selection: [
        // Greenhouse gases, in kilotonnes of CO2 equivalents
        { variableCode: "AmneMiljo", valueCodes: ["GHG"] },
        // The table's only content code ("Ämne")
        { variableCode: "ContentsCode", valueCodes: ["000000KY"] },
      ],
      unit: "kt CO₂e",
    },
    // Note when adding entries: verify the table actually carries data for the
    // targeted region level. TAB4357 lists all municipalities but only
    // publishes GHG values for them; its other substances (NOX, PM25, ...) are
    // null for every municipality and would just negative-cache.
    {
      key: "population",
      category: CuratedHistoricalCategory.Population,
      name: t("pages:home.curated_historical.population_name"),
      description: t("pages:home.curated_historical.population_description"),
      dataset: "SCB",
      tableId: "TAB638",
      selection: [
        // Total population; the table's other dimensions (marital status, age,
        // sex) are eliminable and aggregate to totals when omitted
        { variableCode: "ContentsCode", valueCodes: ["BE0101N1"] },
      ],
      unit: null,
    },
    {
      key: "land-area",
      category: CuratedHistoricalCategory.Geography,
      name: t("pages:home.curated_historical.land_area_name"),
      description: t("pages:home.curated_historical.land_area_description"),
      dataset: "SCB",
      tableId: "TAB6420",
      selection: [
        // Specifically land areas, not including water
        { variableCode: "ArealTyp", valueCodes: ["01"] },
        // Magic string to get area sizes in square kilometers (as opposed to hectares with "000007E1")
        { variableCode: "ContentsCode", valueCodes: ["000007DY"] },
      ],
      unit: "km²",
    },
  ];
}
