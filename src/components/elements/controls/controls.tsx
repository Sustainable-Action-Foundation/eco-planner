'use client';

import styles from './controls.module.css' with { type: "css" };
import Link from "next/link";
import React, { useRef, useState } from "react";
import type { Action, Effect, Goal, GoalUpdateInput, Roadmap, RoadmapIteration, RoadmapIterationUpdateInput } from "@/types";
import { AccessLevel, GoalDataTarget, GoalVisibility } from "@/types/enums";
import ConfirmDelete from "@/components/modals/confirmDelete";
import { openModal } from "@/components/modals/modalFunctions";
import { useTranslation } from "react-i18next";
import { IconArrowBackUp, IconChartHistogram, IconCheck, IconChevronDown, IconDotsVertical, IconEdit, IconEye, IconEyeOff, IconPlus, IconStar, IconTrashXFilled, IconX } from "@tabler/icons-react";
import { hasAdminAccess, hasEditAccess } from '@/lib/accessChecker';
import type { TFunction } from 'i18next';
import formSubmitter from '@/functions/formSubmitter';
import { iterationPath } from '@/functions/versionSlug';
import { goalVisibilityFromFlags, goalVisibilityToFlags } from '@/functions/goalVisibility';

/*
  TODO:
  This file was renamed from the previous "TableMenu" as it has long served as a menu outside of tables.
  The chosen name, "controls", may be too generic. We likely want to split the ControlsMenu and AdminPanel
  into separate components at some point to clarify
*/
/* TODO: Add an info bubble to the admin panel to clear some space? */

// `org_id` doubles as the runtime discriminator (see isActionEntry): among the
// menu entities only actions have it, and requiring it here means type-checked
// call sites can't pass an action the sniffing would misrecognize.
type ActionMenuEntry = Pick<Action, "id" | "name" | "org_id" | "roadmap_iteration_id"> & {
  // Optional: call sites without it (e.g. tables on the iteration page itself) just lose the parent link
  roadmap_iteration?: Pick<RoadmapIteration, "roadmap_id" | "version"> | null;
};

type GoalMenuEntry = Pick<Goal, "id" | "name" | "indicator_parameter" | "roadmap_iteration_id"> & {
  roadmap_iteration: Pick<RoadmapIteration, "id" | "version"> & { roadmap: Pick<Roadmap, "id" | "name"> };
  // Read by AdminPanel's goal-only features; optional so leaner goal rows still fit the menu shape
  is_featured?: Goal["is_featured"];
  is_unlisted?: Goal["is_unlisted"];
  historical?: Goal["historical"];
};

type IterationMenuEntry = Pick<RoadmapIteration, "id" | "version"> & {
  roadmap: Pick<Roadmap, "id" | "name">;
  _count?: { goals: number };
  // Read by AdminPanel's unlisting toggle; optional so leaner iteration rows still fit the menu shape
  is_unlisted?: RoadmapIteration["is_unlisted"];
};

type RoadmapMenuEntry = Pick<Roadmap, "id" | "name"> & {
  iterations: Array<Pick<RoadmapIteration, "id" | "version"> & { _count: { goals: number } }>;
};

export type EffectMenuEntry = Pick<Effect, "action_id" | "goal_id"> & {
  // Only the name is read off the embedded action, so effect queries needn't select org_id
  action?: Pick<Action, "id" | "name">;
  goal?: GoalMenuEntry;
  name?: string;
  id?: { actionId: string; goalId: string };
};

type ObjectParameter = EffectMenuEntry | ActionMenuEntry | GoalMenuEntry | IterationMenuEntry | RoadmapMenuEntry;

/**
 * Both actions and goals carry `indicator_parameter` and `roadmap_iteration_id` at runtime,
 * so actions are recognized by `org_id`, a column no other menu entity has. Since
 * `ActionMenuEntry` requires it, type-checked call sites can't pass an action that
 * misses this check.
 */
