import { VectorTransformError } from "./errors";
import { DataSeries, defaultVectorTransformationOptions } from "./types";


const startYear = 2020;
const endYear = 2050;
const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => (startYear + i).toString()) as (keyof DataSeries)[];

export function vectorToDataSeries(vector: (number | string | undefined | null)[], options = defaultVectorTransformationOptions): DataSeries {
  options = { ...defaultVectorTransformationOptions, ...options };

  /** The working array for the cleaned input before mapping to years */
  const vec: (number | null)[] = [];

  /** Cast types */
  for (const val of vector) {
    /** Strings */
    if (typeof val === "string") {
      const parsedNumber = parseFloat(val);
      if (!Number.isFinite(parsedNumber) && !Number.isNaN(parsedNumber)) throw new VectorTransformError(`Tried converting string (${val}) into a number but the result is not finite or NaN.`)
      vec.push(parsedNumber)
    }

    /** Numbers */
    else if (typeof val === "number") {
      const number = val;
      if (!Number.isFinite(number) && !Number.isNaN(number)) throw new VectorTransformError(`Tried converting number (${number}) into a number but the result is not finite or NaN.`)
      vec.push(number);
    }

    /** Null or undefined */
    else if (typeof val === "undefined" || val === null) {
      // Explicit undefined and empty values are treated as null for the sake of data base ease
      vec.push(null);
    }

    /** Wtf... */
    else {
      throw new VectorTransformError(`Vector to data series function received vector containing unknown type (${typeof val})`);
    }
  }

  /**
   * Start transforming the vector into a DataSeries.
   */
  const dataSeries = {} as DataSeries;

  switch (options.fillMethod) {
    case "zero_fill":
      for (let i = 0; i < years.length; i++) {
        dataSeries[years[i]] = vec[i] ?? 0; // Fill with 0 if undefined
      }
      break;

    case "interpolate_missing":
      for (let i = 0; i < years.length; i++) {
        if (vec[i]) {
          dataSeries[years[i]] = vec[i]; // Use the actual value if it exists
        }
        // Else... 
        else if (vec[i] === undefined || vec[i] === null) {
          // Interpolate missing values only if both previous and next values are available
          // This is a simple linear interpolation
          const prev = vec[i - 1];
          const next = vec[i + 1];
          if (prev && next) {
            const sum = prev + next;
            if (!Number.isFinite(sum)) {
              throw new VectorTransformError(`Interpolation resulted in a non-finite number (${sum}) for year ${years[i]}. Previous: ${prev}, Next: ${next}`);
            }
            dataSeries[years[i]] = sum / 2; // Average of previous and next
          }
        }
      }
      break;

    default:
      throw new VectorTransformError(`Unknown interpolation method: ${options.fillMethod}`);
  }

  return dataSeries;
}
