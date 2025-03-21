// Helper function for generating a string that will be appended to searchParams of the url
export function getTrafaSearchQueryString(selection: { variableCode: string, valueCodes: string[] }[]) {
  const variableQueries: string[] = [];
  let metric: string = "";
  let time: string = "";
  for (const object of selection) {
    if (object.variableCode == "metric") {
      metric = object.valueCodes.join("|");
    } else if (object.variableCode == "Tid" || object.variableCode == "Time") {
      time = object.valueCodes.join("|");
    } else {
      variableQueries.push([object.variableCode, object.valueCodes.join(",")].join(":"));
    }
  }
  let searchQuery = "";
  if (metric.length > 0) {
    if (time != "ar") {
      searchQuery += (time != "" ? "|ar" + "|" + time : "") + "|" + metric;
    } else {
      searchQuery += "|ar|" + metric;
    }
  }
  if (variableQueries.length > 0) {
    searchQuery += "|" + variableQueries.join("|");
  }
  return (!selection.some(object => object.variableCode == "Tid" || object.variableCode == "Time") ? "|ar" : "") + searchQuery;
}