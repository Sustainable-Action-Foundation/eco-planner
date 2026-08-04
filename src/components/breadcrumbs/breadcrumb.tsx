import { ActionSection, BaseSection, BreadcrumbChevron, CustomSection, GoalSection, RoadmapIterationSection, RoadmapSection } from "@/components/breadcrumbs/breadcrumbSections";

type SimpleRoadmap = {
  id: string,
  name: string,

  version?: never,
  indicator_parameter?: never,
  roadmap?: never,
  roadmap_iteration?: never,
}

type SimpleIteration = {
  id: string,
  version: number,
  roadmap: SimpleRoadmap,

  name?: never,
  indicator_parameter?: never,
  roadmap_iteration?: never,
}

type SimpleGoal = {
  id: string,
  name?: string | null,
  indicator_parameter: string,
  roadmap_iteration: SimpleIteration,

  version?: never,
  roadmap?: never,
  fields?: never,
}

type SimpleAction = {
  id: string,
  name: string,
  // Roadmapless actions (the public action database) have no iteration
  roadmap_iteration: SimpleIteration | null,
  // Both goals and actions have an indicator parameter; the fields list tells them apart
  indicator_parameter?: string,
  fields: object[],

  version?: never,
  roadmap?: never,
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
  object?: SimpleRoadmap | SimpleIteration | SimpleGoal | SimpleAction,
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
            );
          } else {
            return (
              <CustomSection {...section} key={`breadcrumb-${index}`} />
            );
          }
        })}

        {children}
      </BreadcrumbSection>
    </nav>
  );
}

/**
 * Recursive breadcrumb section, calls itself until it reaches the top level (the roadmap)
 */
function BreadcrumbSection({
  object,
  children,
}: {
  object?: SimpleRoadmap | SimpleIteration | SimpleGoal | SimpleAction,
  children?: React.ReactNode,
}) {
  if (!object) return (children);

  // Goals and actions hang off an iteration; iterations hang off a roadmap.
  // Roadmapless actions (roadmap_iteration === null) render directly under the base.
  if (object.roadmap_iteration || object.roadmap) {
    return <BreadcrumbSection object={object.roadmap_iteration ?? object.roadmap}>
        <BreadcrumbChevron />

        { // Use appropriate section based on the object type
          "roadmap_iteration" in object && object.roadmap_iteration ? (
            // Actions also carry an indicator parameter, so discriminate by their fields list
            "fields" in object && object.fields ? (
              <ActionSection action={object} />
            ) : (
              <GoalSection goal={object} />
            )
          ) : (
            <RoadmapIterationSection iteration={object as SimpleIteration} />
          )
        }

        {children}
      </BreadcrumbSection>;
  } else if ("version" in object && typeof object.version === "number") {
    // An iteration whose roadmap wasn't included; shouldn't normally happen
    return <>
      <BreadcrumbChevron />
      <RoadmapIterationSection iteration={object as SimpleIteration} />
      {children}
    </>;
  } else if ("indicator_parameter" in object && typeof object.indicator_parameter === "string" && !("fields" in object && object.fields)) {
    // Goals always have an iteration, but guard anyway
    return <>
      <BreadcrumbChevron />
      <GoalSection goal={object as SimpleGoal} />
      {children}
    </>;
  } else if (object.roadmap_iteration === null) {
    // Roadmapless action
    return <>
      <BreadcrumbChevron />
      <ActionSection action={object} />
      {children}
    </>;
  } else {
    return <>
      <BreadcrumbChevron />

      <RoadmapSection roadmap={object as SimpleRoadmap} />

      {children}
    </>;
  }
}
