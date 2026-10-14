import "server-only";
import serveTea from "@/lib/i18nServer";

// Prisma stamps created_at and updated_at separately on insert, so a never-edited row can differ by a few ms
const EDIT_THRESHOLD_MS = 60_000;

/**
 * Small muted line with when an entity was created and, if it has been edited since, last updated.
 * Dates go through i18next's datetime formatter, so they follow the active locale.
 */
export default async function EntityTimestamps({
  createdAt,
  updatedAt,
  className,
}: {
  createdAt: Date;
  updatedAt: Date;
  className?: string;
}) {
  const t = await serveTea("components");

  const formatParams = { date: { dateStyle: "medium" } } as const;
  const edited = updatedAt.getTime() - createdAt.getTime() > EDIT_THRESHOLD_MS;

  return (
    <small className={`block ${className ?? ""}`} style={{ color: 'gray' }} data-testid="entity-timestamps">
      <time dateTime={createdAt.toISOString()}>
        {t("components:entity_timestamps.created", { date: createdAt, formatParams })}
      </time>
      {edited ? <>
        {" · "}
        <time dateTime={updatedAt.toISOString()}>
          {t("components:entity_timestamps.updated", { date: updatedAt, formatParams })}
        </time>
      </> : null}
    </small>
  );
}