function isActionEntry(object: ObjectParameter): object is ActionMenuEntry {
  return "org_id" in object;
}

/** Goals are whatever carries an `indicator_parameter` once action shapes are ruled out (see {@link isActionEntry}). */
function isGoalEntry(object: ObjectParameter): object is GoalMenuEntry {
  return !isActionEntry(object) && "indicator_parameter" in object;
}

type links = {
  selfLink?: string;
  parentLink?: string;
  parentDescription?: string;
  creationLink?: string;
  creationDescription?: string;
  creationLink2?: string;
  creationDescription2?: string;
  editLink?: string;
  /** Goals only: the focused section forms, as alternatives to the full edit form */
  dataSeriesEditLink?: string;
  baselineEditLink?: string;
  historicalDataLink?: string;
  historicalCreateLink?: string;
  deleteLink?: string;
};

/* TODO: This implementation seems dumb probably */
function buildLinks(
  object: ObjectParameter,
  t: TFunction,
): links | null {

  let selfLink: string | undefined;
  let parentLink: string | undefined;
  let parentDescription: string | undefined;
  let creationLink: string | undefined;
  let creationDescription: string | undefined;
  let creationLink2: string | undefined;
  let creationDescription2: string | undefined;
  let editLink: string | undefined;
  let dataSeriesEditLink: string | undefined;
  let baselineEditLink: string | undefined;
  let historicalDataLink: string | undefined;
  let historicalCreateLink: string | undefined;
  let deleteLink: string | undefined;

  // Roadmaps (top level)
  if ("iterations" in object) {
    selfLink = `/roadmap/${object.id}`;
    creationLink = `/roadmap/${object.id}/iteration/create`;
    creationDescription = t("components:table_menu.new_roadmap_version");
    editLink = `/roadmap/${object.id}/edit`;
    deleteLink = "/api/roadmap";
  }

  // Roadmap iterations
  else if ("roadmap" in object) {
    selfLink = iterationPath(object.roadmap.id, object.version);
    parentLink = `/roadmap/${object.roadmap.id}`;
    parentDescription = t("components:table_menu.go_to_series");
    creationLink = `/goal/create?iterationId=${object.id}`;
    creationDescription = t("components:table_menu.new_goal");
    creationLink2 = `/action/create?iterationId=${object.id}`;
    creationDescription2 = t("components:table_menu.new_action");
    editLink = `${iterationPath(object.roadmap.id, object.version)}/edit`;
    deleteLink = "/api/roadmap-iteration";
  }

  // Effects
  else if ("action_id" in object) {
    selfLink = `/action/${object.action_id}`;
    parentLink = `/goal/${object.goal_id}`;
    parentDescription = t("components:table_menu.go_to_goal");
    editLink = `/effect/${object.action_id}/${object.goal_id}/edit`;
    deleteLink = "/api/effect";

    object.name ||= object.action?.name
      ? t("components:table_menu.effect_from_action", { source: object.action.name })
      : object.goal
        ? (object.goal.name ?? object.goal.indicator_parameter)
        : t("components:table_menu.effect_missing_name");

    object.id ??= { actionId: object.action_id, goalId: object.goal_id };
  }

  // Actions
  else if (isActionEntry(object)) {
    selfLink = `/action/${object.id}`;
    parentLink = object.roadmap_iteration ? iterationPath(object.roadmap_iteration.roadmap_id, object.roadmap_iteration.version) : undefined;
    parentDescription = t("components:table_menu.go_to_version");
    creationLink = `/effect/create?actionId=${object.id}`;
    creationDescription = t("components:table_menu.new_effect");
    editLink = `/action/${object.id}/edit`;
    deleteLink = "/api/action";
  }

  // Goals
  else if (isGoalEntry(object)) {
    selfLink = `/goal/${object.id}`;
    parentLink = object.roadmap_iteration ? iterationPath(object.roadmap_iteration.roadmap.id, object.roadmap_iteration.version) : undefined;
    parentDescription = t("components:table_menu.go_to_version");
    creationLink = `/action/create?iterationId=${object.roadmap_iteration_id}&goalId=${object.id}`;
    creationDescription = t("components:table_menu.new_action");
    creationLink2 = `/effect/create?goalId=${object.id}`;
    creationDescription2 = t("components:table_menu.add_effect_from_existing_action");
    editLink = `/goal/${object.id}/edit`;
    dataSeriesEditLink = `/goal/${object.id}/data-series/edit`;
    baselineEditLink = `/goal/${object.id}/baseline/edit`;
    historicalDataLink = `/goal/${object.id}/historical-data/edit`;
    historicalCreateLink = `/goal/${object.id}/historical-data/create`;
    deleteLink = "/api/goal";

    object.name ||= object.indicator_parameter;
  }

  else {
    console.error("ControlsMenu/AdminPanel: Object type not recognized", object);
    return null;
  }

  return {
    selfLink,
    parentLink,
    parentDescription,
    creationLink,
    creationDescription,
    creationLink2,
    creationDescription2,
    editLink,
    dataSeriesEditLink,
    baselineEditLink,
    historicalDataLink,
    historicalCreateLink,
    deleteLink,
  };
}

