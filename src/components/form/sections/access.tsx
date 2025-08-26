'use client'

import { useRef, useState } from "react";
import SelectMultipleSearch from "../elements/combobox/selectMultipleSearch"
import { AccessControlled } from "@/types";
import { MetaRoadmap, Roadmap } from "@prisma/client";
import { LoginData } from "@/lib/session";
import styles from '../forms.module.css'
import { useTranslation } from "react-i18next";
 
// TODO: Need default values for viewers, editors and their groups
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
  const { t } = useTranslation(["forms"]);

  const [viewers, setViewers] = useState<string>()
  const [viewerGroups, setViewerGroups] = useState<Array<{name: string, value: string}>>()
  const [editors, setEditors] = useState<string>()
  const [EditorGroups, setEditorGroups] = useState<Array<{name: string, value: string}>>()
 
  const accessSectionRef = useRef<HTMLDivElement>(null);

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

  const [visibilityType, setvisibilityType] = useState<"private" | "public" | "custom" | undefined>(
    currentAccess
      ? (currentAccess.isPublic
        ? "public"
        : (currentAccess.viewers.length > 0 || currentAccess.viewGroups.length > 0
          ? "custom"
          : "private"))
      : undefined
  );

  const [editabilityType, setEditabilityType] = useState<"private" | "custom" | undefined>(
    currentAccess ? (currentAccess.editors.length > 0 || currentAccess.editGroups.length > 0 ? "custom" : "private") : undefined
  );
 
  // TODO: For fieldset legends i need to discern between roadmap and roadmapseries
  return (
    <div ref={accessSectionRef}>
      {(!currentRoadmap || user?.isAdmin || user?.id === currentRoadmap.authorId) &&
        // TODO: Disabled / placeholder need to be more discernable 
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>
            {t("forms:access_selector.legend_visibility")}
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
            {t("forms:access_selector.me_only")}
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
            {t("forms:access_selector.all_users")}
          </label>
          <fieldset className=" fieldset-unset-pseudo-class">
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
                {t("forms:access_selector.custom")}
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
              <label htmlFor="viewers">{`${t("forms:access_selector.users")}:`}</label>
              <input
                id="viewers"
                name="viewers"
                className="flex-grow-100"
                placeholder={t("forms:access_selector.select_users")}
                disabled={visibilityType !== "custom"}
                required={visibilityType === "custom" && (!viewerGroups || viewerGroups.length == 0)}
                type="text"
                autoComplete="off"
                defaultValue={currentAccess?.viewers.map((viewer) => viewer.username)}
                onChange={(e) => setViewers(e.target.value)}
              />
              <label htmlFor="viewer-groups" className="block width-fit-content">{`${t("forms:access_selector.groups")}:`}</label>
              <SelectMultipleSearch 
                onChange={(option) => setViewerGroups(option ? option : [])}
                props={{
                  id: "viewer-groups",
                  name: "viewer-groups",
                  placeholder: t("forms:access_selector.select_groups"),
                  disabled: visibilityType !== "custom",
                  required: visibilityType === "custom" && !viewers
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
            {t("forms:access_selector.legend_editability")}
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
            {t("forms:access_selector.me_only")}
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
                {t("forms:access_selector.custom")}
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

              <label htmlFor="editors" className="block width-fit-content">{`${t("forms:access_selector.users")}:`}</label>
              <input
                type="text"
                autoComplete="off"
                id="editors"
                name="editors"
                placeholder={t("forms:access_selector.select_users")}
                disabled={editabilityType !== "custom"}
                required={editabilityType === "custom" && (!EditorGroups || EditorGroups.length == 0)}
                defaultValue={currentAccess?.editors.map((editor) => editor.username)}
                onChange={(e) => setEditors(e.target.value)}
              />
              <label htmlFor="editor-groups" className="block width-fit-content">{`${t("forms:access_selector.groups")}:`}</label>
              <SelectMultipleSearch
                onChange={(option) => setEditorGroups(option ? option : [])}
                props={{
                  id: "editor-groups",
                  name: "editor-groups",
                  placeholder: t("forms:access_selector.select_groups"),
                  disabled: editabilityType !== "custom",
                  required: editabilityType === "custom" && !editors
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
    </div>
  )
}