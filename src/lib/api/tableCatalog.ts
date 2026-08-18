import type { ApiTableListEntry } from "./apiTypes";

/**
 * Some PxWeb sources (e.g. STEM) report their contents dimension under this
 * placeholder rather than a real variable name.
 */
export const PXWEB_CONTENTS_PLACEHOLDER = "ApiContentsVariableName";

export type TableCatalogFilters = {
  /** Free-text search matched case-insensitively against label and table ID */
  search?: string;
  /** Lowercased variable names; a table must contain ALL of them to match */
  variableFilters?: string[];
  /** Exact `timeUnit` to require; empty string or undefined means any */
  timeUnitFilter?: string;
  /** A year (as text) that must fall within the table's period range */
  coverageYearFilter?: string;
};

/** Client-side filtering of a fetched table catalog; all active filters are ANDed together. */
export function filterTableCatalog(tables: ApiTableListEntry[], filters: TableCatalogFilters): ApiTableListEntry[] {
  const search = filters.search?.trim().toLowerCase() ?? "";
  const variableFilters = filters.variableFilters ?? [];
  const timeUnitFilter = filters.timeUnitFilter ?? "";
  const coverageYearInput = filters.coverageYearFilter?.trim() ?? "";
  const coverageYear = /^\d{4}$/.test(coverageYearInput) ? parseInt(coverageYearInput, 10) : null;

  return tables.filter(table => {
    if (search && !table.label.toLowerCase().includes(search) && !table.tableId.toLowerCase().includes(search)) return false;
    if (variableFilters.length > 0) {
      const names = table.variableNames?.map(name => name.toLowerCase()) ?? [];
      if (!variableFilters.every(filter => names.includes(filter))) return false;
    }
    if (timeUnitFilter && table.timeUnit !== timeUnitFilter) return false;
    if (coverageYear !== null) {
      // Sub-yearly periods like "2024K2" parse to their year, since parseInt stops at the first non-digit
      const firstYear = parseInt(table.firstPeriod ?? "", 10);
      const lastYear = parseInt(table.lastPeriod ?? "", 10);
      if (Number.isNaN(firstYear) || Number.isNaN(lastYear) || coverageYear < firstYear || coverageYear > lastYear) return false;
    }
    return true;
  });
}

export type VariableFacetOption = {
  /** Lowercased name, used as the filter value */
  key: string;
  /** Name as first encountered in the catalog, used for display */
  name: string;
  /** Number of tables in the catalog containing this variable */
  count: number;
};

/**
 * Variable facet options aggregated over the whole catalog, keyed case-insensitively
 * since sources are inconsistent about capitalization. Sorted by table count
 * (descending), then name. The contents placeholder is excluded.
 */
export function aggregateVariableFacets(tables: ApiTableListEntry[]): VariableFacetOption[] {
  const counts = new Map<string, VariableFacetOption>();
  for (const table of tables) {
    for (const name of table.variableNames ?? []) {
      if (name === PXWEB_CONTENTS_PLACEHOLDER) continue;
      const key = name.toLowerCase();
      const existing = counts.get(key);
      if (existing) existing.count++;
      else counts.set(key, { key, name, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** The time units present in the catalog, in canonical order. */
export function aggregateTimeUnitFacets(tables: ApiTableListEntry[]): NonNullable<ApiTableListEntry["timeUnit"]>[] {
  const presentUnits = new Set(tables.map(table => table.timeUnit));
  return (["Annual", "Quarterly", "Monthly", "Weekly", "Other"] as const).filter(unit => presentUnits.has(unit));
}