/** Iterations are the menu entries with a parent roadmap but no iterations of their own. */
function isIterationEntry(object: ObjectParameter): object is IterationMenuEntry {
  return "roadmap" in object && !("iterations" in object);
}

const getObjectName = (object: ObjectParameter): string | undefined => {
  if ("indicator_parameter" in object) {
    return object.name || object.indicator_parameter;
  }
  if ("name" in object && object.name) {
    return object.name;
  }
  return undefined;
};

/** The name of the (parent) roadmap, for entries that carry one */
const getRoadmapName = (object: ObjectParameter): string | undefined => {
  if ("roadmap" in object) return object.roadmap?.name;
  if ("indicator_parameter" in object) return object.roadmap_iteration?.roadmap?.name;
  if ("iterations" in object) return object.name;
  return undefined;
};

/**
 * Deletion is a content edit for goals/actions/effects/iterations, but roadmap
 * deletion (taking all iterations with it) is manager-only. The server enforces
 * the fine print (e.g. published iterations); this only decides what to show.
 */
const mayShowDelete = (object: ObjectParameter, accessLevel: AccessLevel): boolean => {
  if ("iterations" in object) return hasAdminAccess(accessLevel);
  return hasEditAccess(accessLevel);
};

/**
 * General purpose button for roadmaps, goals and actions.
 */
