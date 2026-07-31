'use client';

import styles from './controls.module.css' with { type: "css" };
import Link from "next/link";
import React, { useRef, useState } from "react";
import type { Action, Effect, Goal, GoalUpdateInput, Roadmap, RoadmapIteration } from "@/types";
import { AccessLevel, GoalDataTarget } from "@/types/enums";
import ConfirmDelete from "@/components/modals/confirmDelete";
import { openModal } from "@/components/modals/modalFunctions";
import { useTranslation } from "react-i18next";
import { IconArrowBackUp, IconChartHistogram, IconDotsVertical, IconEdit, IconPlus, IconStar, IconStarFilled, IconTrashXFilled, IconX } from "@tabler/icons-react";
import { hasAdminAccess, hasEditAccess } from '@/lib/accessChecker';
import type { TFunction } from 'i18next';
import formSubmitter from '@/functions/formSubmitter';
import { iterationPath } from '@/functions/versionSlug';

/*
  TODO:
  This file was renamed from the previous "TableMenu" as it has long served as a menu outside of tables.
  The chosen name, "controls", may be too generic. We likely want to split the ControlsMenu and AdminPanel
  into separate components at some point to clarify
*/
/* TODO: Add an info bubble to the admin panel to clear some space? */

type ActionMenuEntry = Pick<Action, "id" | "name" | "roadmap_iteration_id"> & {
  // Optional: call sites without it (e.g. tables on the iteration page itself) just lose the parent link
  roadmap_iteration?: Pick<RoadmapIteration, "roadmap_id" | "version"> | null;
};

type GoalMenuEntry = Pick<Goal, "id" | "name" | "indicator_parameter" | "roadmap_iteration_id"> & {
  roadmap_iteration: Pick<RoadmapIteration, "id" | "version"> & { roadmap: Pick<Roadmap, "id" | "name"> };
};

type IterationMenuEntry = Pick<RoadmapIteration, "id" | "version"> & {
  roadmap: Pick<Roadmap, "id" | "name">;
  _count?: { goals: number };
};

type RoadmapMenuEntry = Pick<Roadmap, "id" | "name"> & {
  iterations: Array<Pick<RoadmapIteration, "id" | "version"> & { _count: { goals: number } }>;
};

export type EffectMenuEntry = Pick<Effect, "action_id" | "goal_id"> & {
  action?: ActionMenuEntry;
  goal?: GoalMenuEntry;
  name?: string;
  id?: { actionId: string; goalId: string };
};

type ObjectParameter = EffectMenuEntry | ActionMenuEntry | GoalMenuEntry | IterationMenuEntry | RoadmapMenuEntry;

/**
 * Both actions and goals carry `indicator_parameter` and `roadmap_iteration_id` at runtime,
 * so actions are recognized by columns/relations only they have. Full action rows always
 * carry `start_year`/`org_id` (possibly null); narrower selections carry `fields`.
 */
function isActionEntry(object: ObjectParameter): object is ActionMenuEntry {
  return "start_year" in object || "org_id" in object || "fields" in object;
}

type links = {
  featureGoal?: string,
  selfLink?: string;
  parentLink?: string;
  parentDescription?: string;
  creationLink?: string;
  creationDescription?: string;
  creationLink2?: string;
  creationDescription2?: string;
  editLink?: string;
  historicalDataLink?: string;
  deleteLink?: string;
};

