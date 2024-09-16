'use client';

import { DataSeries, Goal } from "@prisma/client";
import { dataSeriesPattern } from "./goalForm";
import { Fragment, useEffect, useState } from "react";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import getOneGoal from "@/fetchers/getOneGoal";
import getRoadmaps from "@/fetchers/getRoadmaps";
import mathjs from "@/math";

export function ManualGoalForm({
  currentGoal,
  dataSeriesString,
}: {
  currentGoal?: Goal & {
    dataSeries: DataSeries | null,
    combinationScale: string | null,
    combinationParents: {
      isInverted: boolean,
      parentGoal: {
        dataSeries: DataSeries | null
      }
    }[],
    author: { id: string, username: string },
    links?: { url: string, description: string | null }[],
    roadmap: { id: string },
  },
  dataSeriesString?: string,
}) {
  const [parsedUnit, setParsedUnit] = useState<string | null>(null);

  useEffect(() => {
    if (currentGoal?.dataSeries?.unit) {
      try {
        setParsedUnit(mathjs.unit(currentGoal.dataSeries.unit).toString());
      } catch {
        setParsedUnit(null)
      }
    }
  }, [currentGoal]);

  return (
    <>
      <label className="block margin-y-75">
        LEAP parameter:
        <input className="margin-y-25" type="text" list="LEAPOptions" name="indicatorParameter" required id="indicatorParameter" defaultValue={currentGoal?.indicatorParameter || undefined} />
      </label>

      <label className="block margin-y-75">
        Enhet för dataserie:
        <input className="margin-y-25" type="text" name="dataUnit" required id="dataUnit" defaultValue={currentGoal?.dataSeries?.unit} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-y-25">Enheten tolkas som: <strong>{parsedUnit}</strong></p>
          : <p className="margin-y-25">Enheten kunde inte tolkas. Du kan fortfarande spara målbanan, men viss funktionalitet kan saknas.</p>
        }
      </label>

      <details className="margin-y-75">
        <summary>
          Extra information om dataserie
        </summary>
        <p>
          Fältet &quot;Dataserie&quot; tar emot en serie värden separerade med semikolon eller tab, vilket innebär att du kan klistra in en serie värden från Excel eller liknande.<br />
          <strong>OBS: Värden får inte vara separerade med komma (&quot;,&quot;).</strong><br />
          Decimaltal kan använda antingen decimalpunkt eller decimalkomma.<br />
          Det första värdet representerar år 2020 och serien kan fortsätta maximalt till år 2050 (totalt 31 värden).<br />
          Om värden saknas för ett år kan du lämna det tomt, exempelvis kan &quot;;1;;;;5&quot; användas för att ange värdena 1 och 5 för år 2021 och 2025.
        </p>
      </details>

      <label className="block margin-y-75">
        Dataserie:
        {/* TODO: Make this allow .csv files and possibly excel files */}
        <input type="text" name="dataSeries" required id="dataSeries"
          pattern={dataSeriesPattern}
          title="Använd numeriska värden separerade med semikolon eller tab. Decimaltal kan använda antingen punkt eller komma."
          className="margin-y-25"
          defaultValue={dataSeriesString}
        />
      </label>
    </>
  )
}

