'use client'

import countiesAndMunicipalities from "@/lib/countiesAndMunicipalities.json" with { type: "json" }
import { LoginData } from "@/lib/session";
import { AccessControlled, MetaRoadmapInput } from "@/types";
import { MetaRoadmap, RoadmapType } from "@prisma/client";
import { useEffect, useState } from "react";
import { EditUsers, ViewUsers, getAccessData } from "@/components/forms/accessSelector/accessSelector";
import { getLinks } from "@/components/forms/linkInput/linkInput"
import formSubmitter from "@/functions/formSubmitter";
import styles from '../forms.module.css'
import { useTranslation } from "react-i18next";
import SuggestiveText from "../formElements/suggestiveText";
import TextEditor from "@/components/generic/textEditor/textEditor";
import { SelectMultipleSearch, SelectSingleSearch } from "../formElements/select";

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

    const { editUsers, viewUsers, editGroups, viewGroups } = getAccessData(
      form.namedItem("editUsers"),
      form.namedItem("viewUsers"),
      form.namedItem("editGroups"),
      form.namedItem("viewGroups")
    );

    const formData: MetaRoadmapInput & { id?: string, timestamp?: number } = {
      name: (form.namedItem("metaRoadmapName") as HTMLInputElement)?.value,
      description: JSON.stringify(editorContent),
      type: ((form.namedItem("type") as HTMLSelectElement)?.value as RoadmapType) || null,
      actor: (form.namedItem("actor") as HTMLInputElement)?.value || null,
      editors: editUsers,
      viewers: viewUsers,
      editGroups,
      viewGroups,
      isPublic: (form.namedItem("isPublic") as HTMLInputElement)?.checked || false,
      links,
      parentRoadmapId: (form.namedItem("parentRoadmap") as HTMLButtonElement)?.value || undefined,
      id: currentRoadmap?.id || undefined,
      timestamp,
    };

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
  const [accessType, setAccessType] = useState<"isPrivate" | "isPublic" | "selectGroups">( // TODO: Check that this makes sense
    currentAccess?.isPublic ? "isPublic" : "isPrivate"
  );

  const [editGroups, setEditGroups] = useState<"private" | "selectGroups">("private");// TODO: Get this from params or something...

  // Indexes for the data-position attribute in the legend elements
  let positionIndex = 1;

  return (
    <>
      <form onSubmit={handleSubmit} >
        {/* This hidden submit button prevents submitting by pressing enter, this avoids accidental submission when adding new entries in AccessSelector (for example, when pressing enter to add someone to the list of editors) */}
        <input type="submit" disabled={true} className="display-none" aria-hidden={true} />

        <fieldset className={`${styles.timeLineFieldset} width-100`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold`}>{t("forms:meta_roadmap.description_legend")}</legend>
          <label className="block margin-block-100">
            {t("forms:meta_roadmap.roadmap_series_name")}
            <input id="metaRoadmapName" name="metaRoadmapName" className="margin-block-25" type="text" defaultValue={currentRoadmap?.name ?? undefined} autoComplete="off" required />
          </label>

          <div className="margin-block-100">
            <div className="margin-bottom-25" id="roadmap-series-description">{t("forms:meta_roadmap.roadmap_series_description")}</div>
            <TextEditor
              id="roadmap-series-description-editor"
              ariaLabelledBy="roadmap-series-description"
              placeholder="Skriv något..."
              onChange={(json) => setEditorContent(json)}
            />
          </div>

        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:meta_roadmap.actor_legend")}</legend>
          <label className="block margin-bottom-100">
            {t("forms:meta_roadmap.roadmap_scope_label")}
            <select
              className="block margin-block-25"
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

          <div className="margin-block-100" style={{ width: 'min(250px, 100%)' }}>
            <label htmlFor="actor">{t("forms:meta_roadmap.choose_actor")}</label>
            <SuggestiveText
              className="margin-top-25"
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
          </div>
        </fieldset>

        {(!currentRoadmap || user?.isAdmin || user?.id === currentRoadmap.authorId) &&
          <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:meta_roadmap.change_read_access")}</legend>
            {/* TODO: Validate this on the server :) */}
            {/* TODO: Radio button values should be submittable (altough they might not be submitted) */}
            {/* TODO: 
              Selecting: "isPrivate" submits false for "isPublic" and empty strings for viewgroups and viewers
              Selecting: "isPublic" submits true for "isPublic" and empty strings for viewgroups and viewers
              Selecting: "selectGroups" submits False for "isPublic" and array<string> for viewgroups and viewers
            */}
            <label className="display-flex align-items-center gap-50 margin-block-50">
              <input
                required
                type="radio"
                name="isPublic"
                id="isPrivate"
                value="isPrivate"
                checked={accessType === "isPrivate"}
                onChange={(e) => setAccessType(e.target.value as any)}
              />
              Privat
            </label>
            <label className="display-flex align-items-center gap-50 margin-block-50">
              <input
                type="radio"
                name="isPublic"
                id="isPublic"
                value="isPublic"
                checked={accessType === "isPublic"}
                onChange={(e) => setAccessType(e.target.value as any)}
              />
              Offentlig
            </label>
            <label className="display-flex align-items-center gap-50 margin-block-50">
              <input
                type="radio"
                name="isPublic"
                id="selectGroups"
                value="selectGroups"
                checked={accessType === "selectGroups"}
                onChange={(e) => setAccessType(e.target.value as any)}
              />
              Välj
            </label>
            <label htmlFor="test-multiple-search">Grupper</label>
            <SelectMultipleSearch // TODO: Something needs to indicate that this is a multiselect :) 
              id="test-multiple-search"
              name="test-multiple-search"
              searchBoxLabel="sök..."
              searchBoxPlaceholder="sök..."
              placeholder="Välj grupper"
              disabled={accessType !== "selectGroups"}
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
            <label htmlFor="test-suggestive-text">Användare</label>
            <SuggestiveText
              id="test-suggestive-text"
              name="test-suggestive-text"
              placeholder="användare"
              disabled={accessType !== "selectGroups"}
              suggestiveList={[]}
            />
          </fieldset>
        }

        {(!currentRoadmap || user?.isAdmin || user?.id === currentRoadmap.authorId) &&
          <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:meta_roadmap.change_edit_access")}</legend>
            {/* TODO: Radio button values should be submittable (altough they might not be submitted) */}
            {/* TODO: 
              Selecting: "private" submits empty strings for editgroups and editors
              Selecting: "selectGroups" submits array<string> for viewgroups and viewers
            */} 
            <label className="display-flex align-items-center gap-50 margin-block-50">
              <input
                required
                type="radio"
                name="editGroups"
                id="editPrivate"
                value="private"
                checked={editGroups === "private"}
                onChange={(e) => setEditGroups(e.target.value as any)}
              />
              Enbart jag
            </label>
            <label className="display-flex align-items-center gap-50 margin-block-50">
              <input
                type="radio"
                name="editGroups"
                id="selectGroups"
                value="selectGroups"
                checked={editGroups === "selectGroups"}
                onChange={(e) => setEditGroups(e.target.value as any)}
              />
              Välj
            </label>
            <label htmlFor="test-multiple-search-2">Grupper</label>
            <SelectMultipleSearch // TODO: Something needs to indicate that this is a multiselect :) 
              id="test-multiple-search-2"
              name="test-multiple-search-2"
              searchBoxLabel="sök..."
              searchBoxPlaceholder="sök..."
              placeholder="Välj grupper"
              disabled={editGroups !== "selectGroups"}
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
            <label htmlFor="test-suggestive-text-2">Användare</label>
            <SuggestiveText
              id="test-suggestive-text-2"
              name="test-suggestive-text-2"
              placeholder="användare"
              disabled={editGroups !== "selectGroups"}
              suggestiveList={[]}
            />
          </fieldset>
        }

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:meta_roadmap.relationship_legend")}</legend>
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
            className="text-align-center seagreen color-purewhite block width-100"
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