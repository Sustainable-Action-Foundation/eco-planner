export type DataSeries = {
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
}

export type RecipeVariableScalar = {
  type: "scalar";
  value: number;
}
/** Should maybe be transformed into a @type {DataSeries} for better compatibility with other data sources? TODO */
export type RecipeVariableVector = {
  type: "vector";
  value: (number | string | null | undefined)[];
}
export type RecipeVariableDataSeries = {
  type: "dataSeries";
  value: DataSeries;
}
/** This should not be saved in the recipe on the db. It should be transformed into @type {RecipeVariableExternalDataset} */
export type RecipeVariableUrl = {
  type: "url";
  value: string;
}
export type RecipeVariableExternalDataset = {
  type: "externalDataset";
  value: {
    dataset: string; // e.g. "SCB", "Trafa"
    tableId: string; // e.g. "AM0101"
    variableId: string; // e.g. "Inkomst"
  }
}

export type UnparsedRecipeVariables = Record<string, RecipeVariableScalar | RecipeVariableVector | RecipeVariableDataSeries | RecipeVariableUrl | RecipeVariableExternalDataset>;
export type ParsedRecipeVariables = Record<string, RecipeVariableScalar | RecipeVariableDataSeries | RecipeVariableExternalDataset>;

/** Some variables are fine to take as input but need to be transformed to fit in the backend so that's why there are two types */
export type UnparsedRecipe = {
  eq: string;
  variables: UnparsedRecipeVariables;
};
/** Some variables will need to be transformed to fit this normalized recipe */
export type ParsedRecipe = {
  eq: string;
  variables: ParsedRecipeVariables;
};

/** 
 * TODO - add descriptions for all interpolation methods
 */
export type RecipeParserOptions = {
  interpolationMethod: "interpolate_missing" | "only_overlapping" | "zero_fill" | "none";
  log: boolean; // Whether to log the parsing process
};
export const defaultRecipeParserOptions: RecipeParserOptions = {
  interpolationMethod: "interpolate_missing",
  log: false, // Default to not logging the parsing process
};
export type VectorTransformationOptions = {
  interpolationMethod: "naive_index_map" | "even_distribution" | "require_length_match";
  fillMethod: "zero_fill" | "null_fill";
};
export const defaultVectorTransformationOptions: Partial<VectorTransformationOptions> = {
  interpolationMethod: "naive_index_map",
  fillMethod: "null_fill",
};
