'use client'

import { EditUsers, getAccessData, ViewUsers } from "@/components/forms/elements/accessSelector/accessSelector";
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

function checkForBadDecoding(csv: string[][], t: TFunction) {
  if (csv.some((row) => row.some((cell) => cell.includes("�")))) {
    alert(t("forms:roadmap.bad_decoding"));
  }
}

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

  async function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!metaRoadmapId) { return; }

    setIsLoading(true)

    const form = event.target.elements

    const { editUsers, viewUsers, editGroups, viewGroups } = getAccessData(
      form.namedItem("editUsers"),
      form.namedItem("viewUsers"),
      form.namedItem("editGroups"),
      form.namedItem("viewGroups")
    )

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
      description: (form.namedItem("description") as HTMLTextAreaElement)?.value || undefined,
      editors: editUsers,
      viewers: viewUsers,
      editGroups,
      viewGroups,
      isPublic: (form.namedItem("isPublic") as HTMLInputElement)?.checked || false,
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
      <form onSubmit={handleSubmit}>
        {/* This hidden submit button prevents submitting by pressing enter, this avoids accidental submission when adding new entries in AccessSelector (for example, when pressing enter to add someone to the list of editors) */}
        <input type="submit" disabled={true} className="display-none" aria-hidden={true} />

        {(!(currentRoadmap?.metaRoadmapId || defaultMetaRoadmap) || metaRoadmapTarget?.roadmapVersions.length) ?

          <fieldset className={`${styles.timeLineFieldset} width-100`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold`}>{t("forms:roadmap.relationship_legend")}</legend>
            {/* Allow user to select parent metaRoadmap if not already selected */}
            {!(currentRoadmap?.metaRoadmapId || defaultMetaRoadmap) ?
              <>
                <label className="block margin-block-100">
                  {t("forms:roadmap.relationship_label")}
                  <select className="block margin-block-25" name="parentRoadmap" id="parentRoadmap" value={metaRoadmapId} required onChange={(e) => setMetaRoadmapId(e.target.value)}>
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
              <label className="block margin-block-100">
                {t("forms:roadmap.roadmap_target_label", { targetName: metaRoadmapTarget.name })}
                <select className="block margin-block-25" name="targetVersion" id="targetVersion" required defaultValue={currentRoadmap?.targetVersion || ""} onChange={(e) => setTargetVersion(parseInt(e.target.value) || null)}>
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
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold`}>{t("forms:roadmap.roadmap_version_legend")}</legend>
          <label className="block margin-block-100">
            {t("forms:roadmap.roadmap_description")}
            <textarea className="margin-block-25" name="description" id="description" defaultValue={currentRoadmap?.description ?? undefined}></textarea>
          </label>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:roadmap.upload_goals")}</legend>
          <label className="block margin-bottom-100">
            {/*TODO: Add to info bubble
            Om du har en CSV-fil med målbanor kan du ladda upp den här. <br />
            Notera att det här skapar nya målbanor även om det redan finns några. */}
            <Trans
              i18nKey={"forms:roadmap.goal_accepted_formats"}
              tOptions={{ fileTypes: [".csv"], encodings: ["UTF-8"], type: "unit" }}
              components={{ small: <small /> }}
            />

            <input className="margin-block-25" type="file" name="csvUpload" id="csvUpload" accept=".csv" onChange={(e) => e.target.files ? setCurrentFile(e.target.files[0]) : setCurrentFile(null)} />
          </label>
        </fieldset>

        {/* TODO: Add option to inherit some/all goals from previous versions of same roadmap */}
        {/* TODO: Add checkboxes for inheriting some/all goals from another roadmap (not the target) with `inheritFromID` */}
        {/* TODO: Allow choosing which roadmap to inherit from, might be different from target */}
        {inheritableGoals.length > 0 && (
          <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:roadmap.inherit_goal_legend")}</legend>
            {
              inheritableGoals.map((goal) => {
                return (
                  <label key={goal.id} className="block margin-block-25">
                    <input type="checkbox" name={`inheritGoals`} id={`inheritGoals-${goal.id}`} value={goal.id} />
                    {`${goal.name || goal.indicatorParameter}`}
                  </label>
                )
              })
            }
          </fieldset>
        )}

        {(!currentRoadmap || user?.isAdmin || user?.id === currentRoadmap.authorId) &&
          <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:roadmap.change_read_access")}</legend>
            <ViewUsers
              groupOptions={userGroups}
              existingUsers={currentAccess?.viewers.map((user) => user.username)}
              existingGroups={currentAccess?.viewGroups.map((group) => group.name)}
              isPublic={currentAccess?.isPublic ?? false}
            />
          </fieldset>
        }

        {(!currentRoadmap || user?.isAdmin || user?.id === currentRoadmap.authorId) &&
          <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:roadmap.change_edit_access")}</legend>
            <EditUsers
              groupOptions={userGroups}
              existingUsers={currentAccess?.editors.map((user) => user.username)}
              existingGroups={currentAccess?.editGroups.map((group) => group.name)}
            />
          </fieldset>
        }

        {/* TODO: Show spinner or loading indicator when isLoading is true */}
        <input
          type="submit"
          className="margin-block-200 seagreen color-purewhite"
          value={currentRoadmap ? t("common:tsx.save") : t("common:tsx.create")}
          disabled={isLoading}
        />
      </form>
    </>
  )
}