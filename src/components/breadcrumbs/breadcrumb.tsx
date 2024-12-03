import { ActionSection, BaseSection, BreadcrumbChevron, CustomSection, GoalSection, MetaRoadmapSection, RoadmapSection } from "@/components/breadcrumbs/breadcrumbSections";

type SimpleMetaRoadmap = {
  id: string,
  name: string,

  version?: never,
  indicatorParameter?: never,
  roadmap?: never,
  metaRoadmap?: never,
}

type SimpleRoadmap = {
  id: string,
  version: number,
  metaRoadmap: SimpleMetaRoadmap,

  name?: never,
  indicatorParameter?: never,
  roadmap?: never,
}

type SimpleGoal = {
  id: string,
  name?: string | null,
  indicatorParameter: string,
  roadmap: SimpleRoadmap,

  version?: never,
  metaRoadmap?: never,
}

type SimpleAction = {
  id: string,
  name: string,
  roadmap: SimpleRoadmap,

  version?: never,
  indicatorParameter?: never,
  metaRoadmap?: never,
}

/**
 * Breadcrumb component, used to display a breadcrumb trail for a given object
 * 
 * Each item in customSections is appended to the end, before any children, in the order they are provided
 */
export function Breadcrumb({
  object,
  customSections,
  children,
}: {
  object?: SimpleMetaRoadmap | SimpleRoadmap | SimpleGoal | SimpleAction,
  customSections?: (string | { title?: string, link?: string, linkText?: string })[],
  children?: React.ReactNode,
}) {
  return (
    <nav className="display-flex align-items-center gap-25 flex-wrap-wrap">
      <BaseSection />

      <BreadcrumbSection object={object}>
        {customSections?.map((section, index) => {
          if (typeof section === 'string') {
            return (
              <CustomSection title={section} key={`breadcrumb-${index}`} />
            )
          } else {
            return (
              <CustomSection {...section} key={`breadcrumb-${index}`} />
            )
          }
        })}

        {children}
      </BreadcrumbSection>
    </nav>
  )
}

/**
 * Recursive breadcrumb section, calls itself until it reaches the top level (metaRoadmap)
 */
function BreadcrumbSection({
  object,
  children,
}: {
  object?: SimpleMetaRoadmap | SimpleRoadmap | SimpleGoal | SimpleAction,
  children?: React.ReactNode,
}) {
  if (!object) return (children);

  if (object.roadmap || object.metaRoadmap) {
    return <>
      <BreadcrumbSection object={object.roadmap || object.metaRoadmap}>
        <BreadcrumbChevron />

        { // Use appropriate section based on the object type
          object.roadmap ? (
            typeof object.indicatorParameter === 'string' ? (
              <GoalSection goal={object} />
            ) : (
              <ActionSection action={object} />
            )
          ) : (
            <RoadmapSection roadmap={object} />
          )
        }

        {children}
      </BreadcrumbSection>
    </>
  } else {
    return <>
      <BreadcrumbChevron />

      <MetaRoadmapSection metaRoadmap={object} />

      {children}
    </>
  }
}