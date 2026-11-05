/**
 * How a roadmap is labelled when picked from a list: its name followed by
 * where it applies, so the many roadmaps sharing a name are told apart —
 * "Klimatfärdplan (Uppsala kommun)". The place is the roadmap's geo area,
 * or failing that the owning organisation. Display-only, for pickers; pages
 * and lists that already show the org keep the bare name.
 */
export function roadmapPickerLabel(roadmap: {
  name: string,
  geo_area?: { name: string } | null,
  access_control?: { org?: { name: string } | null } | null,
}): string {
  const place = roadmap.geo_area?.name || roadmap.access_control?.org?.name;
  return place ? `${roadmap.name} (${place})` : roadmap.name;
}
