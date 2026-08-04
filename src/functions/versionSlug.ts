/**
 * Parses a roadmap version URL slug. `"v3"` → 3, `"latest"` → `"latest"`, anything else → null.
 */
export function parseVersionSlug(slug: string): number | "latest" | null {
  if (slug === "latest") return "latest";
  const match = /^v(\d+)$/.exec(slug);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Builds the path to a roadmap iteration page, e.g. `/roadmap/<id>/v3` or `/roadmap/<id>/latest`.
 */
export function iterationPath(roadmapId: string, version: number | "latest"): string {
  return `/roadmap/${roadmapId}/${version === "latest" ? "latest" : `v${version}`}`;
}
