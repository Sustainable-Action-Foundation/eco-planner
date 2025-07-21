
export type DataSeriesArray = Partial<{
  "2020": number | null;
  "2021": number | null;
  "2022": number | null;
  "2023": number | null;
  "2024": number | null;
  "2025": number | null;
  "2026": number | null;
  "2027": number | null;
  "2028": number | null;
  "2029": number | null;
  "2030": number | null;
  "2031": number | null;
  "2032": number | null;
  "2033": number | null;
  "2034": number | null;
  "2035": number | null;
  "2036": number | null;
  "2037": number | null;
  "2038": number | null;
  "2039": number | null;
  "2040": number | null;
  "2041": number | null;
  "2042": number | null;
  "2043": number | null;
  "2044": number | null;
  "2045": number | null;
  "2046": number | null;
  "2047": number | null;
  "2048": number | null;
  "2049": number | null;
  "2050": number | null;
}>;

export type RecipeVariableScalar = {
  type: "scalar";
  value: number;
  unit?: string;
};
export type RecipeVariableVector = {
  type: "vector";
  value: (number | string | null | undefined)[];
  unit?: string;
};

export type RawDataSeriesByLink = {
  type: "dataSeries";
  link: string; // uuid of data series in the database
}
export type RawDataSeriesByValue = {
  type: "dataSeries";
  value: DataSeriesArray;
  unit?: string;
}
/** A data series might be defined in the inheritance form or it might be imported and it might have a unit */
export type RecipeVariableRawDataSeries = RawDataSeriesByLink | RawDataSeriesByValue;
export type RecipeVariableDataSeries = {
  type: "dataSeries";
  link: string; // uuid of data series in the database
};

export type RecipeVariables = RecipeVariableScalar | RecipeVariableDataSeries;
export type Recipe = {
  eq: string;
  variables: Record<string, RecipeVariables>;
}

export type RawRecipeVariables = RecipeVariableScalar | RecipeVariableVector | RecipeVariableRawDataSeries;
/** Considered unsafe as it is. Comes from the client */
export type RawRecipe = {
  eq: string;
  variables: Record<string, RawRecipeVariables>;
}

/** 
 * TODO - add descriptions for all interpolation methods
 */
export type RecipeParserOptions = {
  // interpolationMethod: "interpolate_missing" | "only_overlapping" | "zero_fill" | "none";
};
export const defaultRecipeParserOptions: Partial<RecipeParserOptions> = {
  // interpolationMethod: "interpolate_missing",
};
export type VectorTransformationOptions = {
  fillMethod: "zero_fill" | "interpolate_missing" | "error";
};
export const defaultVectorTransformationOptions: Partial<VectorTransformationOptions> = {
  fillMethod: "interpolate_missing",
};