export function InheritedGoalForm({
  currentGoal,
}: {
  currentGoal?: Goal & {
    dataSeries: DataSeries | null,
    combinationScale: string | null,
    combinationParents: {
      isInverted: boolean,
      parentGoal: {
        id: string,
        dataSeries: DataSeries | null,
        roadmapId: string,
      }
    }[],
    author: { id: string, username: string },
    links?: { url: string, description: string | null }[],
    roadmap: { id: string },
  },
}) {
  const [roadmapList, setRoadmapList] = useState<Awaited<ReturnType<typeof getRoadmaps>>>([]);
  const [selectedRoadmap, setSelectedRoadmap] = useState(currentGoal?.combinationParents[0]?.parentGoal.roadmapId);
  const [roadmapData, setRoadmapData] = useState<Awaited<ReturnType<typeof getOneRoadmap>>>(null);
  const [selectedGoal, setSelectedGoal] = useState(currentGoal?.combinationParents[0]?.parentGoal.id);
  const [goalData, setGoalData] = useState<Awaited<ReturnType<typeof getOneGoal>>>(null);
  const [parsedUnit, setParsedUnit] = useState<string | null>(null);

  useEffect(() => {
    getRoadmaps().then(setRoadmapList);
    if (currentGoal?.combinationParents[0]?.parentGoal.roadmapId) {
      setSelectedRoadmap(currentGoal.combinationParents[0].parentGoal.roadmapId);
    }
    if (currentGoal?.combinationParents[0]?.parentGoal.id) {
      setSelectedGoal(currentGoal.combinationParents[0].parentGoal.id);
    }
    if (currentGoal?.dataSeries?.unit) {
      try {
        setParsedUnit(mathjs.unit(currentGoal.dataSeries.unit).toString());
      } catch {
        setParsedUnit(null)
      }
    }
  }, [currentGoal]);

  useEffect(() => {
    getOneRoadmap(selectedRoadmap ?? "").then(setRoadmapData);
  }, [selectedRoadmap]);

  useEffect(() => {
    getOneGoal(selectedGoal ?? "").then(setGoalData)
  }, [selectedGoal]);
  return (
    <>
      <label className="block margin-y-75">
        Välj en färdplan att ärva en målbana från:
        <select name="selectedRoadmap" id="selectedRoadmap" className="margin-x-25" required
          value={selectedRoadmap}
          onChange={(e) => { setSelectedRoadmap(e.target.value); setSelectedGoal(undefined) }}
        >
          <option value="">Välj färdplan</option>
          {roadmapList.map((roadmap) => (
            <option value={roadmap.id} key={`roadmap-inherit${roadmap.id}`}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.goals} mål`}
            </option>
          ))}
        </select>
      </label>

      {roadmapData &&
        <label className="block margin-y-75">
          Välj en målbana att ärva från:
          <select name="inheritFrom" id="inheritFrom" className="margin-x-25" required
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
          >
            <option value="">Välj målbana</option>
            {roadmapData?.goals.map((goal) => (
              <option value={goal.id} key={`inherit-${goal.id}`}>
                {`${goal.name ?? "Namnlöst mål"}: ${goal.indicatorParameter}`}
              </option>
            ))}
          </select>
        </label>
      }

      <label className="block margin-y-75">
        LEAP parameter:
        <input className="margin-y-25" type="text" list="LEAPOptions" name="indicatorParameter" required disabled id="indicatorParameter" value={goalData?.indicatorParameter || ""} />
      </label>

      <label className="block margin-y-75">
        Enhet för dataserie:
        <input className="margin-y-25" type="text" name="dataUnit" required disabled id="dataUnit" value={goalData?.dataSeries?.unit || ""} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-y-25">Enheten tolkas som: <strong>{parsedUnit}</strong></p>
          : <p className="margin-y-25">Enheten kunde inte tolkas. Du kan fortfarande spara målbanan, men viss funktionalitet kan saknas.</p>
        }
      </label>
    </>
  )
}

export function CombinedGoalForm({
  roadmapId,
  currentGoal,
}: {
  roadmapId: string,
  currentGoal?: Goal & {
    dataSeries: DataSeries | null,
    combinationScale: string | null,
    combinationParents: {
      isInverted: boolean,
      parentGoal: {
        id: string,
        dataSeries: DataSeries | null,
        roadmapId: string,
      }
    }[],
    author: { id: string, username: string },
    links?: { url: string, description: string | null }[],
    roadmap: { id: string },
  },
}) {
  const [currentRoadmap, setCurrentRoadmap] = useState<Awaited<ReturnType<typeof getOneRoadmap>>>(null);
  const [inheritFrom, setInheritFrom] = useState<string[]>([]);
  const [parsedUnit, setParsedUnit] = useState<string | null>(null);

  useEffect(() => {
    getOneRoadmap(roadmapId).then(setCurrentRoadmap);
  }, [roadmapId]);

  useEffect(() => {
    if (currentGoal?.combinationParents) {
      setInheritFrom(currentGoal.combinationParents.map((parent) => parent.parentGoal.id));
    }
    if (currentGoal?.dataSeries?.unit) {
      try {
        setParsedUnit(mathjs.unit(currentGoal.dataSeries.unit).toString());
      } catch {
        setParsedUnit(null)
      }
    }
  }, [currentGoal]);

  return (
    <>
      <label className="block margin-y-75">
        LEAP parameter:
        <input className="margin-y-25" type="text" list="LEAPOptions" name="indicatorParameter" required id="indicatorParameter" defaultValue={currentGoal?.indicatorParameter || undefined} />
      </label>

      <label className="block margin-y-75">
        Enhet för dataserie:
        <input className="margin-y-25" type="text" name="dataUnit" required id="dataUnit" defaultValue={currentGoal?.dataSeries?.unit} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-y-25">Enheten tolkas som: <strong>{parsedUnit}</strong></p>
          : <p className="margin-y-25">Enheten kunde inte tolkas. Du kan fortfarande spara målbanan, men viss funktionalitet kan saknas.</p>
        }
      </label>

      <fieldset className="padding-50 smooth" style={{ border: '1px solid var(--gray-90)', position: 'relative' }}>
        <legend className="padding-25">
          Välj målbanor i den aktuella färdplanen att kombinera:
        </legend>
        <p>Tips: använd <kbd><kbd>CTRL</kbd> + <kbd>F</kbd></kbd> för att hitta målbanorna du söker efter</p>
        {currentRoadmap?.goals.map((goal) => (
          <Fragment key={`combine-${goal.id}`}>
            <label className="block margin-y-25">
              <input type="checkbox" name="inheritFrom" className="margin-x-25" value={goal.id}
                defaultChecked={currentGoal?.combinationParents.some((parent) => parent.parentGoal.id == goal.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setInheritFrom([...inheritFrom, e.target.value]);
                  } else {
                    setInheritFrom(inheritFrom.filter((id) => id != e.target.value));
                  }
                }}
              />
              {`${goal.name ?? "Namnlöst mål"}: ${goal.indicatorParameter} (${goal.dataSeries?.unit ?? "Enhet saknas"})`}
            </label>
            {inheritFrom?.includes(goal.id) &&
              <label className="block margin-y-25" style={{ marginLeft: 25 }}>
                <input type="checkbox" name="invert-inherit" className="margin-x-25" value={goal.id}
                  defaultChecked={currentGoal?.combinationParents.some((parent) => parent.parentGoal.id == goal.id && parent.isInverted)}
                />
                {"Invertera målet (dividera med denna målbana snarare än att multiplicera)"}
              </label>
            }
          </Fragment>
        ))}
      </fieldset>
    </>
  )
}