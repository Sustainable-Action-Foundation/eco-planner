"use client";

import styles from './breadcrumbs.module.css' with { type: "css" };
import Link from 'next/link';
import { useTranslation } from "react-i18next";
import { IconChevronRight } from '@tabler/icons-react';

export function BreadcrumbChevron() {
  return (
    <IconChevronRight strokeWidth='2px' stroke='gray' aria-label=' > ' height={16} width={16} aria-hidden="true" />
  )
}

export function BaseSection() {
  const { t } = useTranslation("components");
  return (
    <span className='display-flex align-items-center gap-25'>
      <Link href='/' className={styles.breadCrumb}>
        {t("components:breadcrumbs_sections.home")}
      </Link>
    </span>
  )
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
        {title ? title : null}
        {link ? (
          <Link href={link} className={styles.breadCrumb}>
            {linkText || link}
          </Link>
        ) : null}
      </span>
    </>
  )
}

export function MetaRoadmapSection({
  metaRoadmap,
}: {
  metaRoadmap: {
    id: string,
    name: string,
  }
}) {
  const { t } = useTranslation("components");
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      {t("components:breadcrumbs_sections.roadmap_series")}
      <Link href={`/metaRoadmap/${metaRoadmap.id}`} className={styles.breadCrumb}>
        {metaRoadmap.name}
      </Link>
    </span>
  )
}

export function RoadmapSection({
  roadmap,
}: {
  roadmap: {
    id: string,
    version: number,
  }
}) {
  const { t } = useTranslation("components");
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      {t("components:breadcrumbs_sections.version_label")}
      <Link href={`/roadmap/${roadmap.id}`} className={styles.breadCrumb}>
        {t("components:breadcrumbs_sections.version", { version: roadmap.version })}
      </Link>
    </span>
  )
}

export function GoalSection({
  goal,
}: {
  goal: {
    id: string,
    name?: string | null,
    indicatorParameter: string,
  }
}) {
  const { t } = useTranslation("components");
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      {t("components:breadcrumbs_sections.goal")}
      <Link href={`/goal/${goal.id}`} className={styles.breadCrumb}>
        {goal.name || goal.indicatorParameter}
      </Link>
    </span>
  )
}

export function ActionSection({
  action,
}: {
  action: {
    id: string,
    name: string,
  }
}) {
  const { t } = useTranslation("components");
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      {t("components:breadcrumbs_sections.action")}
      <Link href={`/action/${action.id}`} className={styles.breadCrumb}>
        {action.name}
      </Link>
    </span>
  )
}