'use client'

import countiesAndMunicipalities from "@/lib/countiesAndMunicipalities.json" with { type: "json" }
import { LoginData } from "@/lib/session";
import { AccessControlled, MetaRoadmapInput } from "@/types";
import { MetaRoadmap, RoadmapType } from "@prisma/client";
import { useEffect, useState } from "react";
import { getLinks } from "@/components/form/elements/linkInput/linkInput"
import formSubmitter from "@/functions/formSubmitter";
import styles from '../forms.module.css'
import { useTranslation } from "react-i18next";
import SuggestiveText from "../elements/suggestiveText";
import TextEditor from "@/components/form/elements/textEditor/textEditor";
import { SelectMultipleSearch, SelectSingleSearch } from "../elements/select";

/* TODO: Check usage of autocomplete both here and for other forms */
/* TODO: Ensure everything is validated properly on the server */
/* TODO: kebab-case */
export default function MetaRoadmapForm({
  user,
  userGroups,
  parentRoadmapOptions,
  currentRoadmap,
}: {
  user: LoginData['user'],
  userGroups: string[],
  parentRoadmapOptions?: MetaRoadmap[],
  currentRoadmap?: MetaRoadmap & AccessControlled,
}) {
  const { t } = useTranslation(["forms", "common"]);
  const [editorContent, setEditorContent] = useState<any>(null);

  async function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    // Mostly the usual submit handler stuff.
    // We might want to redirect the user to the roadmap form immediately after successfully submitting the metaRoadmap form
    // (and pre-populate the roadmap form with the new metaRoadmap's ID)
    event.preventDefault();
    // Prevent double submission
    if (isLoading) return;
    setIsLoading(true);

    const form = event.target.elements;

    const links = getLinks(event.target);
    
    const visibility = (form.namedItem("visibility") as RadioNodeList)?.value;
    const editability = (form.namedItem("editability") as RadioNodeList)?.value;

    const formData: MetaRoadmapInput & { id?: string, timestamp?: number } = {
      name: (form.namedItem("metaRoadmapName") as HTMLInputElement)?.value,
      description: JSON.stringify(editorContent),
      type: ((form.namedItem("type") as HTMLSelectElement)?.value as RoadmapType) || null,
      actor: (form.namedItem("actor") as HTMLInputElement)?.value || null,
      editors: editability === "custom" ? (form.namedItem("editors") as HTMLInputElement)?.value.split(',').map(string => string.trim()).filter(Boolean) : [],
      viewers: visibility === "custom" ? (form.namedItem("viewers") as HTMLInputElement)?.value.split(",").map(s => s.trim()).filter(Boolean) : [],
      editGroups: editability === "custom" ? (form.namedItem("editor-groups") as HTMLButtonElement)?.value.split(',').filter(Boolean) : [],
      viewGroups:  visibility === "custom" ? (form.namedItem("viewer-groups") as HTMLInputElement)?.value.split(",").filter(Boolean) : [],
      isPublic: (form.namedItem("visibility") as RadioNodeList)?.value === "public",
      links,
      parentRoadmapId: (form.namedItem("parentRoadmap") as HTMLButtonElement)?.value || undefined,
      id: currentRoadmap?.id || undefined,
      timestamp,
    };

    console.log(formData)

    const formJSON = JSON.stringify(formData);

    formSubmitter('/api/metaRoadmap', formJSON, currentRoadmap ? 'PUT' : 'POST', setIsLoading);
  }

  const [isLoading, setIsLoading] = useState<boolean>(false)

  const timestamp = Date.now()

  const customRoadmapTypes = {
    [RoadmapType.NATIONAL]: t("common:scope.national"),
    [RoadmapType.REGIONAL]: t("common:scope.regional"),
    [RoadmapType.MUNICIPAL]: t("common:scope.municipal"),
    [RoadmapType.LOCAL]: t("common:scope.local"),
    [RoadmapType.OTHER]: t("common:scope.other"),
  }
  const [roadmapType, setRoadmapType] = useState<string>("");
  useEffect(() => {
    console.log(roadmapType)
  }, [roadmapType])

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
  const [accessType, setAccessType] = useState<"private" | "public" | "custom">( // TODO: This also needs to check for viewgroups/viewers to see if we should set custom
    currentAccess?.isPublic ? "public" : "private"
  );

  const [editGroups, setEditGroups] = useState<"private" | "custom">("private");// TODO: Get this from params or something...

  // Indexes for the data-position attribute in the legend elements
  let positionIndex = 1;

  return (
    <>
      <form onSubmit={handleSubmit} >
        {/* This hidden submit button prevents submitting by pressing enter, this avoids accidental submission when adding new entries in AccessSelector (for example, when pressing enter to add someone to the list of editors) */}
        <input type="submit" disabled={true} className="display-none" aria-hidden={true} />

        <fieldset className={`${styles.timeLineFieldset} width-100`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:meta_roadmap.description_legend")}</legend>
          <label>
            {t("forms:meta_roadmap.roadmap_series_name")}
            <input id="metaRoadmapName" name="metaRoadmapName" className="margin-top-25 margin-bottom-100" type="text" defaultValue={currentRoadmap?.name ?? undefined} autoComplete="off" required />
          </label>

          <label className="margin-bottom-25" id="roadmap-series-description">{t("forms:meta_roadmap.roadmap_series_description")}</label>
          <TextEditor
            className="margin-top-25 margin-bottom-100" // TODO: Need label for menu
            id="roadmap-series-description-editor"
            ariaLabelledBy="roadmap-series-description"
            placeholder="Skriv något..."
            onChange={(json) => setEditorContent(json)}
          />
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:meta_roadmap.actor_legend")}</legend>
          <label>
            {t("forms:meta_roadmap.roadmap_scope_label")}
            <select
              className="block margin-top-25 margin-bottom-100 width-100"
              name="type"
              id="type"
              defaultValue={currentRoadmap?.type ?? ""}
              required
              onChange={(e) => setRoadmapType((e.target as HTMLSelectElement).value)}
            >
              <option value="">{t("forms:meta_roadmap.no_chosen_roadmap_scope")}</option>
              {
                Object.values(RoadmapType).map((value) => {
                  if (value == RoadmapType.NATIONAL && !user?.isAdmin) return null;
                  return (
                    <option key={value} value={value}>{value in customRoadmapTypes ? customRoadmapTypes[value] : value}</option>
                  )
                })
              }
            </select>
          </label>

          <label htmlFor="actor">{t("forms:meta_roadmap.choose_actor")}</label>
          <SuggestiveText // TODO: For accesibility purposed must act as a regular textinput given an empty array has been passed
            className="margin-top-25 margin-bottom-100"
            id="actor"
            name="actor"
            required={false}
            defaultValue={currentRoadmap?.actor ?? undefined}
            suggestiveList={
              roadmapType == "REGIONAL"
                ? Object.keys(countiesAndMunicipalities)
                : roadmapType == "MUNICIPAL"
                  ? Object.values(countiesAndMunicipalities).flat()
                  : []
            }
          />
        </fieldset>

        {(!currentRoadmap || user?.isAdmin || user?.id === currentRoadmap.authorId) &&
          <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>
              Vem får se din färdplan?
            </legend>
            {/* TODO: Validate this on the server :) */}
            {/* TODO: Radio button values should be submittable (altough they might not be submitted) */}
            {/* TODO: 
              Selecting: "isPrivate" submits false for "isPublic" and empty strings for viewgroups and viewers
              Selecting: "isPublic" submits true for "isPublic" and empty strings for viewgroups and viewers
              Selecting: "selectGroups" submits False for "isPublic" and array<string> for viewgroups and viewers
            */}
            <label className="flex width-fit-content margin-bottom-75 align-items-center gap-50">
              <input
                required
                type="radio"
                name="visibility"
                id="isPrivate"
                value="private"
                checked={accessType === "private"}
                onChange={(e) => setAccessType(e.target.value as any)}
              />
              Enbart jag
            </label>
            <label className="flex width-fit-content margin-block-75 align-items-center gap-50">
              <input
                type="radio"
                name="visibility"
                id="isPublic"
                value="public"
                checked={accessType === "public"}
                onChange={(e) => setAccessType(e.target.value as any)}
              />
              Alla användare
            </label>
            <fieldset
              className=" fieldset-unset-pseudo-class"
            >
              <legend> {/* TODO: This causes repition on a screenreader */}
                <label className="flex width-fit-content align-items-center gap-50">
                  <input
                    type="radio"
                    name="visibility"
                    id="selectGroups"
                    value="custom"
                    checked={accessType === "custom"}
                    onChange={(e) => setAccessType(e.target.value as any)}
                  />
                  Särskilda användare och grupper
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
                  disabled={accessType !== "custom"} 
                  type="text"
                />
                <label htmlFor="viewer-groups" className="block width-fit-content">Grupper:</label>
                {/* TODO: Disabled should be indicated by cursor */}
                <SelectMultipleSearch // TODO: Something needs to indicate that this is a multiselect :) 
                  id="viewer-groups"
                  name="viewer-groups"
                  searchBoxLabel="sök..."
                  searchBoxPlaceholder="sök..."
                  placeholder="Välj grupper"
                  disabled={accessType !== "custom"}
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
              Vem får redigera din färdplan?
            </legend>
            {/* TODO: Radio button values should be submittable (altough they might not be submitted) */}
            {/* TODO: 
              Selecting: "private" submits empty strings for editgroups and editors
              Selecting: "selectGroups" submits array<string> for viewgroups and viewers
            */}
            <label className="flex width-fit-content  align-items-center gap-50  margin-bottom-75">
              <input
                required
                type="radio"
                name="editability"
                id="editPrivate"
                value="private"
                checked={editGroups === "private"}
                onChange={(e) => setEditGroups(e.target.value as any)}
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
                    id="selectGroups"
                    value="custom"
                    checked={editGroups === "custom"}
                    onChange={(e) => setEditGroups(e.target.value as any)}
                  />
                  Särskilda användare och grupper
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
                  id="editors"
                  name="editors"
                  placeholder="användare 1, användare 2, användare 3..."
                  disabled={editGroups !== "custom"}
                />
                <label htmlFor="editor-groups" className="block width-fit-content">Grupper:</label>
                <SelectMultipleSearch // TODO: Something needs to indicate that this is a multiselect :) 
                  id="editor-groups"
                  name="editor-groups"
                  searchBoxLabel="sök..."
                  searchBoxPlaceholder="sök..."
                  placeholder="Välj grupper"
                  disabled={editGroups !== "custom"}
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

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:meta_roadmap.relationship_legend")}</legend>
          <label id="parent-roadmap-label" htmlFor="parent-roadmap">{t("forms:meta_roadmap.relationship_label")}</label>
          {parentRoadmapOptions ? (
            <SelectSingleSearch
              className="margin-top-25"
              id="parentRoadmap"
              name="parentRoadmap"
              placeholder="välj..."
              searchBoxLabel="Sök..." // TODO: i18n
              searchBoxPlaceholder="Sök..." // TODO: i18n
              defaultValue={{ name: t("forms:meta_roadmap.relationship_no_chosen"), value: "" }} // TODO: Set actual default value :)
              options={[
                { name: t("forms:meta_roadmap.relationship_no_chosen"), value: "" },
                ...parentRoadmapOptions.map((metaRoadmap) => ({
                  name: metaRoadmap.name,
                  value: metaRoadmap.id
                }))
              ]}
            />
          ) : null}
        </fieldset>

        {/* Add copy of RoadmapForm? Only if we decide to include it immediately rather than redirecting to it */}
        <div className="margin-top-400 padding-top-100 margin-bottom-100" style={{ borderTop: '1px solid var(--gray-80)' }}>
          <button
            className="text-align-center seagreen color-purewhite width-100"
            style={{ fontSize: '14px', transform: 'none' }}
            type="submit"
            id="submit-button"
          >
            {currentRoadmap ? t("common:tsx.save") : t("common:tsx.create") + ' färdplansserie'} {/* TODO: i18n  */}
          </button>
        </div>
      </form>
    </>
  )
}