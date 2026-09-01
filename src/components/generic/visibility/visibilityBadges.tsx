import "server-only";
import styles from "./visibility.module.css" with { type: "css" };
import { GoalListing, IterationStatus } from "@/lib/prisma/generated";
import serveTea from "@/lib/i18nServer";
import { IconEyeOff, IconPencil, IconStar } from "@tabler/icons-react";

/**
 * The state badges for a version (draft) and, on a goal, its listing
 * (unlisted / featured). Published and listed items get no badge: they are the
 * normal case. Kept in one place so the same words and colours show everywhere.
 */
export default async function VisibilityBadges({
  status,
  listing,
  className,
}: {
  status?: IterationStatus;
  listing?: GoalListing;
  className?: string;
}) {
  const t = await serveTea("components");

  const badges: { key: string, className: string, icon: React.ReactNode, label: string }[] = [];
  if (status === IterationStatus.DRAFT) {
    badges.push({ key: "draft", className: styles.draft, icon: <IconPencil aria-hidden="true" width={14} height={14} style={{ minWidth: '14px' }} />, label: t("components:visibility_badge.draft") });
  }
  if (listing === GoalListing.UNLISTED) {
    badges.push({ key: "unlisted", className: styles.unlisted, icon: <IconEyeOff aria-hidden="true" width={14} height={14} style={{ minWidth: '14px' }} />, label: t("components:visibility_badge.unlisted") });
  }
  if (listing === GoalListing.FEATURED) {
    badges.push({ key: "featured", className: styles.featured, icon: <IconStar aria-hidden="true" width={14} height={14} style={{ minWidth: '14px' }} />, label: t("components:visibility_badge.featured") });
  }
  if (badges.length === 0) return null;

  return (
    <span className={`inline-flex align-items-center gap-25 flex-wrap-wrap ${className ?? ""}`}>
      {badges.map(badge => (
        <span key={badge.key} className={`${styles.badge} ${badge.className}`} data-testid={`visibility-badge-${badge.key}`}>
          {badge.icon}
          {badge.label}
        </span>
      ))}
    </span>
  );
}
