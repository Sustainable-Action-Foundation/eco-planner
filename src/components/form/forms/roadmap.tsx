'use client'

import clientSafeGetOneRoadmap from "@/fetchers/clientSafeGetOneRoadmap";
import formSubmitter from "@/functions/formSubmitter";
import parseCsv, { csvToGoalList } from "@/functions/parseCsv";
import { LoginData } from "@/lib/session";
import { AccessControlled, GoalInput, RoadmapInput } from "@/types";
import { MetaRoadmap, Roadmap } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";
import styles from '../forms.module.css';
import { TFunction } from "i18next";
import { Trans, useTranslation } from "react-i18next";
import { SelectMultipleSearch } from "../elements/select";
import TextEditor from "../elements/textEditor/textEditor";
import { IconUpload } from "@tabler/icons-react";

function checkForBadDecoding(csv: string[][], t: TFunction) {
  if (csv.some((row) => row.some((cell) => cell.includes("�")))) {
    alert(t("forms:roadmap.bad_decoding"));
  }
}

// TODO: Set required for viewer and editselection if custom is selected
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

  const [editorContent, setEditorContent] = useState<any>(() => {
    if (!currentRoadmap?.description) return null;

    try {
      return JSON.parse(currentRoadmap.description);
    } catch {
      return currentRoadmap.description;
    }
  }); 

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

  async function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!metaRoadmapId) { return; }

    setIsLoading(true)

    const form = event.target.elements
    const visibility = (form.namedItem("visibility") as RadioNodeList)?.value;
    const editability = (form.namedItem("editability") as RadioNodeList)?.value;

    let goals: GoalInput[] = [];
    if (currentFile) {
      try {
        goals = csvToGoalList(parseCsv(await currentFile.arrayBuffer().then((buffer) => { return buffer })));
        if (goals.some((goal) => goal.dataScale)) {
          alert(t("forms:roadmap.scale_deprecated"));
        }
      }
      catch (error) {
        setIsLoading(false)
        alert(t("forms:roadmap.roadmap_version_creation_error", { error: error instanceof Error ? error.message || t("forms:roadmap.unknown_error") : t("forms:roadmap.unknown_error") }))
        return
      }
    }

    const inheritGoalIds: string[] = [];
    (form.namedItem('inheritGoals') as RadioNodeList | null)?.forEach((checkbox) => {
      if ((checkbox as HTMLInputElement).checked) {
        inheritGoalIds.push((checkbox as HTMLInputElement).value)
      }
    })

    const formData: RoadmapInput & { roadmapId?: string, goals?: GoalInput[], timestamp: number } = {
      description: JSON.stringify(editorContent) || undefined,
      editors: editability === "custom" ? (form.namedItem("editors") as HTMLInputElement)?.value.split(',').map(string => string.trim()).filter(Boolean) : [],
      viewers: visibility === "custom" ? (form.namedItem("viewers") as HTMLInputElement)?.value.split(",").map(s => s.trim()).filter(Boolean) : [],
      editGroups: editability === "custom" ? (form.namedItem("editor-groups") as HTMLButtonElement)?.value.split(',').filter(Boolean) : [],
      viewGroups: visibility === "custom" ? (form.namedItem("viewer-groups") as HTMLInputElement)?.value.split(",").filter(Boolean) : [],
      isPublic: (form.namedItem("visibility") as RadioNodeList)?.value === "public",
      roadmapId: currentRoadmap?.id || undefined,
      goals: goals,
      metaRoadmapId,
      inheritFromIds: inheritGoalIds,
      targetVersion: parseInt((form.namedItem('targetVersion') as HTMLSelectElement)?.value) || null,
      timestamp,
    }

    const formJSON = JSON.stringify(formData)

    formSubmitter('/api/roadmap', formJSON, currentRoadmap ? 'PUT' : 'POST', setIsLoading);
  }

  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const timestamp = Date.now()
  const [metaRoadmapId, setMetaRoadmapId] = useState<string>(currentRoadmap?.metaRoadmapId || defaultMetaRoadmap || "")
  const [targetVersion, setTargetVersion] = useState<number | null>(0)
  const [inheritableGoals, setInheritableGoals] = useState<{ id: string, name: string | null, indicatorParameter: string }[]>([])
  const metaRoadmapTarget = useMemo(() => {
    // The meta roadmap that the parent meta roadmap works towards, if any
    return metaRoadmapAlternatives?.find((parentRoadmap) => parentRoadmap.id === metaRoadmapAlternatives?.find((roadmap) => roadmap.id === metaRoadmapId)?.parentRoadmapId)
  }, [metaRoadmapId, metaRoadmapAlternatives])

  // Fetch inheritable goals when the target version changes
  useEffect(() => {
    setIsLoading(true)
    clientSafeGetOneRoadmap(metaRoadmapTarget?.roadmapVersions.find((version) => version.version === targetVersion)?.id || "")
      .then((roadmap) => {
        if (!roadmap) {
          setInheritableGoals([]);
          setIsLoading(false);
          return;
        }
        setInheritableGoals(roadmap.goals);
        setIsLoading(false);
        return;
      })
      .catch(() => {
        setInheritableGoals([]);
        setIsLoading(false);
        return;
      })
  }, [metaRoadmapTarget, targetVersion])

  // Validate file when it changes
  useEffect(() => {
    if (!currentFile) return;
    if (currentFile) {
      setIsLoading(true)
      try {
        currentFile.arrayBuffer()
          .then((buffer) => parseCsv(buffer))
          .then((csv) => {
            checkForBadDecoding(csv, t);
            return csvToGoalList(csv);
          })
          .then((goals) => {
            if (goals.some((goal) => goal.dataScale)) {
              alert(t("forms:roadmap.scale_deprecated_extended"));
            }
          })
          .then(() => setIsLoading(false));
      }
      catch (error) {
        alert(t("forms:roadmap.file_read_error", { error: error instanceof Error ? error.message || t("forms:roadmap.unknown_error") : t("forms:roadmap.unknown_error") }))
        setIsLoading(false);
        return;
      }
    }
  }, [currentFile, t])


  // Indexes for the data-position attribute in the legend elements
  let positionIndex = 1;

  return (
    <>
      <form onSubmit={handleSubmit}>
        {/* This hidden submit button prevents submitting by pressing enter, this avoids accidental submission when adding new entries in AccessSelector (for example, when pressing enter to add someone to the list of editors) */}
        <input type="submit" disabled={true} className="display-none" aria-hidden={true} />

        {(!(currentRoadmap?.metaRoadmapId || defaultMetaRoadmap) || metaRoadmapTarget?.roadmapVersions.length) ?

          <fieldset className={`${styles.timeLineFieldset} width-100`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:roadmap.relationship_legend")}</legend>
            {/* Allow user to select parent metaRoadmap if not already selected */}
            {!(currentRoadmap?.metaRoadmapId || defaultMetaRoadmap) ?
              <>
                <label>
                  {t("forms:roadmap.relationship_label")}
                  <select className="block margin-top-25 margin-bottom-100 width-100" name="parentRoadmap" id="parentRoadmap" value={metaRoadmapId} required onChange={(e) => setMetaRoadmapId(e.target.value)}>
                    <option disabled value="">{t("forms:roadmap.relationship_no_chosen")}</option>
                    {metaRoadmapAlternatives?.length ?
                      metaRoadmapAlternatives.map((metaRoadmap) => {
                        return (
                          <option key={metaRoadmap.id} value={metaRoadmap.id}>{`${metaRoadmap.name}`}</option>
                        )
                      })
                      : <option value="disabled" disabled>{t("forms:roadmap.relationship_no_found")}</option>
                    }
                  </select>
                </label>

                {/* TODO: Add to info bubble
            <p>Saknas färdplansserien du söker efter? Kolla att du har tillgång till den eller <Link href={`/metaRoadmap/create`}>skapa en ny färdplansserie</Link></p>
            */}
              </>
              : null
            }

            {metaRoadmapTarget?.roadmapVersions.length && (
              <label>
                {t("forms:roadmap.roadmap_target_label", { targetName: metaRoadmapTarget.name })}
                <select className="block margin-top-25 margin-bottom-100 width-100" name="targetVersion" id="targetVersion" required defaultValue={currentRoadmap?.targetVersion || ""} onChange={(e) => setTargetVersion(parseInt(e.target.value) || null)}>
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
            placeholder="Skriv något..."
            editable={true}
            content={currentRoadmap ? currentRoadmap.description : ""}
            onChange={(json) => setEditorContent(json)}
          />

        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:roadmap.upload_goals")}</legend>
          <label>
            {/*TODO: Add to info bubble
            Om du har en CSV-fil med målbanor kan du ladda upp den här. <br />
            Notera att det här skapar nya målbanor även om det redan finns några. */}
            <Trans
              i18nKey={"forms:roadmap.goal_accepted_formats"}
              tOptions={{ fileTypes: [".csv"], encodings: ["UTF-8"], type: "unit" }}
              components={{ small: <small /> }}
            />
            <div className="focusable flex width-fit-content align-items-center gap-50 margin-top-25">
              <div className="gray-90 padding-block-50 padding-inline-75" style={{borderRadius: '.25rem 0 0 .25rem'}}>
                <IconUpload width={20} height={20} aria-hidden={true} className="grid" />
              </div>
              <input
                type="file"
                name="csvUpload"
                id="csvUpload"
                accept=".csv"
                onChange={(e) => e.target.files ? setCurrentFile(e.target.files[0]) : setCurrentFile(null)}
              />
            </div>
          </label>
        </fieldset>

        {/* TODO: Add option to inherit some/all goals from previous versions of same roadmap */}
        {/* TODO: Add checkboxes for inheriting some/all goals from another roadmap (not the target) with `inheritFromID` */}
        {/* TODO: Allow choosing which roadmap to inherit from, might be different from target */}
        {inheritableGoals.length > 0 && (
          <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:roadmap.inherit_goal_legend")}</legend>
            {
              inheritableGoals.map((goal) => {
                return (
                  <label key={goal.id} className="flex width-fit-content margin-bottom-75 align-items-center gap-50">
                    <input type="checkbox" name={`inheritGoals`} id={`inheritGoals-${goal.id}`} value={goal.id} />
                    {`${goal.name || goal.indicatorParameter}`}
                  </label>
                )
              })
            }
          </fieldset>
        )}

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
                  id="viewer-groups"
                  name="viewer-groups"
                  searchBoxLabel="sök..."
                  searchBoxPlaceholder="sök..."
                  placeholder="Välj grupper"
                  disabled={visibilityType !== "custom"}
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
                  id="editor-groups"
                  name="editor-groups"
                  searchBoxLabel="sök..."
                  searchBoxPlaceholder="sök..."
                  placeholder="Välj grupper"
                  disabled={editabilityType !== "custom"}
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

        {/* TODO: Show spinner or loading indicator when isLoading is true */}
        <div className="margin-top-400 padding-top-100 margin-bottom-100" style={{ borderTop: '1px solid var(--gray-80)' }}>
          <button
            className="text-align-center seagreen color-purewhite width-100"
            style={{ fontSize: '14px', transform: 'none' }}
            type="submit"
            id="submit-button"
            disabled={isLoading}
          >
            {currentRoadmap ? t("common:tsx.save") : t("common:tsx.create") + ' färdplan'} {/* TODO: i18n  */}
          </button>
        </div>

      </form>
    </>
  )
}