export function ControlsMenu(
  {
    width = 24,
    height = 24,
    buttonText,
    accessLevel,
    object,
  }: {
    width?: number,
    height?: number,
    buttonText?: string
    accessLevel?: AccessLevel,
    object: ObjectParameter,
  }) {
  const { t } = useTranslation(["components", "common"]);

  const menu = useRef<HTMLDialogElement | null>(null);
  const deletionRef = useRef<HTMLDialogElement | null>(null);

  const links = buildLinks(object, t);
  const objectName = getObjectName(object);
  const roadmapName = getRoadmapName(object);

  const openMenu = () => {
    menu.current?.show();
  };

  const closeMenu = (e: React.FocusEvent<HTMLDialogElement> | React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLDialogElement>) => {
    // Don't close if focus stays within menu
    if (e.type === 'blur') {
      e = e as React.FocusEvent<HTMLDialogElement>;
      if (menu.current?.contains(e.relatedTarget as Node) || menu.current === e.relatedTarget) {
        return;
      }
    }
    // Don't close if non-escape key is pressed
    if ("key" in e && e.key !== 'Escape' && e.key !== 'Esc') {
      return;
    }
    menu.current?.close();
    // Close children as well
    deletionRef.current?.close();
  };

  return (
    <div className={`${styles.actionButton} display-flex`}>
      <button type="button" onClick={openMenu} className={styles.button} aria-label={t("components:table_menu.button_aria", { component: objectName || roadmapName || t("components:table_menu.button_aria_alt") })}> {/* TODO: Remove this aria if we pass buttontext */}
        {buttonText || null}
        <IconDotsVertical aria-hidden="true" width={width} height={height} />
      </button>
      <dialog className={styles.menu} id={`${typeof object.id === "string" ? object.id : object.id?.actionId + "-" + object.id?.goalId}-menu`} onBlur={closeMenu} ref={menu} onKeyUp={closeMenu}>
        <div className={`display-flex flex-direction-row-reverse align-items-center justify-content-space-between ${styles.menuHeading}`}>
          {/* Button to close menu */}
          <button type="button" aria-label={t("common:tsx.close")} onClick={closeMenu} className={styles.button} autoFocus={true} >
            <IconX aria-hidden="true" width={18} height={18} strokeWidth={3} style={{ minWidth: '18px' }} />
          </button>
          {/* Link to the object */}
          {links?.selfLink ?
            <Link href={links.selfLink} className={styles.menuHeadingTitle}>{objectName || roadmapName}</Link>
            : <p>{t("common:tsx.menu")}</p>}
        </div>
        {links ? (
          <>
            {links.parentLink ? <Link href={links.parentLink} className={styles.menuAction}>
              <span>{links.parentDescription || links.parentLink}</span>
              <IconArrowBackUp aria-hidden="true" style={{ minWidth: '24px' }} /> {/* TODO: Probably don't want this anymore, should however make it available elsewhere before removing */}
            </Link> : null
            }
            {hasEditAccess(accessLevel ?? AccessLevel.None) ?
              <>
                {links.creationLink ? <Link href={links.creationLink} className={styles.menuAction}>
                  <span>{links.creationDescription}</span>
                  <IconPlus aria-hidden="true" style={{ minWidth: '24px' }} />
                </Link> : null
                }
                {links.creationLink2 ? <Link href={links.creationLink2} className={styles.menuAction}>
                  <span>{links.creationDescription2 || links.creationLink2}</span>
                  <IconPlus aria-hidden="true" style={{ minWidth: '24px' }} />
                </Link> : null
                }
                {links.editLink ? <Link href={links.editLink} className={styles.menuAction}>
                  <span>{t("components:table_menu.edit")}</span>
                  <IconEdit aria-hidden="true" style={{ minWidth: '24px' }} />
                </Link> : null
                }
                {links.historicalDataLink && links.historicalCreateLink ? <Link
                  // Rows that don't carry the historical series get the edit form, which also accepts a first entry
                  href={isGoalEntry(object) && object.historical === null ? links.historicalCreateLink : links.historicalDataLink}
                  className={styles.menuAction}
                >
                  <span>{t("components:table_menu.historical_data")}</span>
                  <IconChartHistogram aria-hidden="true" style={{ minWidth: '24px' }} />
                </Link> : null
                }
                {
                  mayShowDelete(object, accessLevel ?? AccessLevel.None) && links.deleteLink ? <>
                    <button type="button" className="width-100 transparent display-flex align-items-center justify-content-space-between padding-50" style={{ fontSize: '1rem' }} data-testid="delete-post" onClick={() => openModal(deletionRef)}>
                      {t("components:table_menu.delete")}
                      <IconTrashXFilled aria-hidden="true" fill="red" style={{ minWidth: '24px' }} />
                    </button>
                    <ConfirmDelete modalRef={deletionRef} targetUrl={links.deleteLink} targetName={objectName || roadmapName || t("components:table_menu.delete_missing_name")} targetId={object.id} />
                  </> : null
                }
              </>
              : null
            }
          </>
        ) : (
          <p>{t("components:table_menu.no_available_actions")}</p>
        )}
      </dialog>
    </div>
  );
}


const panelItemClass = `flex gap-50 justify-content-space-between align-items-center smooth neutral-action font-size-14px ${styles['object-menu-link']}`;

