'use client'

import { useMemo, useRef, useState } from "react";
import SelectMultipleSearch from "../elements/combobox/selectMultipleSearch"
import type { AccessControlled } from "@/types";
import type { MetaRoadmap, Roadmap } from "@prisma/client";
import type { LoginData } from "@/lib/session";
import styles from '../forms.module.css'
import { useTranslation } from "react-i18next";

export default function ConfigureAccess({
  user,
  userGroups,
  currentRoadmap,
  positionIndex,
  legends,
}: {
  user: LoginData['user'],
  userGroups: string[],
  currentRoadmap?: MetaRoadmap & AccessControlled | Roadmap & AccessControlled & { metaRoadmap: MetaRoadmap },
  positionIndex: number,
  legends: { viewers: string, editors: string }
}) {
  const { t } = useTranslation(["forms"]);

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

  const [viewers, setViewers] = useState<string>(currentAccess ? currentAccess.viewers.map((viewer) => viewer.username).join(', ') : '') // TODO: This has NOT been tested with multiple usernames, ensure it gives back exactly what the user initially wrote
  const [viewerGroups, setViewerGroups] = useState<Array<{ name: string, value: string }>>(currentAccess ? currentAccess?.viewGroups.map((group) => { return { name: group.name, value: group.name } }) : [])
  const [editors, setEditors] = useState<string>(currentAccess ? currentAccess?.editors.map((editor) => editor.username).join(', ') : '') // TODO: This has NOT been tested with multiple usernames, ensure it gives back exactly what the user initially wrote
  const [editorGroups, setEditorGroups] = useState<Array<{ name: string, value: string }>>(currentAccess ? currentAccess?.editGroups.map((group) => { return { name: group.name, value: group.name } }) : [])

  const [visibilityType, setVisibilityType] = useState<"private" | "public" | "custom" | undefined>(
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

  const selectableGroups = useMemo(() => {
    return [
      ...(userGroups?.map(group => ({
        name: group,
        value: group
      })) ?? [])
      /* Do we need this in options?
        ...(currentAccess?.viewGroups?.map(group => ({
          name: group.name,
          value: group.name
        })) ?? [])
      */
    ];
  }, [userGroups]);

  return (
    <div ref={accessSectionRef}>
      {(
        !currentRoadmap
        || user?.id === currentRoadmap.authorId
        || user?.isAdmin
      ) && // TODO: Check that this is correct or if we need another one for meta roadmap
        // TODO: Disabled / placeholder need to be more discernable 
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>
            {legends.viewers}
          </legend>
          <label className="flex width-fit-content margin-bottom-75 align-items-center gap-50">
            <input
              required
              type="radio"
              name="visibility"
              id="visibility-private"
              value="private"
              checked={visibilityType === "private"}
              onChange={() => setVisibilityType("private")}
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
              onChange={() => setVisibilityType("public")}
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
                  onChange={() => setVisibilityType("custom")}
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
                defaultValue={viewers}
                onChange={(e) => setViewers(e.target.value)}
              />
              <label htmlFor="viewer-groups" className="block width-fit-content">{`${t("forms:access_selector.groups")}:`}</label>
              <SelectMultipleSearch
                onChange={(option) => setViewerGroups(option ?? [])}
                props={{
                  id: "viewer-groups",
                  name: "viewer-groups",
                  placeholder: t("forms:access_selector.select_groups"),
                  disabled: visibilityType !== "custom",
                  required: visibilityType === "custom" && !viewers
                }}
                defaultValue={viewerGroups}
                options={selectableGroups}
              />
            </div>
          </fieldset>
        </fieldset>
      }

      {((!currentRoadmap || user?.isAdmin) ?? user?.id === currentRoadmap.authorId) && // TODO: Check that this is correct or if we need another one for meta roadmap
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>
            {legends.editors}
          </legend>
          <label className="flex width-fit-content  align-items-center gap-50  margin-bottom-75">
            <input
              required
              type="radio"
              name="editability"
              id="editability-private"
              value="private"
              checked={editabilityType === "private"}
              onChange={() => setEditabilityType("private")}
            />
            {t("forms:access_selector.me_only")}
          </label>
          <fieldset
            className=" fieldset-unset-pseudo-class"
          >
            <legend> {/* TODO: This causes repetition on a screen reader */}
              <label className="flex width-fit-content align-items-center gap-50">
                <input
                  type="radio"
                  name="editability"
                  id="editability-custom"
                  value="custom"
                  checked={editabilityType === "custom"}
                  onChange={() => setEditabilityType("custom")}
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
                required={editabilityType === "custom" && (!editorGroups || editorGroups.length == 0)}
                defaultValue={editors}
                onChange={(e) => setEditors(e.target.value)}
              />
              <label htmlFor="editor-groups" className="block width-fit-content">{`${t("forms:access_selector.groups")}:`}</label>
              <SelectMultipleSearch
                onChange={(option) => setEditorGroups(option ?? [])}
                props={{
                  id: "editor-groups",
                  name: "editor-groups",
                  placeholder: t("forms:access_selector.select_groups"),
                  disabled: editabilityType !== "custom",
                  required: editabilityType === "custom" && !editors
                }}
                defaultValue={editorGroups}
                options={selectableGroups}
              />
            </div>
          </fieldset>
        </fieldset>
      }
    </div>
  )
}