import { VectorTransformError } from "./errors";
import { DataSeries, VectorTransformationOptions, defaultVectorTransformationOptions } from "./types";

export function vectorToDataSeries(vector: (number | string | undefined | null)[], options = defaultVectorTransformationOptions): DataSeries {
  options = { ...defaultVectorTransformationOptions, ...options };

  const vec: (number | null)[] = [];

  for (const val of vector) {
    if (typeof val === "string") {
      const parsedNumber = parseFloat(val);
      if (!Number.isFinite(parsedNumber) && !Number.isNaN(parsedNumber)) throw new VectorTransformError(`Tried converting string (${val}) into a number but the result is not finite or NaN.`)
      vec.push(parsedNumber)
    }
    else if (typeof val === "number") {
      const number = val;
      if (!Number.isFinite(number) && !Number.isNaN(number)) throw new VectorTransformError(`Tried converting number (${number}) into a number but the result is not finite or NaN.`)
      vec.push(number);
    }
    else if (typeof val === "undefined" || val === null) {
      // Explicit undefined and empty values are treated as null for the sake of data base ease
      vec.push(null);
    }
    else {
      throw new VectorTransformError(`Vector to data series function received vector containing unknown type (${typeof val})`);
    }
  }

  const dataSeries = {} as DataSeries;
  const years: (keyof DataSeries)[] = new Array(31).fill(2020).map((y, i) => (y + i).toString()) as (keyof DataSeries)[];

  switch (options.interpolationMethod) {
    case "naive_index_map":
      years.forEach((year, i) => {
        dataSeries[year] = vec[i] ?? (options.fillMethod === "zero_fill" ? 0 : null);
      });
      break;
    case "even_distribution":
      const vectorLength = vec.length;
      const yearCount = years.length;
      const step = yearCount / vectorLength;
      const indices = Array.from({ length: yearCount }, (_, i) => Math.floor(i * step));
      for (let i = 0; i < yearCount; i++) {
        if (indices.includes(i)) {
          const index = indices.indexOf(i);
          dataSeries[years[i]] = vec[index] ?? (options.fillMethod === "zero_fill" ? 0 : null);
        }
        else {
          // Fill
          dataSeries[years[i]] = (options.fillMethod === "zero_fill" ? 0 : null);
        }
      }
      break;
    case "require_length_match":
      if (vec.length !== years.length) {
        throw new VectorTransformError(`Vector length (${vec.length}) does not match the number of years (${years.length}). Use a different interpolation method or adjust the vector length.`);
      }
      years.forEach((year, i) => {
        dataSeries[year] = vec[i] ?? (options.fillMethod === "zero_fill" ? 0 : null);
      });
      break;
    default:
      throw new VectorTransformError(`Unknown interpolation method: ${options.interpolationMethod}`);
  }

  return dataSeries;
}