/* TODO: This implemantation seems dumb probably */
function buildLinks(
  object: ObjectParameter,
  t: TFunction,
): links | null {

  let featureGoal: string | undefined;
  let selfLink: string | undefined;
  let parentLink: string | undefined;
  let parentDescription: string | undefined;
  let creationLink: string | undefined;
  let creationDescription: string | undefined;
  let creationLink2: string | undefined;
  let creationDescription2: string | undefined;
  let editLink: string | undefined;
  let historicalDataLink: string | undefined;
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

  // Actions (checked before goals: actions also carry an indicator_parameter,
  // so goals can only be recognized by it once action shapes are ruled out)
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
  else if ("indicator_parameter" in object) {
    featureGoal = "/api/goal"; /* TODO: Update this line */
    selfLink = `/goal/${object.id}`;
    parentLink = object.roadmap_iteration ? iterationPath(object.roadmap_iteration.roadmap.id, object.roadmap_iteration.version) : undefined;
    parentDescription = t("components:table_menu.go_to_version");
    creationLink = `/action/create?iterationId=${object.roadmap_iteration_id}&goalId=${object.id}`;
    creationDescription = t("components:table_menu.new_action");
    creationLink2 = `/effect/create?goalId=${object.id}`;
    creationDescription2 = t("components:table_menu.add_effect_from_existing_action");
    editLink = `/goal/${object.id}/edit`;
    historicalDataLink = `/goal/${object.id}/historical-data`;
    deleteLink = "/api/goal";

    object.name ||= object.indicator_parameter;
  }

  else {
    console.error("ControlsMenu/AdminPanel: Object type not recognized", object);
    return null;
  }

  return {
    featureGoal,
    selfLink,
    parentLink,
    parentDescription,
    creationLink,
    creationDescription,
    creationLink2,
    creationDescription2,
    editLink,
    historicalDataLink,
    deleteLink,
  };
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
              <IconArrowBackUp aria-hidden="true" style={{ minWidth: '24px' }} /> {/* TODO: Probably dont want this anymore, should however make it available elsewhere before removing */}
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
                {links.historicalDataLink ? <Link href={links.historicalDataLink} className={styles.menuAction}>
                  <span>{t("components:table_menu.edit")}</span> {/* TODO: Switch text here */}
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
  const historicalDeletionRef = useRef<HTMLDialogElement | null>(null);

  const objectName = getObjectName(object);
  const roadmapName = getRoadmapName(object);
  const [timestamp] = useState(() => Date.now());

  const formContent = {
    target: GoalDataTarget.Full,
    goalId: (object as Goal).id,
    timestamp: timestamp, // Only needed for edits

    name: undefined,
    description: undefined,
    indicatorParameter: undefined,
    isFeatured: undefined,
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
  } satisfies GoalUpdateInput;


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
              <>
                {links.featureGoal ? <button
                  type="button"
                  className={`flex gap-50 justify-content-space-between align-items-center smooth neutral-action ${styles['object-menu-link']}`}
                  style={{ boxShadow: 'none', cursor: 'pointer', fontSize: '14px', transform: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    const updatedForm = {
                      ...formContent,
                      isFeatured: !(object as Goal).is_featured,
                    };

                    formSubmitter('/api/goal', JSON.stringify(updatedForm), 'PUT', t);
                  }}
                >
                  {(object as Goal).is_featured ? (
                    <>
                      <span className='margin-right-25'>{t("components:table_menu.feature_goal_stop")}</span>
                      <IconStarFilled fill='darkorange' aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
                    </>
                  ) : (
                    <>
                      <span className='margin-right-25'>{t("components:table_menu.feature_goal")}</span>
                      <IconStar aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
                    </>
                  )}
                </button>
                  : null}
                <nav className="display-contents">
                  {links.historicalDataLink ? // TODO: Clean up css and translations below
                    <>
                      <button
                        type="button"
                        popoverTarget='historical-data-popover'
                        style={{ anchorName: '--historical-data-anchor', transform: 'scale(1)', boxShadow: 'none' }}
                        className={`flex gap-50 justify-content-space-between align-items-center smooth neutral-action font-size-14px ${styles['object-menu-link']}`}
                      >
                        <span>{t("components:table_menu.historical_data")}</span>
                        <IconChartHistogram aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
                      </button>

                      <div
                        popover='auto'
                        id='historical-data-popover'
                        className='smooth margin-0 position-fixed'
                        style={{
                          backgroundColor: 'var(--secondary-neutral)',
                          positionAnchor: '--historical-data-anchor',
                          top: 'anchor(bottom)',
                          left: 'anchor(left)',
                          marginTop: '.25rem',
                          padding: '2px',
                          width: 'anchor-size(width)',
                          boxShadow: 'rgba(0, 0, 0, 0.05) 0px 0px 0px 1px',
                        }}
                      >
                        <Link
                          className={`flex gap-50 justify-content-space-between align-items-center smooth neutral-action width-100 ${styles['object-menu-link']}`}
                          href={links.historicalDataLink}
                          data-testid="historical-data-link"
                        >
                          {!(object as Goal).historical ? (
                            <>
                              {t("components:table_menu.historical_data_add")}
                              <IconPlus aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
                            </>
                          ) : (
                            <>
                              {t("components:table_menu.historical_data_edit")}
                              <IconEdit aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
                            </>
                          )}
                        </Link>
                        {(object as Goal).historical ? (
                          <>
                            <button
                              className={`flex gap-50 justify-content-space-between align-items-center button smooth width-100 font-size-14px ${styles['object-menu-button']}`}
                              style={{ marginTop: '2px', textShadow: 'none', color: 'white', backgroundColor: "#f03b3b", border: '0', transform: 'none' }}
                              type="button"
                              onClick={() => historicalDeletionRef.current?.showModal()}
                            >
                              {t("components:table_menu.historical_data_delete")}
                              <IconTrashXFilled aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
                            </button>
                            <dialog
                              closedby='any'
                              ref={historicalDeletionRef}
                              className={`rounded padding-inline-0 padding-block-0 dialog`}
                              style={{ width: 'min(75ch, 100%)', height: 'calc(-2rem + 50vh)', fontSize: 'initial' }}
                            >
                              <div className='dialog-content'>
                                <div className='dialog-header'>
                                  <button type="button" className="grid round padding-50 transparent" onClick={() => historicalDeletionRef.current?.close()} autoFocus={true} aria-label={t("common:tsx.close")} >
                                    <IconX aria-hidden="true" width={28} height={28} strokeWidth={3} style={{ minWidth: '28px' }} />
                                  </button>
                                  <h2 className='margin-0'>{t("components:table_menu.historical_data_delete")}????</h2>
                                </div>
                                <form
                                  className='dialog-body'
                                  onSubmit={(e: React.SubmitEvent) => {
                                    e.preventDefault();

                                    // Clear only the historical section, leaving the rest of the goal untouched.
                                    formSubmitter('/api/goal', JSON.stringify({
                                      target: GoalDataTarget.Historical,
                                      goalId: (object as Goal).id,
                                      timestamp: timestamp,
                                      historicalId: null,
                                      historical: null,
                                      historicalRecipeId: null,
                                      historicalRecipe: null,
                                    } satisfies GoalUpdateInput), 'PUT', t);
                                  }}
                                >
                                <div className="flex-grow-100">
                                  <p className="margin-0" >
                                    {t("components:confirm_delete.confirmation")}
                                  </p>
                                  <label className="block margin-block-75">
                                    {t("components:confirm_delete.type_to_confirm")}
                                    <input className="margin-block-25" type="text" required={true} pattern={`${t("components:table_menu.historical_data")}`} />
                                  </label>
                                </div>
                                <div className="flex gap-25">
                                  <button type="button" className="font-weight-500 flex-grow-100" onClick={() => historicalDeletionRef.current?.close()}>{t("common:tsx.cancel")}</button>
                                  <button
                                    type='submit'
                                    className="color-purewhite red font-weight-500"
                                  >
                                    {t("components:table_menu.historical_data_delete")}
                                  </button>
                                </div>
                              </form>
                            </div>
                          </dialog>
                      </>
                        ) : null}
                    </div>
                </>
                : null
                  }
                {links.creationLink ? <Link href={links.creationLink} className={`flex gap-50 justify-content-space-between align-items-center smooth neutral-action ${styles['object-menu-link']}`}>
                  <span>{links.creationDescription}</span>
                  <IconPlus aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
                </Link> : null
                }
                {links.creationLink2 ? <Link href={links.creationLink2} className={`flex gap-50 justify-content-space-between align-items-center smooth neutral-action ${styles['object-menu-link']}`} data-testid="admin-panel-new-action">
                  <span>{links.creationDescription2 || links.creationLink2}</span>
                  <IconPlus aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
                </Link> : null
                }
                {links.editLink ? <Link href={links.editLink} className={`flex gap-50 justify-content-space-between align-items-center smooth neutral-action ${styles['object-menu-link']}`} data-testid="admin-panel-edit">
                  <span>{t("components:table_menu.edit")}</span>
                  <IconEdit aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
                </Link> : null
                }
              </nav>
          </>
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
