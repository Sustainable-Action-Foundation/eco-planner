import { getOneRoadmapIteration } from "@/fetchers";
import { iterationPath } from "@/functions/versionSlug";
import { notFound, redirect } from "next/navigation";

/**
 * Compatibility route: links an iteration by ID without knowing its version.
 * Redirects to the canonical `/roadmap/<roadmapId>/v<version>` page.
 */
export default async function Page(props: { params: Promise<{ roadmapId: string, iterationId: string }> }) {
  const params = await props.params;
  const iteration = await getOneRoadmapIteration(params.iterationId);

  // Not found also covers iterations the user may not see
  if (!iteration) {
    return notFound();
  }

  // The iteration's own roadmap is authoritative, should the roadmap id in the path be wrong
  redirect(iterationPath(iteration.roadmap_id, iteration.version));
}
