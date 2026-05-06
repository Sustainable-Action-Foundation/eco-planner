/* Various style options for graphs to make consistency over several files easier */

import type { ApexMarkers, ApexStroke } from "apexcharts";

/* TODO: Look over the colours here */
/* TODO: Create a type for this */
/* TODO: Move more config options here? */
export const color_palette = {
  data: { color: '#0090ff', fillOpacity: 1 },
  historical: { color: '#2e8a56', fillOpacity: 0.3 },
  expected: { color: '#f59e0b', fillOpacity: 1 },
  baseline: { color: 'red', fillOpacity: 1 },
  secondaryGoal: { color: 'purple', fillOpacity: 1 },
  parentGoal: { color: 'teal', fillOpacity: 1 },
};

export const marker: ApexMarkers = {
  size: 3,
};

export const stroke: ApexStroke = {
  curve: 'straight',
  width: 3,
};