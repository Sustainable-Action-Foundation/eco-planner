'use client'

import countiesAndMunicipalities from "@/lib/countiesAndMunicipalities.json" with { type: "json" }
import { LoginData } from "@/lib/session";
import { AccessControlled, MetaRoadmapInput } from "@/types";
import { MetaRoadmap, RoadmapType } from "@prisma/client";
import { useState } from "react";
import { EditUsers, ViewUsers, getAccessData } from "@/components/forms/accessSelector/accessSelector";
import LinkInput, { getLinks } from "@/components/forms/linkInput/linkInput"
import formSubmitter from "@/functions/formSubmitter";
import styles from '../forms.module.css'
import { useTranslation } from "react-i18next";
import SuggestiveText from "../formElements/suggestiveText";
import TextEditor from "@/components/generic/textEditor/textEditor";

/* TODO: Check usage of autocomplete both here and for other forms */
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
      description: (form.namedItem("description") as HTMLTextAreaElement)?.value,
      type: ((form.namedItem("type") as HTMLSelectElement)?.value as RoadmapType) || null,
      actor: (form.namedItem("actor") as HTMLInputElement)?.value || null,
      editors: editUsers,
      viewers: viewUsers,
      editGroups,
      viewGroups,
      isPublic: (form.namedItem("isPublic") as HTMLInputElement)?.checked || false,
      links,
      parentRoadmapId: (form.namedItem("parentRoadmap") as HTMLSelectElement)?.value || undefined,
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
            <input id="metaRoadmapName" name="metaRoadmapName" className="margin-block-25" type="text" defaultValue={currentRoadmap?.name ?? undefined} required />
          </label>

          {/*
          <label className="block margin-block-100">
            {t("forms:meta_roadmap.roadmap_series_description")}
            <textarea className="block margin-block-25" name="description" id="description" defaultValue={currentRoadmap?.description ?? undefined} required></textarea>
          </label>
          */}

          {/* TODO input_updates: How do i properly label this? */}
          <div className="margin-block-100">
            <div className="margin-block-25">{t("forms:meta_roadmap.roadmap_series_description")}</div>
            <TextEditor />
          </div>
          
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:meta_roadmap.actor_legend")}</legend>
          <label className="block margin-bottom-100">
            {t("forms:meta_roadmap.roadmap_scope_label")}
            <select className="block margin-block-25" name="type" id="type" defaultValue={currentRoadmap?.type ?? ""} required>
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

          <div className="margin-block-100">
            <label htmlFor="actors">{t("forms:meta_roadmap.choose_actor")}</label>
            <SuggestiveText
              className="margin-top-25"
              id="actor"
              name="actor"
              required={false}
              defaultValue={currentRoadmap?.actor ?? undefined}
              // suggestiveList={Object.keys(countiesAndMunicipalities)} Enbart län
              // suggestiveList={Object.values(countiesAndMunicipalities).flat()} Enbart kommuner
              suggestiveList={Object.entries(countiesAndMunicipalities).flat(2)}
            />
          </div>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:meta_roadmap.attach_external")}</legend>
          <LinkInput />
        </fieldset>

        {(!currentRoadmap || user?.isAdmin || user?.id === currentRoadmap.authorId) &&
          <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:meta_roadmap.change_read_access")}</legend>
            <ViewUsers
              groupOptions={userGroups}
              existingUsers={currentAccess?.viewers.map((user) => user.username)}
              existingGroups={currentAccess?.viewGroups.map((group) => { return group.name })}
              isPublic={currentAccess?.isPublic ?? false}
            />
          </fieldset>
        }


        {(!currentRoadmap || user?.isAdmin || user?.id === currentRoadmap.authorId) &&
          <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:meta_roadmap.change_edit_access")}</legend>
            <EditUsers
              groupOptions={userGroups}
              existingUsers={currentAccess?.editors.map((user) => user.username)}
              existingGroups={currentAccess?.editGroups.map((group) => { return group.name })}
            />
          </fieldset>
        }

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:meta_roadmap.relationship_legend")}</legend>
          <label className="block margin-block-100">
            {t("forms:meta_roadmap.relationship_label")}
            <select name="parentRoadmap" id="parentRoadmap" className="block margin-block-25" defaultValue={currentRoadmap?.parentRoadmapId ?? ""}>
              <option value="">{t("forms:meta_roadmap.relationship_no_chosen")}</option>
              {
                !parentRoadmapOptions && currentRoadmap && currentRoadmap.parentRoadmapId && (
                  <option value={currentRoadmap.parentRoadmapId} disabled>{currentRoadmap.parentRoadmapId}</option>
                )
              }
              {
                parentRoadmapOptions && parentRoadmapOptions.map((metaRoadmap) => {
                  return (
                    <option key={metaRoadmap.id} value={metaRoadmap.id}>{metaRoadmap.name}</option>
                  )
                })
              }
            </select>
          </label>
        </fieldset>


        {/* Add copy of RoadmapForm? Only if we decide to include it immediately rather than redirecting to it */}
        <input className="seagreen color-purewhite margin-block-200" type="submit" id="submit-button" value={currentRoadmap ? t("common:tsx.save") : t("common:tsx.create")} /> {/* TODO: Set disabled if form not filled out */}
      </form>

      <datalist id="actors">
        {
          Object.entries(countiesAndMunicipalities).flat(2).map((actor, index) => {
            return (
              <option key={`${actor}${index}`} value={actor} />
            )
          })
        }
      </datalist>
    </>
  )
}