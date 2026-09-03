/**
 * What a goal is called in listings: its name, or the last segment of its
 * LEAP indicator parameter when it has none (imported scenarios name nothing).
 */
export function goalDisplayName(goal: { name: string | null, indicator_parameter: string }): string {
  return goal.name || indicatorParameterLeaf(goal.indicator_parameter);
}

/** `Key\Landtransporter\Personbilar\Elbilar\Antal bilar` → `Antal bilar` */
export function indicatorParameterLeaf(indicatorParameter: string): string {
  return indicatorParameter.split("\\").filter(Boolean).at(-1) ?? indicatorParameter;
}

/** The segments above the leaf, for context: `Landtransporter › Personbilar › Elbilar` (the leading "Key" is dropped). */
export function indicatorParameterContext(indicatorParameter: string): string {
  const segments = indicatorParameter.split("\\").filter(Boolean).slice(0, -1);
  if (segments[0] === "Key") segments.shift();
  return segments.join(" › ");
}
