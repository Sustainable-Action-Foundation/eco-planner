import { parseUnit } from "@/functions/unit";
import type { DateValues, GoalCreateFull } from "@/types";
import { GoalDataTarget } from "@/types/enums";
import { isISOIshDate } from "@/types/typeguards";

/**
 * Parser for the goal CSV uploaded in the roadmap iteration form (LEAP-style
 * exports): a `Branch Path` and `Units` column plus one column per 4-digit year,
 * optionally preceded by a metadata row and a blank row.
 */

/**
 * Decodes as UTF-8, falling back to Windows-1252 (what Excel writes unless
 * exporting "CSV UTF-8") when the UTF-8 decode produces replacement characters.
 * Strips a leading BOM.
 */
function decodeCsv(csv: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(csv);
  const text = utf8.includes("\uFFFD") ? new TextDecoder("windows-1252").decode(csv) : utf8;
  return text.startsWith("\uFEFF") ? text.slice(1) : text;
}

/**
 * Guesses the delimiter from the first line: LEAP and sv-SE Excel write
 * semicolons, en-US Excel writes commas. Ties (including zero) fall back to
 * semicolon, the format's canonical delimiter.
 */
function detectDelimiter(text: string): ";" | "," {
  let semicolons = 0;
  let commas = 0;
  let inQuotes = false;
  for (const char of text) {
    if (char === '"') inQuotes = !inQuotes;
    else if (inQuotes) continue;
    else if (char === ";") semicolons++;
    else if (char === ",") commas++;
    else if (char === "\n" || char === "\r") break;
  }
  return commas > semicolons ? "," : ";";
}

/** Parses a CSV file into rows of cells (RFC 4180: quoted cells may contain the delimiter, newlines, and `""` escapes) */
export function parseGoalCsv(csv: ArrayBuffer): string[][] {
  const text = decodeCsv(csv);
  const delimiter = detectDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      }
      else cell += char;
    }
    else if (char === '"') inQuotes = true;
    else if (char === delimiter) { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    }
    else cell += char;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

/**
 * Turns parsed CSV rows into goal create inputs for the roadmap iteration API,
 * which creates each `dataSeries` as manual input under the iteration.
 * Requires headers on the first or third row (LEAP exports put a metadata row
 * and a blank row above them) and throws if any required header is missing.
 * @param csv A 2D array of strings
 * @param scaleWarningCallback A function to call if the CSV contains a column for the deprecated "Scale" header
 */
export function csvToGoalList(csv: string[][], scaleWarningCallback?: () => void): GoalCreateFull[] {
  if (csv.length > 2 && !csv[1].some(cell => cell.trim() !== "")) {
    csv = csv.slice(2);
  }
  if (csv.length === 0) return [];

  const headers = csv[0].map(header => header.trim());

  /** Format: `ourFieldName: csvHeaderName` */
  const nonNumericHeaders = {
    indicatorParameter: "Branch Path",
    dataUnit: "Units",
  };
  const definedYears = headers.filter(header => /^\d{4}$/.test(header));

  // Unsupported header which might be present in the CSV
  if (headers.includes("Scale") && scaleWarningCallback) {
    scaleWarningCallback();
  }

  const headerIndex: Record<string, number> = {};
  for (const [field, csvHeader] of Object.entries(nonNumericHeaders)) {
    const index = headers.indexOf(csvHeader);
    if (index === -1) throw new Error(`Missing header "${csvHeader}"`);
    headerIndex[field] = index;
  }
  for (const year of definedYears) {
    headerIndex[year] = headers.indexOf(year);
  }

  const output: GoalCreateFull[] = [];
  for (let i = 1; i < csv.length; i++) {
    const row = csv[i];

    // Skip rows without an indicatorParameter
    const indicatorParameter = row[headerIndex.indicatorParameter]?.trim();
    if (!indicatorParameter) continue;

    const dateValues: DateValues = {};
    for (const year of definedYears) {
      const cell = row[headerIndex[year]]?.trim();
      // Empty cells are years without data
      if (!cell) continue;

      // Tolerate decimal commas and space/nbsp digit grouping
      const value = parseFloat(cell.replace(/\s/g, "").replaceAll(",", "."));
      if (!Number.isFinite(value)) {
        throw new Error(`Value "${cell}" for year ${year} on row ${i + 1} is not a number`);
      }

      const isoDate: string = `${year}-01-01T00:00:00Z`;
      if (!isISOIshDate(isoDate)) throw new Error(`Invalid ISOIshDate generated from year: ${year}`);
      dateValues[isoDate] = value;
    }

    output.push({
      target: GoalDataTarget.Full,
      iterationId: "", // The API assigns the iteration the goals are nested under
      indicatorParameter,
      name: undefined,
      description: undefined,
      isFeatured: undefined,
      isUnlisted: undefined,
      rawTags: undefined,
      dataSeries: {
        dateValues,
        unit: parseUnit(row[headerIndex.dataUnit]?.trim()),
      },
    });
  }

  return output;
}
