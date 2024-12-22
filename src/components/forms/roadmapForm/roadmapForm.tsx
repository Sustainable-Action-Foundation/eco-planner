'use client'

import { EditUsers, getAccessData, ViewUsers } from "@/components/forms/accessSelector/accessSelector";
import { clientSafeGetOneRoadmap } from "@/fetchers/getOneRoadmap";
import formSubmitter from "@/functions/formSubmitter";
import parseCsv, { csvToGoalList } from "@/functions/parseCsv";
import { LoginData } from "@/lib/session";
import { AccessControlled, GoalInput, RoadmapInput } from "@/types";
import { MetaRoadmap, Roadmap } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";
import styles from '../forms.module.css';

function checkForBadDecoding(csv: string[][]) {
  if (csv.some((row) => row.some((cell) => cell.includes("�")))) {
    alert("Filen verkar använda en okänd encoding då den tolkade texten innehåller tecknet '�' som indikerar att något tecken inte kunde tolkas korrekt (antagligen Å, Ä eller Ö).\nDu kan fortfarande använda den här filen, men om du inte är helt säker på att den *ska* innehålla tecknet '�' så rekommenderas att du konverterar filen till UTF-8 encoding och försöker igen.");
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
          alert("Kolumnen 'Scale' stöds inte och kommer att ignoreras.")
        }
      }
      catch (error) {
        setIsLoading(false)
        alert(`Färdplan kunde inte skapas.\nAnledning: ${error instanceof Error ? error.message || "Okänt fel" : "Okänt fel"}`)
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
            checkForBadDecoding(csv);
            return csvToGoalList(csv);
          })
          .then((goals) => {
            if (goals.some((goal) => goal.dataScale)) {
              alert("Kolumnen 'Scale' stöds inte och kommer att ignoreras. Om kolumnen innehåller några skalor, vänligen baka in dem i enheten istället. Exempel: enhet 'MW' snarare än enhet 'kW' och skala 'tusen'");
            }
          })
          .then(() => setIsLoading(false));
      }
      catch (error) {
        alert(`Filen kunde inte läsas: ${error instanceof Error ? error.message || "Okänt fel" : "Okänt fel"}`);
        setIsLoading(false);
        return;
      }
    }
  }, [currentFile])

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

  return (
    <>
      <form onSubmit={handleSubmit}>
        {/* This hidden submit button prevents submitting by pressing enter, this avoids accidental submission when adding new entries in AccessSelector (for example, when pressing enter to add someone to the list of editors) */}
        <input type="submit" disabled={true} className="display-none" aria-hidden={true} />

        {/* TODO: Change to meta roadmaps instead */}
        {/* TODO: Why is metaRoadmapAlternatives here? */}
        {/* Allow user to select parent metaRoadmap if not already selected */}
        {!(currentRoadmap?.metaRoadmapId || defaultMetaRoadmap) ?
          <>
            <label className="block margin-block-300">
              Färdplansserie som detta är ett nytt inlägg i
              <select className="block margin-block-25" name="parentRoadmap" id="parentRoadmap" value={metaRoadmapId} required onChange={(e) => setMetaRoadmapId(e.target.value)}>
                <option value="">Inget alternativ valt</option>
                {metaRoadmapAlternatives?.length ?
                  metaRoadmapAlternatives.map((roadmap) => {
                    return (
                      <option key={roadmap.id} value={roadmap.id}>{`${roadmap.name}`}</option>
                    )
                  })
                  : <option value="disabled" disabled>Du verkar inte ha tillgång till några färdplansserier</option>
                }
              </select>
            </label>

            {/* TODO: Add to infobubble
            <p>Saknas färdplansserien du söker efter? Kolla att du har tillgång till den eller <Link href={`/metaRoadmap/createMetaRoadmap`}>skapa en ny färdplansserie</Link></p>
            */}
            {metaRoadmapTarget?.roadmapVersions.length && (
              <>
                <label htmlFor="targetVersion">Version av färdplansserien {`"${metaRoadmapTarget.name}"`} den här färdplanen arbetar mot</label>
                <select name="targetVersion" id="targetVersion" required defaultValue={currentRoadmap?.targetVersion || ""} onChange={(e) => setTargetVersion(parseInt(e.target.value) || null)}>
                  <option value="">Inget alternativ valt</option>
                  <option value={0}>Alltid senaste versionen</option>
                  {metaRoadmapTarget.roadmapVersions.map((version) => {
                    return (
                      <option key={version.version} value={version.version}>{`Version ${version.version}`}</option>
                    )
                  })}
                </select>
              </>
            )}
          </>
          : null
        }

        <fieldset className={`${styles.timeLineFieldset} width-100`}>
          <legend data-position='1' className={`${styles.timeLineLegend} font-weight-bold`}>Beskriv färdplanens version</legend>
          <label className="block margin-block-100">
            Extra beskrivning av den här versionen av färdplanen
            <textarea className="margin-block-25" name="description" id="description" defaultValue={currentRoadmap?.description ?? undefined}></textarea>
          </label>
        </fieldset>

        {/* TODO: Add option to inherit some/all goals from previous versions of same roadmap */}
        {/* TODO: Add checkboxes for inheriting some/all goals from another roadmap (not the target) with `inheritFromID` */}
        {/* TODO: Allow choosing which roadmap to inherit from, might be different from target */}
        {inheritableGoals.length > 0 && (
          <>
            <fieldset>
              <legend>Välj mål att ärva från färdplanen</legend>
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
          </>
        )}

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position='2' className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>Ladda upp målbanor</legend>
          <label className="block margin-bottom-100">
            {/*TODO: Add to infobubble
            Om du har en CSV-fil med målbanor kan du ladda upp den här. <br />
            Notera att det här skapar nya målbanor även om det redan finns några. */}
            Målbanor <small> - accepterade filtyper: .csv, accepterad encoding: UTF-8</small>
            <input className="margin-block-25" type="file" name="csvUpload" id="csvUpload" accept=".csv" onChange={(e) => e.target.files ? setCurrentFile(e.target.files[0]) : setCurrentFile(null)} />
          </label>
        </fieldset>

        {(!currentRoadmap || user?.isAdmin || user?.id === currentRoadmap.authorId) &&
          <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
            <legend data-position='3' className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>Justera läsbehörighet</legend>
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
            <legend data-position='4' className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>Justera redigeringsbehörighet</legend>
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
          value={currentRoadmap ? 'Spara' : 'Skapa färdplan'}
          disabled={isLoading}
        />
      </form>
    </>
  )
}