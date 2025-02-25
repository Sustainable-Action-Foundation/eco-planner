import styles from './breadcrumbs.module.css' with { type: "css" };
import Link from 'next/link';
import Image from "next/image";
import dict from "./breadcrumbSections.dict.json" assert { type: "json" };
import { getServerLocale } from '@/functions/serverLocale';

export function BreadcrumbChevron() {
  return (
    <Image src='/icons/chevronRight.svg' alt='' height={16} width={16} />
  )
}

export async function BaseSection() {
  const locale = await getServerLocale();
  return (
    <span className='display-flex align-items-center gap-25'>
      <Link href='/' className={styles.breadCrumb}>
        {dict.baseSection.home[locale]}
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

export async function MetaRoadmapSection({
  metaRoadmap,
}: {
  metaRoadmap: {
    id: string,
    name: string,
  }
}) {
  const locale = await getServerLocale();
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      {dict.metaRoadmapSection.roadmap[locale]}
      <Link href={`/metaRoadmap/${metaRoadmap.id}`} className={styles.breadCrumb}>
        {metaRoadmap.name}
      </Link>
    </span>
  )
}

export async function RoadmapSection({
  roadmap,
}: {
  roadmap: {
    id: string,
    version: number,
  }
}) {
  const locale = await getServerLocale();
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      {dict.roadmapSection.version[locale]}
      <Link href={`/roadmap/${roadmap.id}`} className={styles.breadCrumb}>
        {dict.roadmapSection.versionLink[locale]} {roadmap.version}
      </Link>
    </span>
  )
}

export async function GoalSection({
  goal,
}: {
  goal: {
    id: string,
    name?: string | null,
    indicatorParameter: string,
  }
}) {
  const locale = await getServerLocale();
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      {dict.goalSection.goal[locale]}
      <Link href={`/goal/${goal.id}`} className={styles.breadCrumb}>
        {goal.name || goal.indicatorParameter}
      </Link>
    </span>
  )
}

export async function ActionSection({
  action,
}: {
  action: {
    id: string,
    name: string,
  }
}) {
  const locale = await getServerLocale();
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      {dict.actionSection.action[locale]}
      <Link href={`/action/${action.id}`} className={styles.breadCrumb}>
        {action.name}
      </Link>
    </span>
  )
}