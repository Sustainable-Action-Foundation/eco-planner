'use client'

import formSubmitter from "@/functions/formSubmitter";
import parseCsv, { csvToGoalList } from "@/functions/parseCsv";
import { LoginData } from "@/lib/session";
import type { AccessControlled, GoalCreateInput, RoadmapCreateInput, RoadmapUpdateInput } from "@/types";
import { MetaRoadmap, Roadmap } from "@prisma/client";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from '../forms.module.css';
import { TFunction } from "i18next";
import { Trans, useTranslation } from "react-i18next";
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import TextEditor from "../elements/textEditor/editor";
import { IconUpload } from "@tabler/icons-react";
import ConfigureAccess from "../sections/access";
import { useToastContext } from "@/context/context";
import { useRouter } from "next/navigation";

function checkForBadDecoding(csv: string[][], t: TFunction, addMessage: (text: string, type: 'success' | 'error' | 'warning') => void) {
  if (csv.some((row) => row.some((cell) => cell.includes("�")))) {
    addMessage(t("forms:roadmap.bad_decoding"), "warning");
  }
}

// TODO: Still need to clean this up a bit
export default function RoadmapForm({
  user,
  userGroups,
  metaRoadmapAlternatives,
  currentRoadmap,
  defaultMetaRoadmap,
}: {
  user: LoginData['user'],
  userGroups: string[],
  metaRoadmapAlternatives?: (MetaRoadmap & {
    roadmapVersions: { id: string, version: number }[],
  })[],
  currentRoadmap?: Roadmap & AccessControlled & { metaRoadmap: MetaRoadmap },
  defaultMetaRoadmap?: string,
}) {
  const { t } = useTranslation(["forms", "common"]);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { addMessage } = useToastContext();

  async function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!metaRoadmapId && !currentRoadmap) { return; }

    setIsLoading(true)

    const form = event.target.elements
    const description = (form.namedItem("description") as HTMLInputElement | null)?.value ?? null;
    const visibility = (form.namedItem("visibility") as RadioNodeList)?.value;
    const editability = (form.namedItem("editability") as RadioNodeList)?.value;

    let goals: GoalCreateInput[] = [];
    if (currentFile) {
      try {
        goals = csvToGoalList(parseCsv(await currentFile.arrayBuffer().then((buffer) => { return buffer })), () => addMessage(t("forms:roadmap.scale_deprecated"), "warning"));
      }
      catch (error) {
        setIsLoading(false)
        addMessage(t("forms:roadmap.roadmap_version_creation_error", { error: error instanceof Error ? error.message || t("forms:roadmap.unknown_error") : t("forms:roadmap.unknown_error") }), "error");
        return
      }
    }

    /** 
     * ## DEPRECATED - use recipes instead
     * TODO: Migrate to recipes before deployment
     */
    const inheritGoalIds: string[] = [];
    (form.namedItem('inherit-goals') as RadioNodeList | null)?.forEach((checkbox) => {
      if (checkbox.checked) {
        inheritGoalIds.push(checkbox.value)
      }
    })

    let formData: RoadmapCreateInput | RoadmapUpdateInput;
    if (currentRoadmap) {
      // Updating existing roadmap
      formData = {
        roadmapId: currentRoadmap.id,
        timestamp: timestamp,

        description: description ?? undefined,
        targetVersion: parseInt((form.namedItem('target-version') as HTMLSelectElement)?.value) || null,
        isPublic: visibility === "public",

        metaRoadmapId: undefined, // Can't change the metaRoadmap after creation
        goals: goals,

        editors: editability === "custom" ? (form.namedItem("editors") as HTMLInputElement)?.value.split(',').map(string => string.trim()).filter(Boolean) : [],
        viewers: visibility === "custom" ? (form.namedItem("viewers") as HTMLInputElement)?.value.split(",").map(s => s.trim()).filter(Boolean) : [],
        editGroups: editability === "custom" ? (form.namedItem("editor-groups") as HTMLButtonElement)?.value.split(',').filter(Boolean) : [],
        viewGroups: visibility === "custom" ? (form.namedItem("viewer-groups") as HTMLInputElement)?.value.split(",").filter(Boolean) : [],

        // DEPRECATED - moved to description
        links: undefined,
      }
    } else {
      // Creating new roadmap
      formData = {
        roadmapId: undefined,
        timestamp: undefined,

        description: description ?? null,
        targetVersion: parseInt((form.namedItem('target-version') as HTMLSelectElement)?.value) || null,
        isPublic: visibility === "public",

        metaRoadmapId: metaRoadmapId,
        goals: goals,

        editors: editability === "custom" ? (form.namedItem("editors") as HTMLInputElement)?.value.split(',').map(string => string.trim()).filter(Boolean) : [],
        viewers: visibility === "custom" ? (form.namedItem("viewers") as HTMLInputElement)?.value.split(",").map(s => s.trim()).filter(Boolean) : [],
        editGroups: editability === "custom" ? (form.namedItem("editor-groups") as HTMLButtonElement)?.value.split(',').filter(Boolean) : [],
        viewGroups: visibility === "custom" ? (form.namedItem("viewer-groups") as HTMLInputElement)?.value.split(",").filter(Boolean) : [],

        // DEPRECATED - moved to description
        links: undefined,
      }
    }

    const formJSON = JSON.stringify(formData)

    formSubmitter('/api/roadmap', formJSON, currentRoadmap ? 'PUT' : 'POST', t, setIsLoading, undefined, undefined, undefined, addMessage, router.push);
  }

  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const timestamp = Date.now()
  const [metaRoadmapId, setMetaRoadmapId] = useState<string>(currentRoadmap?.metaRoadmapId || defaultMetaRoadmap || "")
  const [targetVersion, setTargetVersion] = useState<number | null>(0)
  // Temporarily disabled
  // const [inheritableGoals, setInheritableGoals] = useState<{ id: string, name: string | null, indicatorParameter: string }[]>([])
  const metaRoadmapTarget = useMemo(() => {
    // The meta roadmap that the parent meta roadmap works towards, if any
    return metaRoadmapAlternatives?.find((parentRoadmap) => parentRoadmap.id === metaRoadmapAlternatives?.find((roadmap) => roadmap.id === metaRoadmapId)?.parentRoadmapId)
  }, [metaRoadmapId, metaRoadmapAlternatives])

  // Fetch inheritable goals when the target version changes
  // Temporarily disabled
  // useEffect(() => {
  //   setIsLoading(true)
  //   clientSafeGetOneRoadmap(metaRoadmapTarget?.roadmapVersions.find((version) => version.version === targetVersion)?.id || "")
  //     .then((roadmap) => {
  //       if (!roadmap) {
  //         setInheritableGoals([]);
  //         setIsLoading(false);
  //         return;
  //       }
  //       setInheritableGoals(roadmap.goals);
  //       setIsLoading(false);
  //       return;
  //     })
  //     .catch(() => {
  //       setInheritableGoals([]);
  //       setIsLoading(false);
  //       return;
  //     })
  // }, [metaRoadmapTarget, targetVersion])

  // Validate file when it changes
  useEffect(() => {
    if (!currentFile) return;
    if (currentFile) {
      setIsLoading(true)
      try {
        currentFile.arrayBuffer()
          .then((buffer) => parseCsv(buffer))
          .then((csv) => {
            checkForBadDecoding(csv, t, addMessage);
            return csvToGoalList(csv, () => addMessage(t("forms:roadmap.scale_deprecated_extended"), "warning"));
          })
          .then(() => setIsLoading(false))
          .catch((error) => {
            throw error;
          });
      }
      catch (error) {
        // alert(t("forms:roadmap.file_read_error", { error: error instanceof Error ? error.message || t("forms:roadmap.unknown_error") : t("forms:roadmap.unknown_error") }))
        addMessage(t("forms:roadmap.file_read_error", { error: error instanceof Error ? error.message || t("forms:roadmap.unknown_error") : t("forms:roadmap.unknown_error") }), "error");
        setIsLoading(false);
        return;
      }
    }
  }, [currentFile, t])


  // Indexes for the data-position attribute in the legend elements
  let positionIndex = 1;

  const metaRoadmaps = useMemo(() => {
    return (metaRoadmapAlternatives ?? []).map(metaRoadmap => ({
      name: metaRoadmap.name,
      value: metaRoadmap.id
    }));
  }, [metaRoadmapAlternatives]);

  return (
    <>
      <form onSubmit={(e: React.ChangeEvent<HTMLFormElement>) => {
        e.preventDefault();
        void handleSubmit(e);
      }}>
        {/* This hidden submit button prevents submitting by pressing enter, this avoids accidental submission when adding new entries in AccessSelector (for example, when pressing enter to add someone to the list of editors) */}
        <input type="submit" disabled={true} className="display-none" aria-hidden={true} />

        {(!(currentRoadmap?.metaRoadmapId || defaultMetaRoadmap) || metaRoadmapTarget?.roadmapVersions.length) ?

          <fieldset className={`${styles.timeLineFieldset} width-100`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:roadmap.relationship_legend")}</legend>
            {/* Allow user to select parent metaRoadmap if not already selected */}
            {!(currentRoadmap?.metaRoadmapId || defaultMetaRoadmap) ?
              <>
                <label id="parent-roadmap-label" htmlFor="parent-roadmap">{t("forms:roadmap.relationship_label")}</label> {/* TODO: Not capitalized properly due to issues in english translation */}
                <SelectSingleSearch
                  props={{
                    required: true,
                    className: "margin-top-25 margin-bottom-100",
                    id: "parent-roadmap",
                    name: "parent-roadmap",
                    placeholder: `${t("common:tsx.select")}  ${t("common:roadmap_series_one")}`,
                  }}
                  onChange={(value) => value?.value ? setMetaRoadmapId(value.value) : setMetaRoadmapId("")}
                  options={metaRoadmaps}
                />

              </>
              : null
            }

            {metaRoadmapTarget?.roadmapVersions.length && (
              <label>
                {t("forms:roadmap.roadmap_target_label", { targetName: metaRoadmapTarget.name })}
                <select className="block margin-top-25 margin-bottom-100 width-100" name="target-version" id="target-version" required defaultValue={currentRoadmap?.targetVersion || ""} onChange={(e) => setTargetVersion(parseInt(e.target.value) || null)}>
                  <option value="">{t("forms:roadmap.roadmap_target_no_chosen")}</option>
                  <option value={0}>{t("forms:roadmap.roadmap_target_always_latest")}</option>
                  {metaRoadmapTarget.roadmapVersions.map((version) => {
                    return (
                      <option key={version.version} value={version.version}>{`Version ${version.version}`}</option>
                    )
                  })}
                </select>
              </label>
            )}
          </fieldset>
          : null
        }

        <fieldset className={`${styles.timeLineFieldset} width-100 ${positionIndex > 1 ? "margin-top-200" : ""}`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:roadmap.roadmap_version_legend")}</legend>
          <label id="description-label">{t("forms:roadmap.roadmap_description")}</label>
          <TextEditor
            className="margin-top-25 margin-bottom-100" // TODO: Need label for texteditormenu
            id="description"
            ariaLabelledBy="description-label"
            placeholder={t("forms:text_editor_menu.default_placeholder")}
            editable={true}
            content={currentRoadmap ? currentRoadmap.description : ""}
            onChange={(json) => descriptionRef.current ? descriptionRef.current.value = JSON.stringify(json) : null}
          />
          <input ref={descriptionRef} type="hidden" name="description" />

        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:roadmap.upload_goals")}</legend>
          <label>
            <Trans
              i18nKey={"forms:roadmap.goal_accepted_formats"}
              tOptions={{ fileTypes: [".csv"], encodings: ["UTF-8"], type: "unit" }}
              components={{ small: <small /> }}
            />
            <div className="focusable flex width-fit-content align-items-center gap-50 margin-top-25 margin-bottom-100">
              <div className="gray-90 padding-block-50 padding-inline-75" style={{ borderRadius: '.25rem 0 0 .25rem' }}>
                <IconUpload width={20} height={20} aria-hidden={true} className="grid" />
              </div>
              <input
                type="file"
                name="csv-upload"
                id="csv-upload"
                accept=".csv"
                onChange={(e) => e.target.files ? setCurrentFile(e.target.files[0]) : setCurrentFile(null)}
              />
            </div>
          </label>
        </fieldset>


        {/* TODO: Use recipes */}
        {/* TODO: Add option to inherit some/all goals from previous versions of same roadmap */}
        {/* TODO: Add checkboxes for inheriting some/all goals from another roadmap (not the target) with `inheritFromID` */}
        {/* TODO: Allow choosing which roadmap to inherit from, might be different from target */}
        {/* Temporarily disabled */}
        {/* RE-ENABLE WHEN UPDATED */}
        {/*
          inheritableGoals.length > 0 && (
            <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
              <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:roadmap.inherit_goal_legend")}</legend>
              {
                inheritableGoals.map((goal) => {
                  return (
                    <label key={goal.id} className="flex width-fit-content margin-bottom-75 align-items-center gap-50">
                      <input type="checkbox" name={`inherit-goals`} id={`inherit-goals-${goal.id}`} value={goal.id} />
                      {`${goal.name || goal.indicatorParameter}`}
                    </label>
                  )
                })
              }
            </fieldset>
          )
        */}

        <ConfigureAccess
          user={user}
          userGroups={userGroups}
          currentRoadmap={currentRoadmap}
          positionIndex={positionIndex}
          legends={{
            viewers: t("forms:roadmap.legend_visibility"),
            editors: t("forms:roadmap.legend_editability")
          }}
        />

        <div className="margin-top-400 padding-top-100 margin-bottom-100" style={{ borderTop: '1px solid var(--gray-80)' }}>
          <button
            className="text-align-center seagreen color-purewhite width-100"
            style={{ fontSize: '14px', transform: 'none' }}
            type="submit"
            id="submit-button"
            disabled={isLoading}
          >
            {currentRoadmap ? t("common:tsx.save") : t("forms:roadmap.create")}
          </button>
        </div>
      </form >
      <button onClick={() => addMessage(t("forms:roadmap.bad_decoding"), "warning")}>Add Error Toast</button>
      <button onClick={() => addMessage(t("forms:roadmap.scale_deprecated"), "warning")}>Add Error Toast</button>
      <button onClick={() => addMessage(t("forms:roadmap.unknown_error"), "error")}>Add Error Toast</button>
      <button onClick={() => addMessage(t("forms:roadmap.roadmap_version_creation_error"), "error")}>Add Error Toast</button>
      <button onClick={() => addMessage(t("forms:roadmap.scale_deprecated_extended"), "warning")}>Add Error Toast</button>
      <button onClick={() => addMessage(t("forms:roadmap.file_read_error"), "error")}>Add Error Toast</button>
    </>
  )
}