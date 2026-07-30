"use client";

import styles from './breadcrumbs.module.css' with { type: "css" };
import Link from 'next/link';
import { useTranslation } from "react-i18next";
import { IconChevronRight } from '@tabler/icons-react';
import type { Action, Goal, Roadmap, RoadmapIteration } from "@/types";
import { iterationPath } from "@/functions/versionSlug";

export function BreadcrumbChevron() {
  return (
    <IconChevronRight strokeWidth='2px' stroke='gray' aria-hidden="true"  height={16} width={16} />
  );
}

export function BaseSection() {
  const { t } = useTranslation("components");
  return (
    <span className='display-flex align-items-center gap-25'>
      <Link href='/' className={styles.breadCrumb}>
        {t("components:breadcrumbs_sections.home")}
      </Link>
    </span>
  );
}

export function CustomSection({
  title,
  link,
  linkText,
}: {
  title?: string,
  link?: string,
  linkText?: string,
}) {
  if (!title && !link) return null;
  return (
    <>
      <BreadcrumbChevron />

      <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
        {title || null}
        {link ? (
          <Link href={link} className={styles.breadCrumb}>
            {linkText || link || null}
          </Link>
        ) : null}
      </span>
    </>
  );
}

export function RoadmapSection({
  roadmap,
}: {
  roadmap: Pick<Roadmap, "id" | "name">
}) {
  const { t } = useTranslation("components");
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      {t("components:breadcrumbs_sections.roadmap")}
      <Link href={`/roadmap/${roadmap.id}`} className={styles.breadCrumb}>
        {roadmap.name}
      </Link>
    </span>
  );
}

export function RoadmapIterationSection({
  iteration,
}: {
  iteration: Pick<RoadmapIteration, "id" | "version"> & { roadmap: Pick<Roadmap, "id"> }
}) {
  const { t } = useTranslation("components");
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      {t("components:breadcrumbs_sections.version_label")}
      <Link href={iterationPath(iteration.roadmap.id, iteration.version)} className={styles.breadCrumb}>
        {t("components:breadcrumbs_sections.version", { version: iteration.version })}
      </Link>
    </span>
  );
}

export function GoalSection({
  goal,
}: {
  goal: Pick<Goal, "id" | "indicator_parameter"> & { name?: string | null }
}) {
  const { t } = useTranslation("components");
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      {t("components:breadcrumbs_sections.goal")}
      <Link href={`/goal/${goal.id}`} className={styles.breadCrumb}>
        {goal.name || goal.indicator_parameter}
      </Link>
    </span>
  );
}

export function ActionSection({
  action,
}: {
  action: Pick<Action, "id" | "name">
}) {
  const { t } = useTranslation("components");
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      {t("components:breadcrumbs_sections.action")}
      <Link href={`/action/${action.id}`} className={styles.breadCrumb}>
        {action.name}
      </Link>
    </span>
  );
}
