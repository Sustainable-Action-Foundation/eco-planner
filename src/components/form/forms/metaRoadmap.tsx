'use client'

import countiesAndMunicipalities from "@/lib/countiesAndMunicipalities.json" with { type: "json" }
import { LoginData } from "@/lib/session";
import { AccessControlled, MetaRoadmapInput } from "@/types";
import { MetaRoadmap, RoadmapType } from "@prisma/client";
import { useState } from "react";
import formSubmitter from "@/functions/formSubmitter";
import styles from '../forms.module.css'
import { useTranslation } from "react-i18next";
import TextEditor from "@/components/form/elements/textEditor/textEditor";
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import TextSingleAutocomplete from "../elements/combobox/textSingleAutocomplete.tsx";
import ConfigureAccess from "../sections/access.tsx";

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

  const [editorContent, setEditorContent] = useState<any>(() => {
    if (!currentRoadmap?.description) return null;

    try {
      return JSON.parse(currentRoadmap.description);
    } catch {
      return currentRoadmap.description;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [roadmapType, setRoadmapType] = useState<string>("");

  const timestamp = Date.now()

  const customRoadmapTypes = {
    [RoadmapType.NATIONAL]: t("common:scope.national"),
    [RoadmapType.REGIONAL]: t("common:scope.regional"),
    [RoadmapType.MUNICIPAL]: t("common:scope.municipal"),
    [RoadmapType.LOCAL]: t("common:scope.local"),
    [RoadmapType.OTHER]: t("common:scope.other"),
  } 
  
  async function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    // Mostly the usual submit handler stuff.
    // We might want to redirect the user to the roadmap form immediately after successfully submitting the metaRoadmap form
    // (and pre-populate the roadmap form with the new metaRoadmap's ID)
    event.preventDefault();
    // Prevent double submission
    if (isLoading) return;
    setIsLoading(true);

    const form = event.target.elements;
    const visibility = (form.namedItem("visibility") as RadioNodeList)?.value;
    const editability = (form.namedItem("editability") as RadioNodeList)?.value;

    const formData: MetaRoadmapInput & { id?: string, timestamp?: number } = {
      name: (form.namedItem("name") as HTMLInputElement)?.value,
      description: JSON.stringify(editorContent),
      type: ((form.namedItem("type") as HTMLSelectElement)?.value as RoadmapType) || null,
      actor: (form.namedItem("actor") as HTMLInputElement)?.value || null,
      editors: editability === "custom" ? (form.namedItem("editors") as HTMLInputElement)?.value.split(',').map(string => string.trim()).filter(Boolean) : [],
      viewers: visibility === "custom" ? (form.namedItem("viewers") as HTMLInputElement)?.value.split(",").map(string => string.trim()).filter(Boolean) : [],
      editGroups: editability === "custom" ? (form.namedItem("editor-groups") as HTMLButtonElement)?.value.split(',').filter(Boolean) : [],
      viewGroups: visibility === "custom" ? (form.namedItem("viewer-groups") as HTMLInputElement)?.value.split(",").filter(Boolean) : [],
      isPublic: (form.namedItem("visibility") as RadioNodeList)?.value === "public",
      links: undefined, // TODO: Links in DB should be migrated to description
      parentRoadmapId: (form.namedItem("parent-roadmap") as HTMLButtonElement)?.value || undefined,
      id: currentRoadmap?.id || undefined,
      timestamp,
    };

    console.log(formData)

    const formJSON = JSON.stringify(formData);

    formSubmitter('/api/metaRoadmap', formJSON, currentRoadmap ? 'PUT' : 'POST', setIsLoading);
  }

  // Indexes for the data-position attribute in the legend elements
  let positionIndex = 1;

  // TODO: i18n for basically all inputs
  return (
    <>
      <form onSubmit={handleSubmit} >
        {/* This hidden submit button prevents submitting by pressing enter, this avoids accidental submission when adding new entries in AccessSelector (for example, when pressing enter to add someone to the list of editors) */}
        <input type="submit" disabled={true} className="display-none" aria-hidden={true} />

        <fieldset className={`${styles.timeLineFieldset} width-100`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:meta_roadmap.description_legend")}</legend>
          <label>
            Namn
            <input id="name" name="name" className="margin-top-25 margin-bottom-100" type="text" defaultValue={currentRoadmap?.name ?? undefined} autoComplete="off" required />
          </label>

          <label id="description-label">Beskriving</label>
          <TextEditor
            className="margin-top-25 margin-bottom-100" // TODO: Need label for texteditormenu
            id="description"
            ariaLabelledBy="description-label"
            placeholder="Skriv något..."
            editable={true}
            content={currentRoadmap ? currentRoadmap.description : ""}
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

          <label htmlFor="actor">Aktör</label>
          <TextSingleAutocomplete
            props={{
              className: "margin-top-25 margin-bottom-100",
              id: "actor",
              name: "actor",
              required: true,
              defaultValue: currentRoadmap?.actor ?? undefined
            }}
            options={
              roadmapType === "REGIONAL"
                ? Object.keys(countiesAndMunicipalities).map(item => ({ name: item, value: item }))
                : roadmapType === "MUNICIPAL"
                  ? Object.values(countiesAndMunicipalities).flat().map(item => ({ name: item, value: item }))
                  : []
            }
          />
        </fieldset>

        <ConfigureAccess
          user={user}
          userGroups={userGroups}
          currentRoadmap={currentRoadmap}
          positionIndex={positionIndex}
        />

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:meta_roadmap.relationship_legend")}</legend>
          <label id="parent-roadmap-label" htmlFor="parent-roadmap">{t("forms:meta_roadmap.relationship_label")}</label>
          {parentRoadmapOptions ? ( // TODO: This might not make sense?
            <SelectSingleSearch
              props={{
                className: "margin-top-25",
                id: "parent-roadmap",
                name: "parent-roadmap",
                placeholder: "välj eller lämna blank", // TODO: i18n
                disabled: !parentRoadmapOptions
              }}
              defaultValue={ // TODO: Might be a better way to do this
                currentRoadmap
                  ? currentRoadmap.parentRoadmapId
                    ? (() => {
                      const selected = parentRoadmapOptions.find(
                        (roadmap) => roadmap.id === currentRoadmap.parentRoadmapId
                      );
                      return selected ? { name: selected.name, value: selected.id } : false;
                    })()
                    : { name: t("forms:meta_roadmap.relationship_no_chosen"), value: "" }
                  : false
              }
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
            disabled={isLoading}
          >
            {currentRoadmap ? t("common:tsx.save") : t("common:tsx.create") + ' färdplansserie'} {/* TODO: i18n  */}
          </button>
        </div>
      </form>
    </>
  )
}