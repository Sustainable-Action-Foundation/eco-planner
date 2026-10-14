import ScaledGoalPreviewToggle from "@/components/pages/sections/scaledGoalPreviewToggle";
import { getScaledPreviewPrefill } from "@/fetchers/resolveSeriesRef";
import serveTea from "@/lib/i18nServer";

/**
 * A national goal scaled to the area of the user's org, as a copy of it would
 * start out (see `getScaledPreviewPrefill`); behind a checkbox, so the goal
 * page itself stays the national goal. Renders nothing for users without an
 * org with an area, so callers can include it unconditionally.
 */
export default async function ScaledGoalPreview({ goalId }: { goalId: string }) {
  const t = await serveTea(["pages", "common"]);
  const preview = await getScaledPreviewPrefill(t, goalId);
  if (!preview) return null;

  return (
    <section className="margin-block-100 padding-100 smooth" style={{ border: '1px solid var(--gray-80)' }}>
      <h2 className="margin-top-0 margin-bottom-50 font-weight-600" style={{ fontSize: '1.25rem' }}>
        {t("pages:goal.scaled_preview.heading")}
      </h2>
      <ScaledGoalPreviewToggle prefill={preview.prefill} areas={preview.areas} />
    </section>
  );
}
