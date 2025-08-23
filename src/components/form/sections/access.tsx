'use client'

import { useState } from "react";
import SelectMultipleSearch from "../elements/combobox/selectMultipleSearch"
import { AccessControlled } from "@/types";
import { MetaRoadmap, Roadmap } from "@prisma/client";
import { LoginData } from "@/lib/session";
import styles from '../forms.module.css'

// TODO: Need more props for names and such + positionindex (not required?)
// TODO: Set required for viewer and editselection if custom is selected
export default function ConfigureAccess({
  user,
  userGroups,
  currentRoadmap,
  positionIndex,
}: {
  user: LoginData['user'],
  userGroups: string[],
  currentRoadmap?: MetaRoadmap & AccessControlled | Roadmap & AccessControlled & { metaRoadmap: MetaRoadmap },
  positionIndex: number,
}) {

  let currentAccess: AccessControlled | undefined = undefined;
  if (currentRoadmap) {
    currentAccess = {
      author: currentRoadmap.author,
      editors: currentRoadmap.editors,
      viewers: currentRoadmap.viewers,
      editGroups: currentRoadmap.editGroups,
      viewGroups: currentRoadmap.viewGroups,
      isPublic: currentRoadmap.isPublic,
    }
  }

  const [visibilityType, setvisibilityType] = useState<"private" | "public" | "custom">(
    currentAccess
      ? (currentAccess.isPublic
        ? "public"
        : (currentAccess.viewers.length > 0 || currentAccess.viewGroups.length > 0
          ? "custom"
          : "private"))
      : "private"
  );

  const [editabilityType, setEditabilityType] = useState<"private" | "custom" | undefined>(
    currentAccess ? (currentAccess.editors.length > 0 || currentAccess.editGroups.length > 0 ? "custom" : "private") : "private"
  );

  return (
    <>
      {(!currentRoadmap || user?.isAdmin || user?.id === currentRoadmap.authorId) &&
        // TODO: Disabled / placeholder need to be more discernable 
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>
            Vem får se färdplanen?
          </legend>
          <label className="flex width-fit-content margin-bottom-75 align-items-center gap-50">
            <input
              required
              type="radio"
              name="visibility"
              id="visibility-private"
              value="private"
              checked={visibilityType === "private"}
              onChange={(e) => setvisibilityType(e.target.value as any)}
            />
            Enbart jag
          </label>
          <label className="flex width-fit-content margin-block-75 align-items-center gap-50">
            <input
              type="radio"
              name="visibility"
              id="visibility-public"
              value="public"
              checked={visibilityType === "public"}
              onChange={(e) => setvisibilityType(e.target.value as any)}
            />
            Alla användare
          </label>
          <fieldset
            className=" fieldset-unset-pseudo-class"
          >
            <legend> {/* TODO: This causes repetion on a screenreader */}
              <label className="flex width-fit-content align-items-center gap-50">
                <input
                  type="radio"
                  name="visibility"
                  id="visibility-custom"
                  value="custom"
                  checked={visibilityType === "custom"}
                  onChange={(e) => setvisibilityType(e.target.value as any)}
                />
                Specifika användare och grupper
              </label>
            </legend>
            <div
              className="grid margin-block-100 gap-50 align-items-center"
              style={{
                paddingLeft: 'calc(14px + .5rem)', // Width of radio button + gap (aligns with above text)
                gridTemplateColumns: 'auto 1fr',
                gridTemplateRows: 'auto auto',
                columnGap: '1rem'
              }}
            >
              <label htmlFor="viewers">Användare:</label>
              <input
                id="viewers"
                name="viewers"
                className="flex-grow-100"
                placeholder="användare 1, användare 2, användare 3..."
                disabled={visibilityType !== "custom"}
                type="text"
                autoComplete="off"
                defaultValue={currentAccess?.viewers.map((viewer) => viewer.username)}
              />
              <label htmlFor="viewer-groups" className="block width-fit-content">Grupper:</label>
              <SelectMultipleSearch // TODO: Something needs to indicate that this is a multiselect :), TODO: Populate from default value
                props={{
                  id: "viewer-groups",
                  name: "viewer-groups",
                  placeholder: "Välj grupper",
                  disabled: visibilityType !== "custom",
                }}
                defaultValue={currentAccess?.viewGroups.map((group) => { return { name: group.name, value: group.name } })}
                options={[
                  ...(userGroups?.map(group => ({
                    name: group,
                    value: group
                  })) ?? []),
                  /* Do we need this in options?
                  ...(currentAccess?.viewGroups?.map(group => ({
                    name: group.name,
                    value: group.name
                  })) ?? [])
                */
                ]}
              />
            </div>
          </fieldset>
        </fieldset>
      }

      {(!currentRoadmap || user?.isAdmin || user?.id === currentRoadmap.authorId) &&
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>
            Vem får redigera färdplanen?
          </legend>
          <label className="flex width-fit-content  align-items-center gap-50  margin-bottom-75">
            <input
              required
              type="radio"
              name="editability"
              id="editability-private"
              value="private"
              checked={editabilityType === "private"}
              onChange={(e) => setEditabilityType(e.target.value as any)}
            />
            Enbart jag
          </label>
          <fieldset
            className=" fieldset-unset-pseudo-class"
          >
            <legend> {/* TODO: This causes repetion on a screenreader */}
              <label className="flex width-fit-content align-items-center gap-50">
                <input
                  type="radio"
                  name="editability"
                  id="editability-custom"
                  value="custom"
                  checked={editabilityType === "custom"}
                  onChange={(e) => setEditabilityType(e.target.value as any)}
                />
                Specifika användare och grupper
              </label>
            </legend>
            <div
              className="grid margin-block-100 gap-50 align-items-center"
              style={{
                paddingLeft: 'calc(14px + .5rem)', // Width of radio button + gap (aligns with above text)
                gridTemplateColumns: 'auto 1fr',
                gridTemplateRows: 'auto auto',
                columnGap: '1rem'
              }}>

              <label htmlFor="editors" className="block width-fit-content">Användare:</label>
              <input
                type="text"
                autoComplete="off"
                id="editors"
                name="editors"
                placeholder="användare 1, användare 2, användare 3..."
                disabled={editabilityType !== "custom"}
                defaultValue={currentAccess?.editors.map((editor) => editor.username)}
              />
              <label htmlFor="editor-groups" className="block width-fit-content">Grupper:</label>
              <SelectMultipleSearch // TODO: Something needs to indicate that this is a multiselect :), TODO: Populate from default value
                props={{
                  id: "editor-groups",
                  name: "editor-groups",
                  placeholder: "Välj grupper",
                  disabled: editabilityType !== "custom",
                }}
                defaultValue={currentAccess?.editGroups.map((group) => { return { name: group.name, value: group.name } })}
                options={[
                  ...(userGroups?.map(group => ({
                    name: group,
                    value: group
                  })) ?? []),
                  /* Do we need this in options?
                  ...(currentAccess?.viewGroups?.map(group => ({
                    name: group.name,
                    value: group.name
                  })) ?? [])
                */
                ]}
              />
            </div>
          </fieldset>
        </fieldset>
      }
    </>
  )
}