/**
 * A panel button that opens a small anchored list of links below itself.
 * The list is a native popover, so it closes on outside clicks and Escape.
 */
function PanelDropdown({
  id,
  label,
  icon,
  children,
  testId,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}) {
  const popoverId = `${id}-popover`;
  const anchorName = `--${id}-anchor`;
  return (
    <>
      <button
        type="button"
        popoverTarget={popoverId}
        style={{ anchorName, transform: 'scale(1)', boxShadow: 'none' }}
        className={panelItemClass}
        data-testid={testId}
      >
        <span className="flex gap-25 align-items-center">
          {icon}
          {label}
        </span>
        <IconChevronDown aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
      </button>
      <div
        popover='auto'
        id={popoverId}
        className={`smooth margin-0 position-fixed ${styles['panel-dropdown']}`}
        style={{
          backgroundColor: 'var(--secondary-neutral)',
          positionAnchor: anchorName,
          top: 'anchor(bottom)',
          left: 'anchor(left)',
          marginTop: '.25rem',
          padding: '2px',
          minWidth: 'anchor-size(width)',
          boxShadow: 'rgba(0, 0, 0, 0.05) 0px 0px 0px 1px',
        }}
      >
        {children}
      </div>
    </>
  );
}

/** The goal-specific panel: listing state as one select, plus the add/edit menus. */
function GoalPanelControls({
  goal,
  links,
  timestamp,
}: {
  goal: GoalMenuEntry;
  links: links;
  timestamp: number;
}) {
  const { t } = useTranslation(["components", "common"]);

  const visibility = goalVisibilityFromFlags({ is_featured: !!goal.is_featured, is_unlisted: !!goal.is_unlisted });
  // Inline record so every key stays a literal inside t()
  const visibilityLabels: Record<GoalVisibility, string> = {
    [GoalVisibility.Public]: t("components:table_menu.visibility_public"),
    [GoalVisibility.Unlisted]: t("components:table_menu.visibility_unlisted"),
    [GoalVisibility.Featured]: t("components:table_menu.visibility_featured"),
  };
  const visibilityIcons: Record<GoalVisibility, React.ReactNode> = {
    [GoalVisibility.Public]: <IconEye aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />,
    [GoalVisibility.Unlisted]: <IconEyeOff aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />,
    [GoalVisibility.Featured]: <IconStar aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />,
  };

  return (
    <>
      {/* Listing state, when the row carries the flags to derive it from */}
      {goal.is_featured !== undefined && goal.is_unlisted !== undefined ?
        <PanelDropdown
          id="admin-panel-visibility"
          label={t("components:table_menu.visibility_current", { state: visibilityLabels[visibility] })}
          icon={visibilityIcons[visibility]}
          testId="admin-panel-visibility"
        >
          {(Object.values(GoalVisibility)).map((option) => (
            <button
              key={option}
              type="button"
              className={panelItemClass}
              style={{ boxShadow: 'none', cursor: 'pointer', transform: 'none', whiteSpace: 'nowrap' }}
              aria-pressed={option === visibility}
              data-testid={`admin-panel-visibility-${option.toLowerCase()}`}
              onClick={(e) => {
                e.currentTarget.closest<HTMLElement>('[popover]')?.hidePopover();
                if (option === visibility) return;
                // Full-target update touching only the listing flags; everything undefined is left unchanged
                formSubmitter('/api/goal', JSON.stringify({
                  target: GoalDataTarget.Full,
                  goalId: goal.id,
                  timestamp: timestamp, // Only needed for edits
                  ...goalVisibilityToFlags(option),

                  name: undefined,
                  description: undefined,
                  indicatorParameter: undefined,
                  recipeSuggestions: undefined,

                  dataSeriesId: undefined,
                  dataSeries: undefined,
                  dataSeriesRecipeId: undefined,
                  dataSeriesRecipe: undefined,

                  baselineId: undefined,
                  baseline: undefined,
                  baselineRecipeId: undefined,
                  baselineRecipe: undefined,

                  historicalId: undefined,
                  historical: undefined,
                  historicalRecipeId: undefined,
                  historicalRecipe: undefined,

                  iterationId: undefined, // Can't reassign the roadmap iteration of an existing goal
                  rawTags: undefined, // TODO: add tags input
                } satisfies GoalUpdateInput), 'PUT', t);
              }}
            >
              <span className="flex gap-25 align-items-center">
                {visibilityIcons[option]}
                {visibilityLabels[option]}
              </span>
              {option === visibility
                ? <IconCheck aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
                : <span aria-hidden="true" style={{ minWidth: '20px' }} />}
            </button>
          ))}
        </PanelDropdown>
        : null}

      <nav className="display-contents">
        <PanelDropdown
          id="admin-panel-add"
          label={t("components:table_menu.add")}
          icon={<IconPlus aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />}
          testId="admin-panel-add-menu"
        >
          {/* Historical data is added once; editing it lives under the edit menu */}
          {links.historicalCreateLink && !goal.historical ? <Link href={links.historicalCreateLink} className={panelItemClass} data-testid="historical-data-link">
            <span>{t("components:table_menu.historical_data")}</span>
            <IconChartHistogram aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
          </Link> : null}
          {links.creationLink2 ? <Link href={links.creationLink2} className={panelItemClass} data-testid="admin-panel-new-effect">
            <span>{t("components:table_menu.add_menu_effect")}</span>
            <IconPlus aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
          </Link> : null}
          {links.creationLink ? <Link href={links.creationLink} className={panelItemClass} data-testid="admin-panel-new-action">
            <span>{t("components:table_menu.add_menu_action")}</span>
            <IconPlus aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
          </Link> : null}
        </PanelDropdown>

        <PanelDropdown
          id="admin-panel-edit"
          label={t("components:table_menu.edit")}
          icon={<IconEdit aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />}
          testId="admin-panel-edit-menu"
        >
          {links.editLink ? <Link href={links.editLink} className={panelItemClass} data-testid="admin-panel-edit">
            <span>{t("components:table_menu.edit_whole")}</span>
            <IconEdit aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
          </Link> : null}
          {links.dataSeriesEditLink ? <Link href={links.dataSeriesEditLink} className={panelItemClass} data-testid="admin-panel-edit-data-series">
            <span>{t("components:table_menu.edit_data_series")}</span>
            <IconEdit aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
          </Link> : null}
          {links.baselineEditLink ? <Link href={links.baselineEditLink} className={panelItemClass} data-testid="admin-panel-edit-baseline">
            <span>{t("components:table_menu.edit_baseline")}</span>
            <IconEdit aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
          </Link> : null}
          {links.historicalDataLink && goal.historical ? <Link href={links.historicalDataLink} className={panelItemClass} data-testid="historical-data-link">
            <span>{t("components:table_menu.edit_historical")}</span>
            <IconChartHistogram aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
          </Link> : null}
        </PanelDropdown>
      </nav>
    </>
  );
}

