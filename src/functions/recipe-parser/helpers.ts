import { RecipeVariableDataSeries, RecipeVariableScalar, RecipeVariableVector } from "./types";

/** Predefined variable names for normalization. */
const normalizedVariableNames = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU", "AV", "AW", "AX", "AY", "AZ", "BA", "BB", "BC", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BK", "BL", "BM", "BN", "BO", "BP", "BQ", "BR", "BS", "BT", "BU", "BV", "BW", "BX", "BY", "BZ", "CA", "CB", "CC", "CD", "CE", "CF", "CG", "CH", "CI", "CJ", "CK", "CL", "CM", "CN", "CO", "CP", "CQ", "CR", "CS", "CT", "CU", "CV"];
export function getVariableName(index: number): string {
  // Try to get a normalized variable name from the predefined list
  if (normalizedVariableNames[index]) {
    return normalizedVariableNames[index];
  }

  const maxTries = 1000; // Limit to prevent infinite loop
  let tries = 0;

  // Fallback to calculating a name based on the index
  index = normalizedVariableNames.length + index; // Start from the end of the predefined list  

  // Convert index to a letter (e.g., 0 -> 'A', 1 -> 'B', ..., 25 -> 'Z', 26 -> 'AA', etc.)
  let name = "";
  let i = index;
  do {
    if (tries++ > maxTries) {
      throw new Error("Too many tries to generate a variable name, something is wrong.");
    }

    name = String.fromCharCode((i % 26) + 65) + name; // 65 is ASCII code for 'A'
    i = Math.floor(i / 26) - 1; // Adjust for zero-based index
  } while (i >= 0);
  return name;
}

export function groupVariables(variables: Record<string, any>): {
  vectors: [string, RecipeVariableVector][],
  scalars: [string, RecipeVariableScalar][],
  dataSeries: [string, RecipeVariableDataSeries][],
} {
  const vectors: [string, RecipeVariableVector][] = [];
  const scalars: [string, RecipeVariableScalar][] = [];
  const dataSeries: [string, RecipeVariableDataSeries][] = [];

  Object.entries(variables).forEach(([key, variable]) => {
    switch (variable.type) {
      case "scalar":
        scalars.push([key, variable]);
        break;
      case "vector":
        vectors.push([key, variable]);
        break;
      case "dataSeries":
        dataSeries.push([key, variable]);
        break;
      default:
        throw new Error(`Unknown variable type for '${key}': ${variable.type}`);
    }
  });

  return { vectors, scalars, dataSeries };
}
