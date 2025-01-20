'use client'

import Image from "next/image";
import styles from './tableMenu.module.css' with { type: "css" }
import Link from "next/link";
import { useRef } from "react";
import { Action, DataSeries, Effect, Goal, MetaRoadmap } from "@prisma/client";
import { AccessLevel } from "@/types";
import ConfirmDelete from "@/components/modals/confirmDelete";
import { openModal } from "@/components/modals/modalFunctions";

// General purpose button for roadmaps, goals and actions. 
// Update the name of the component to reflect this

export function TableMenu(
  {
    accessLevel,
    object,
  }: {
    accessLevel?: AccessLevel,
    object: (
      // Effect
      (Effect & {
        action?: Action,
        goal?: Goal,
        roadmapVersions?: never,
        metaRoadmap?: never,
        indicatorParameter?: never,
        isSufficiency?: never,
        // Set name and id further down
        name?: string,
        id?: { actionId: string, goalId: string },
      })
      // Action
      | (Action & {
        effects?: {
          goal: { id: string, roadmap: { id: string } },
        }[],
        roadmapVersions?: never,
        metaRoadmap?: never,
        indicatorParameter?: never,
      })
      // Goal
      | (Goal & {
        _count: { effects: number }
        dataSeries: DataSeries | null,
        roadmap: { id: string, metaRoadmap: { name: string, id: string } },
        roadmapVersions?: never,
        metaRoadmap?: never,
        goal?: never,
      })
      // Roadmap
      | ({
        id: string,
        version: number,
        _count: { goals: number },
        metaRoadmap: MetaRoadmap,
        roadmapVersions?: never,
        roadmap?: never,
        goal?: never,
        name?: never,
      })
      // MetaRoadmap
      | (MetaRoadmap & {
        roadmapVersions: { id: string, version: number, _count: { goals: number } }[],
        metaRoadmap?: never,
        roadmap?: never,
        goal?: never,
      })
    )
  }) {
  const menu = useRef<HTMLDialogElement | null>(null);
  const deletionRef = useRef<HTMLDialogElement | null>(null);

  let selfLink: string | undefined;
  let parentLink: string | undefined;
  let parentDescription: string | undefined;
  let creationLink: string | undefined;
  let creationDescription: string | undefined;
  let creationLink2: string | undefined;
  let creationDescription2: string | undefined;
  let editLink: string | undefined;
  let deleteLink: string | undefined;
  // MetaRoadmaps
  if (object.roadmapVersions != undefined) {
    selfLink = `/metaRoadmap/${object.id}`;
    creationLink = `/roadmap/create?metaRoadmapId=${object.id}`;
    creationDescription = 'Ny färdplansversion';
    editLink = `/metaRoadmap/${object.id}/edit`;
    deleteLink = "/api/metaRoadmap"
  }
  // Roadmaps
  else if (object.metaRoadmap != undefined) {
    selfLink = `/roadmap/${object.id}`
    parentLink = `/metaRoadmap/${object.metaRoadmap.id}`;
    parentDescription = 'Gå till färdplansserien';
    creationLink = `/goal/create?roadmapId=${object.id}`;
    creationDescription = 'Ny målbana';
    creationLink2 = `/action/create?roadmapId=${object.id}`;
    creationDescription2 = 'Ny åtgärd';
    editLink = `/roadmap/${object.id}/edit`;
    deleteLink = "/api/roadmap"
  }
  // Goals
  else if (object.indicatorParameter != undefined) {
    selfLink = `/goal/${object.id}`;
    parentLink = `/roadmap/${object.roadmap.id}`;
    parentDescription = 'Gå till färdplansversionen';
    creationLink = `/action/create?roadmapId=${object.roadmapId}&goalId=${object.id}`;
    creationDescription = 'Ny åtgärd';
    creationLink2 = `/effect/create?goalId=${object.id}`;
    creationDescription2 = 'Lägg till effekt från existerande åtgärd';
    editLink = `/goal/${object.id}/edit`;
    deleteLink = "/api/goal"
    if (!object.name) {
      object.name = object.indicatorParameter;
    }
  }
  // Actions
  else if (object.isSufficiency != undefined) {
    selfLink = `/action/${object.id}`;
    parentLink = `/roadmap/${object.roadmapId}`;
    parentDescription = 'Gå till färdplansversionen';
    creationLink = `/effect/create?actionId=${object.id}`;
    creationDescription = 'Ny effekt';
    editLink = `/action/${object.id}/edit`;
    deleteLink = "/api/action"
  }
  // Effects
  else if (object.actionId != undefined) {
    selfLink = `/action/${object.actionId}`;
    parentLink = `/goal/${object.goalId}`;
    parentDescription = 'Gå till målbanan';
    editLink = `/effect/edit?actionId=${object.actionId}&goalId=${object.goalId}`;
    deleteLink = '/api/effect';
    if (!object.name) {
      object.name = object.action?.name ? `Effekt från ${object.action.name}` : object.goal ? (object.goal.name || object.goal.indicatorParameter) : "Namn saknas";
    }
    if (!object.id) {
      object.id = { actionId: object.actionId, goalId: object.goalId };
    }
  }
  // Catch all
  else {
    console.log("TableMenu: Object type not recognized", object);
    return null;
  }

  const openMenu = () => {
    menu.current?.show();
  }

  const closeMenu = (e: React.FocusEvent<HTMLDialogElement> | React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLDialogElement>) => {
    // Don't close if focus stays within menu
    if (e.type === 'blur') {
      e = e as React.FocusEvent<HTMLDialogElement>
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
  }

  return (
    <>
      <div className={`${styles.actionButton} display-flex`}>
        <button type="button" onClick={openMenu} className={styles.button} aria-label={`meny för ${object.name || object.metaRoadmap?.name || "Namn saknas"}`}>
          <Image src='/icons/dotsVertical.svg' width={24} height={24} alt="meny"></Image>
        </button>
        <dialog className={styles.menu} id={`${object.id}-menu`} onBlur={closeMenu} ref={menu} onKeyUp={closeMenu}>
          <div className={`display-flex flex-direction-row-reverse align-items-center justify-content-space-between ${styles.menuHeading}`}>
            {/* Button to close menu */}
            <button type="button" onClick={closeMenu} className={styles.button} autoFocus >
              <Image src='/icons/close.svg' alt="stäng" width={18} height={18} />
            </button>
            {/* Link to the object */}
            <Link href={selfLink} className={styles.menuHeadingTitle}>{object.name || object.metaRoadmap?.name}</Link>
          </div>
          {parentLink &&
            <Link href={parentLink} className={styles.menuAction}>
              <span>{parentDescription || parentLink}</span>
              <Image src='/icons/back.svg' alt="" width={24} height={24} className={styles.actionImage} />
            </Link>
          }
          {[AccessLevel.Admin, AccessLevel.Author, AccessLevel.Edit].includes(accessLevel ?? AccessLevel.None) ?
            <>
              {creationLink &&
                <Link href={creationLink} className={styles.menuAction}>
                  <span>{creationDescription}</span>
                  <Image src='/icons/plus-light.svg' alt="" width={24} height={24} className={styles.actionImage} />
                </Link>
              }
              {creationLink2 &&
                <Link href={creationLink2} className={styles.menuAction}>
                  <span>{creationDescription2 || creationLink2}</span>
                  <Image src='/icons/plus-light.svg' alt="" width={24} height={24} className={styles.actionImage} />
                </Link>
              }
              <Link href={editLink} className={styles.menuAction}>
                <span>Redigera</span>
                <Image src='/icons/edit.svg' alt="" width={24} height={24} className={styles.actionImage} />
              </Link>
              { // Admins and authors can delete items
                (accessLevel === AccessLevel.Admin || accessLevel === AccessLevel.Author) &&
                <>
                  <button type="button" className="width-100 transparent display-flex align-items-center justify-content-space-between padding-50" style={{ fontSize: '1rem' }} onClick={() => openModal(deletionRef)}>
                    Radera inlägg
                    <Image src='/icons/delete.svg' alt="" width={24} height={24} className={styles.actionImage} />
                  </button>
                  <ConfirmDelete modalRef={deletionRef} targetUrl={deleteLink} targetName={object.name || object.metaRoadmap?.name || "Namn saknas"} targetId={object.id} />
                </>
              }
            </>
            : null
          }
        </dialog>
      </div>
    </>
  )
}