/** Unlists (or lists again) a roadmap iteration straight from its panel. */
function IterationUnlistToggle({
  iteration,
  timestamp,
}: {
  iteration: IterationMenuEntry & { is_unlisted: boolean };
  timestamp: number;
}) {
  const { t } = useTranslation(["components", "common"]);

  return (
    <button
      type="button"
      className={panelItemClass}
      style={{ boxShadow: 'none', cursor: 'pointer', transform: 'none', whiteSpace: 'nowrap' }}
      data-testid="admin-panel-unlist"
      onClick={() => {
        // Touches only the listing flag; everything undefined is left unchanged
        formSubmitter('/api/roadmap-iteration', JSON.stringify({
          iterationId: iteration.id,
          timestamp: timestamp,
          isUnlisted: !iteration.is_unlisted,
          description: undefined,
          targetVersion: undefined,
          publish: undefined,
          goals: undefined,
        } satisfies RoadmapIterationUpdateInput), 'PUT', t);
      }}
    >
      {iteration.is_unlisted ? (
        <>
          <span className='margin-right-25'>{t("components:table_menu.list_iteration")}</span>
          <IconEye aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
        </>
      ) : (
        <>
          <span className='margin-right-25'>{t("components:table_menu.unlist_iteration")}</span>
          <IconEyeOff aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
        </>
      )}
    </button>
  );
}

