'use client'

import countiesAndMunicipalities from "@/lib/countiesAndMunicipalities.json" with { type: "json" }
import { LoginData } from "@/lib/session";
import type { AccessControlled, MetaRoadmapCreateInput, MetaRoadmapUpdateInput } from "@/types";
import { MetaRoadmap, RoadmapType } from "@prisma/client";
import { useRef, useState } from "react";
import formSubmitter from "@/functions/formSubmitter";
import styles from '../forms.module.css'
import { useTranslation } from "react-i18next";
import TextEditor from "@/components/form/elements/textEditor/editor";
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import TextSingleAutocomplete from "../elements/combobox/textSingleAutocomplete";
import ConfigureAccess from "../sections/access";
import { useToastContext } from "@/context/context";

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
  const descriptionRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [roadmapType, setRoadmapType] = useState<string>("");

  const timestamp = Date.now()

  const customRoadmapTypes = {
    [RoadmapType.NATIONAL]: t("common:scope.national"),
    [RoadmapType.REGIONAL]: t("common:scope.regional"),
    [RoadmapType.MUNICIPAL]: t("common:scope.municipal"),
    [RoadmapType.LOCAL]: t("common:scope.local"),
    [RoadmapType.ORGANIZATIONAL]: t("common:scope.organizational"),
    [RoadmapType.OTHER]: t("common:scope.other"),
  }

  const { messages, addMessage } = useToastContext();

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
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

    const description = form.namedItem("description") as HTMLInputElement | null;
    if (!description?.value && !currentRoadmap) {
      event.target.reportValidity();
      setIsLoading(false);
      // TODO: Convert to toast notification
      // alert(t("forms:meta_roadmap.description_required"));
      addMessage(t("forms:meta_roadmap.description_required"), "warning");
      return;
    }

    let formData: MetaRoadmapCreateInput | MetaRoadmapUpdateInput;
    if (!currentRoadmap) {
      // Create
      formData = {
        name: (form.namedItem("name") as HTMLInputElement)?.value,
        description: (form.namedItem("description") as HTMLInputElement | null)?.value || "", // Should always have a value due to the check above, but just in case
        type: ((form.namedItem("type") as HTMLSelectElement)?.value as RoadmapType) || null,
        actor: (form.namedItem("actor") as HTMLInputElement)?.value || null,
        editors: editability === "custom" ? (form.namedItem("editors") as HTMLInputElement)?.value.split(',').map(string => string.trim()).filter(Boolean) : [],
        viewers: visibility === "custom" ? (form.namedItem("viewers") as HTMLInputElement)?.value.split(",").map(string => string.trim()).filter(Boolean) : [],
        editGroups: editability === "custom" ? (form.namedItem("editor-groups") as HTMLInputElement)?.value.split(',').filter(Boolean) : [],
        viewGroups: visibility === "custom" ? (form.namedItem("viewer-groups") as HTMLInputElement)?.value.split(",").filter(Boolean) : [],
        isPublic: (form.namedItem("visibility") as RadioNodeList)?.value === "public",
        links: undefined, // TODO: Links in DB should be migrated to description
        parentRoadmapId: (form.namedItem("parent-roadmap") as HTMLButtonElement)?.value || undefined,
      } satisfies MetaRoadmapCreateInput;
    } else {
      // Update
      formData = {
        name: (form.namedItem("name") as HTMLInputElement)?.value,
        description: (form.namedItem("description") as HTMLInputElement | null)?.value,
        type: ((form.namedItem("type") as HTMLSelectElement)?.value as RoadmapType) || undefined,
        actor: (form.namedItem("actor") as HTMLInputElement)?.value ?? undefined,
        editors: editability === "custom" ? (form.namedItem("editors") as HTMLInputElement)?.value.split(',').map(string => string.trim()).filter(Boolean) : [],
        viewers: visibility === "custom" ? (form.namedItem("viewers") as HTMLInputElement)?.value.split(",").map(string => string.trim()).filter(Boolean) : [],
        editGroups: editability === "custom" ? (form.namedItem("editor-groups") as HTMLButtonElement)?.value.split(',').filter(Boolean) : [],
        viewGroups: visibility === "custom" ? (form.namedItem("viewer-groups") as HTMLInputElement)?.value.split(",").filter(Boolean) : [],
        isPublic: (form.namedItem("visibility") as RadioNodeList)?.value === "public",
        links: undefined, // TODO: Links in DB should be migrated to description
        parentRoadmapId: (form.namedItem("parent-roadmap") as HTMLButtonElement)?.value || undefined,
        id: currentRoadmap.id,
        timestamp,
      } satisfies MetaRoadmapUpdateInput;
    }

    const formJSON = JSON.stringify(formData);

    formSubmitter('/api/metaRoadmap', formJSON, currentRoadmap ? 'PUT' : 'POST', t, setIsLoading);
  }

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
            {t("forms:meta_roadmap.name")}
            <input id="name" name="name" className="margin-top-25 margin-bottom-100" type="text" defaultValue={currentRoadmap?.name ?? undefined} autoComplete="off" required />
          </label>

          <label id="description-label">{t("forms:meta_roadmap.description")}</label>
          <TextEditor
            className="margin-top-25 margin-bottom-100" // TODO: Need label for texteditormenu
            id="description"
            ariaLabelledBy="description-label"
            placeholder={t("forms:text_editor_menu.default_placeholder")}
            editable={true}
            content={currentRoadmap ? currentRoadmap.description : ""}
            onChange={(json) => descriptionRef.current ? descriptionRef.current.value = JSON.stringify(json) : null}
          />
          <input required ref={descriptionRef} type="hidden" name="description" />
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:meta_roadmap.actor_legend")}</legend>
          <label>
            {t("forms:meta_roadmap.type")}
            <select
              className="block margin-top-25 margin-bottom-100 width-100"
              name="type"
              id="type"
              defaultValue={currentRoadmap?.type ?? ""}
              required
              onChange={(e) => setRoadmapType((e.target as HTMLSelectElement).value)}
            >
              <option value="" disabled>{t("forms:meta_roadmap.no_chosen_roadmap_scope")}</option>
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

          <label htmlFor="actor">{t("forms:meta_roadmap.actor")}</label>
          <TextSingleAutocomplete
            props={{
              className: "margin-top-25 margin-bottom-100",
              id: "actor",
              name: "actor",
              required: true,
              defaultValue: currentRoadmap?.actor ?? undefined,
              placeholder: roadmapType === "REGIONAL" || roadmapType === "MUNICIPAL" ? t("forms:combobox.default_autocomplete_placeholder") : t("forms:meta_roadmap.actor"),
            }}
            // L10N: the current implementation uses only Swedish counties and municipalities; should probably be adapted for international use in the future
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
          legends={{
            viewers: t("forms:meta_roadmap.legend_visibility"),
            editors: t("forms:meta_roadmap.legend_editability")
          }}
        />

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:meta_roadmap.relationship_legend")}</legend>
          <label id="parent-roadmap-label" htmlFor="parent-roadmap">{t("forms:meta_roadmap.relationship_label")}</label>
          {parentRoadmapOptions ? ( // TODO: This might not make sense? // TODO: Memoize this? 
            <SelectSingleSearch
              props={{
                className: "margin-top-25",
                id: "parent-roadmap",
                name: "parent-roadmap",
                placeholder: t("forms:combobox.select_or_leave"),
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

        <div className="margin-top-400 padding-top-100 margin-bottom-100" style={{ borderTop: '1px solid var(--gray-80)' }}>
          <button
            className="text-align-center seagreen color-purewhite width-100"
            style={{ fontSize: '14px', transform: 'none' }}
            type="submit"
            id="submit-button"
            disabled={isLoading}
          >
            {currentRoadmap ? t("common:tsx.save") : t("forms:meta_roadmap.create")}
          </button>
        </div>
      </form>
      <button onClick={() => addMessage("The action has been created", "success")}>Add Toast</button>

    </>
  )
}