import styles from './breadcrumbs.module.css' with { type: "css" };
import Link from 'next/link';
import Image from "next/image";

export function BreadcrumbChevron() {
  return (
    <Image src='/icons/chevronRight.svg' alt='' height={16} width={16} />
  )
}

export function BaseSection() {
  return (
    <span className='display-flex align-items-center gap-25'>
      <Link href='/' className={styles.breadCrumb}>
        Hem
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
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      Färdplansserie:
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
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      Version:
      <Link href={`/roadmap/${roadmap.id}`} className={styles.breadCrumb}>
        Version {roadmap.version}
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
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      Målbana:
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
  return (
    <span className={`display-flex align-items-center gap-25 ${styles.breadCrumbTitle}`}>
      Åtgärd:
      <Link href={`/action/${action.id}`} className={styles.breadCrumb}>
        {action.name}
      </Link>
    </span>
  )
}