/* TODO: This should probably use role="toolbar" (or menubar?) and then be labeled instead of having an h1 */
export function AdminPanel(
  {
    accessLevel,
    object,
  }: {
    accessLevel?: AccessLevel,
    object: ObjectParameter
  }) {
  const { t } = useTranslation(["components", "common"]);
  const links = buildLinks(object, t);
  const deletionRef = useRef<HTMLDialogElement | null>(null);

  const objectName = getObjectName(object);
  const roadmapName = getRoadmapName(object);
  const [timestamp] = useState(() => Date.now());

  // Goals get their own controls (listing select, add/edit menus); the guard also narrows for their payloads
  const goal = isGoalEntry(object) ? object : null;
  // Iterations get the unlisting toggle when the entry carries the flag
  const iteration = isIterationEntry(object) && typeof object.is_unlisted === "boolean" ? { ...object, is_unlisted: object.is_unlisted } : null;

  return (
    <aside className="margin-block-300">
      <div className='flex justify-content-space-between align-items-flex-end flex-wrap-wrap margin-bottom-50 gap-25'>
        <h1 className="font-weight-600 margin-0" style={{ fontSize: '1.25rem' }}>{t("components:table_menu.admin_panel_title")}</h1>
        <small className='font-style-italic'>{t("components:table_menu.admin_panel_info")}</small>
      </div>
      <menu className={`grid gap-50 margin-0 padding-0 padding-top-50 font-size-14px ${styles['object-menu']}`}>
        {links ? (
          <>
            {hasEditAccess(accessLevel ?? AccessLevel.None) ? (
              goal ? (
                <GoalPanelControls goal={goal} links={links} timestamp={timestamp} />
              ) : (
                <>
                  {iteration ? <IterationUnlistToggle iteration={iteration} timestamp={timestamp} /> : null}
                  <nav className="display-contents">
                    {links.creationLink ? <Link href={links.creationLink} className={panelItemClass}>
                      <span>{links.creationDescription}</span>
                      <IconPlus aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
                    </Link> : null
                    }
                    {links.creationLink2 ? <Link href={links.creationLink2} className={panelItemClass} data-testid="admin-panel-new-action">
                      <span>{links.creationDescription2 || links.creationLink2}</span>
                      <IconPlus aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
                    </Link> : null
                    }
                    {links.editLink ? <Link href={links.editLink} className={panelItemClass} data-testid="admin-panel-edit">
                      <span>{t("components:table_menu.edit")}</span>
                      <IconEdit aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
                    </Link> : null
                    }
                  </nav>
                </>
              )
            ) : null
            }
            {mayShowDelete(object, accessLevel ?? AccessLevel.None) && links.deleteLink ? <>
              <button
                type="button"
                className={`flex gap-50 justify-content-space-between align-items-center button smooth font-size-14px
                ${styles['object-menu-button']}`} style={{ textShadow: 'none', color: 'white', backgroundColor: "#f03b3b", border: '0' }}
                onClick={() => openModal(deletionRef)}
              >
                {t("components:table_menu.delete")}
                <IconTrashXFilled aria-hidden="true" width={20} height={20} fill="white" style={{ minWidth: '20px' }} />
              </button>
              <ConfirmDelete modalRef={deletionRef} targetUrl={links.deleteLink} targetName={objectName || roadmapName || t("components:table_menu.delete_missing_name")} targetId={object.id} />
            </> : null
            }
          </>
        ) : null}
      </menu>
    </aside >
  );
}
