/** Helper function for generating a string that will be appended to searchParams of the url */
export function getTrafaSearchQueryString(selection: { variableCode: string, valueCodes: string[] }[]) {
  // Find all metric variables, time variables and other variables in the selection
  let [metric, time] = ["", ""];
  const variableQueries: string[] = [];
  for (const object of selection) {
    if (object.variableCode == "metric") {
      metric = object.valueCodes.join("|");
    } else if (object.variableCode == "Tid" || object.variableCode == "Time") {
      time = object.valueCodes.join("|");
    } else {
      variableQueries.push([object.variableCode, object.valueCodes.join(",")].join(":"));
    }
  }

  // Build the search query string that will be appended to the url when fetching data from Trafa
  // "ar" is necessary for all requests to Trafa when trying to get data, even if another time interval is selected
  let searchQuery = "|ar";
  if (metric.length > 0) {
    if (time != "ar" && time != "") {
      searchQuery += `|${time}`;
    }
    searchQuery += `|${metric}`;
  }
  if (variableQueries.length > 0) {
    searchQuery += `|${variableQueries.join("|")}`;
  }
  return searchQuery;
}