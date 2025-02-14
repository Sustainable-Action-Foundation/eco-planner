'use client';

import { DataSeries, Goal } from "@prisma/client";
import { dataSeriesPattern } from "./goalForm";
import { Fragment, useEffect, useState } from "react";
import { clientSafeGetOneRoadmap } from "@/fetchers/getOneRoadmap";
import { clientSafeGetOneGoal } from "@/fetchers/getOneGoal";
import { clientSafeGetRoadmaps } from "@/fetchers/getRoadmaps";
import type getRoadmaps from "@/fetchers/getRoadmaps";
import mathjs from "@/math";
import { dataSeriesDataFieldNames } from "@/types";

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
      <label className="block margin-bottom-100">
        LEAP parameter
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required id="indicatorParameter" defaultValue={currentGoal?.indicatorParameter || undefined} />
      </label>

      <label className="block margin-block-100">
        Enhet för dataserie
        <input className="margin-block-25" type="text" name="dataUnit" required id="dataUnit" defaultValue={currentGoal?.dataSeries?.unit} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-block-25">Enheten tolkas som: <strong>{parsedUnit}</strong></p>
          : <p className="margin-block-25">Enheten kunde inte tolkas. Du kan fortfarande spara målbanan, men viss funktionalitet kan saknas.</p>
        }
      </label>

      <details className="margin-block-75">
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

      <label className="block margin-block-75">
        Dataserie
        {/* TODO: Make this allow .csv files and possibly excel files */}
        <input type="text" name="dataSeries" required id="dataSeries"
          pattern={dataSeriesPattern}
          title="Använd numeriska värden separerade med semikolon eller tab. Decimaltal kan använda antingen punkt eller komma."
          className="margin-block-25"
          defaultValue={dataSeriesString}
        />
      </label>
    </>
  )
}

export function InheritedGoalForm({
  currentGoal,
  roadmapAlternatives,
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
  roadmapAlternatives: Awaited<ReturnType<typeof getRoadmaps>>,
}) {
  const [selectedRoadmap, setSelectedRoadmap] = useState(currentGoal?.combinationParents[0]?.parentGoal.roadmapId);
  const [roadmapData, setRoadmapData] = useState<Awaited<ReturnType<typeof clientSafeGetOneRoadmap>>>(null);
  const [selectedGoal, setSelectedGoal] = useState(currentGoal?.combinationParents[0]?.parentGoal.id);
  const [goalData, setGoalData] = useState<Awaited<ReturnType<typeof clientSafeGetOneGoal>>>(null);
  const [parsedUnit, setParsedUnit] = useState<string | null>(null);

  useEffect(() => {
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
    clientSafeGetOneRoadmap(selectedRoadmap ?? "").then(setRoadmapData);
  }, [selectedRoadmap]);

  useEffect(() => {
    clientSafeGetOneGoal(selectedGoal ?? "").then(setGoalData)
  }, [selectedGoal]);
  return (
    <>
      <label className="block margin-block-75">
        Välj en färdplansversion att ärva en målbana från
        <select name="selectedRoadmap" id="selectedRoadmap" className="margin-inline-25" required
          value={selectedRoadmap}
          onChange={(e) => { setSelectedRoadmap(e.target.value); setSelectedGoal(undefined) }}
        >
          <option value="">Välj färdplansversion</option>
          {roadmapAlternatives.map((roadmap) => (
            <option value={roadmap.id} key={`roadmap-inherit${roadmap.id}`}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.goals} mål`}
            </option>
          ))}
        </select>
      </label>

      {roadmapData &&
        <label className="block margin-block-75">
          Välj en målbana att ärva från
          <select name="inheritFrom" id="inheritFrom" className="margin-inline-25" required
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
          >
            <option value="">Välj målbana</option>
            {roadmapData?.goals.map((goal) => (
              <option value={goal.id} key={`inherit-${goal.id}`}>
                {`${goal.name ?? "Namnlöst mål"}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || "Enhet saknas"})`}
              </option>
            ))}
          </select>
        </label>
      }

      <label className="block margin-block-75">
        LEAP parameter
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required disabled id="indicatorParameter" value={goalData?.indicatorParameter || ""} />
      </label>

      <label className="block margin-block-75">
        Enhet för dataserie
        <input className="margin-block-25" type="text" name="dataUnit" required disabled id="dataUnit" value={goalData?.dataSeries?.unit || ""} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-block-25">Enheten tolkas som: <strong>{parsedUnit}</strong></p>
          : <p className="margin-block-25">Enheten kunde inte tolkas. Du kan fortfarande spara målbanan, men viss funktionalitet kan saknas.</p>
        }
      </label>
    </>
  )
}

export function CombinedGoalForm({
  roadmapId,
  currentGoal,
}: {
  roadmapId?: string,
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
  const [currentRoadmap, setCurrentRoadmap] = useState<Awaited<ReturnType<typeof clientSafeGetOneRoadmap>>>(null);
  const [inheritFrom, setInheritFrom] = useState<string[]>([]);
  const [parsedUnit, setParsedUnit] = useState<string | null>(null);

  useEffect(() => {
    clientSafeGetOneRoadmap(roadmapId || '').then(setCurrentRoadmap);
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
      <label className="block margin-block-75">
        LEAP parameter
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required id="indicatorParameter" defaultValue={currentGoal?.indicatorParameter || undefined} />
      </label>

      <label className="block margin-block-75">
        Enhet för dataserie
        <input className="margin-block-25" type="text" name="dataUnit" required id="dataUnit" defaultValue={currentGoal?.dataSeries?.unit} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-block-25">Enheten tolkas som: <strong>{parsedUnit}</strong></p>
          : <p className="margin-block-25">Enheten kunde inte tolkas. Du kan fortfarande spara målbanan, men viss funktionalitet kan saknas.</p>
        }
      </label>

      <fieldset className="padding-50 smooth position-relative" style={{ border: '1px solid var(--gray-90)' }}>
        <legend className="padding-25">
          Välj målbanor i den aktuella färdplansversionen att kombinera
        </legend>
        <p>Tips: använd <kbd><kbd>CTRL</kbd> + <kbd>F</kbd></kbd> för att hitta målbanorna du söker efter</p>
        {currentRoadmap?.goals.map((goal) => (
          goal.id == currentGoal?.id ? null :
            <Fragment key={`combine-${goal.id}`}>
              <label className="block margin-block-25">
                <input type="checkbox" name="inheritFrom" className="margin-inline-25" value={goal.id}
                  defaultChecked={currentGoal?.combinationParents.some((parent) => parent.parentGoal.id == goal.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setInheritFrom([...inheritFrom, e.target.value]);
                    } else {
                      setInheritFrom(inheritFrom.filter((id) => id != e.target.value));
                    }
                  }}
                />
                {`${goal.name ?? "Namnlöst mål"}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || "Enhet saknas"})`}
              </label>
              {/* TODO: marginLeft: 25? What? */}
              {inheritFrom?.includes(goal.id) &&
                <label className="block margin-block-25" style={{ marginLeft: 25 }}>
                  <input type="checkbox" name="invert-inherit" className="margin-inline-25" value={goal.id}
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

export function InheritingBaseline() {
  const [roadmapList, setRoadmapList] = useState<Awaited<ReturnType<typeof clientSafeGetRoadmaps>>>([]);
  const [selectedRoadmap, setSelectedRoadmap] = useState<string | undefined>(undefined);
  const [roadmapData, setRoadmapData] = useState<Awaited<ReturnType<typeof clientSafeGetOneRoadmap>>>(null);
  const [selectedGoal, setSelectedGoal] = useState<string | undefined>(undefined);
  const [goalData, setGoalData] = useState<Awaited<ReturnType<typeof clientSafeGetOneGoal>>>(null);

  useEffect(() => {
    clientSafeGetRoadmaps().then(setRoadmapList);
  }, []);

  useEffect(() => {
    clientSafeGetOneRoadmap(selectedRoadmap ?? "").then(setRoadmapData);
  }, [selectedRoadmap]);

  useEffect(() => {
    clientSafeGetOneGoal(selectedGoal ?? "").then(setGoalData)
  }, [selectedGoal]);

  // If there is a data series, convert it to an array of numbers and then a string to use for the form
  const dataArray: (number | null)[] = []
  if (goalData?.dataSeries) {
    for (const i of dataSeriesDataFieldNames) {
      dataArray.push(goalData.dataSeries[i])
    }
  }
  const dataSeriesString = dataArray.join(';')

  return (
    <>
      <label className="block margin-block-75">
        Välj en färdplansversion att hämta målbanan från
        <select name="selectedRoadmap" id="selectedRoadmap" className="margin-inline-25" required
          value={selectedRoadmap}
          onChange={(e) => { setSelectedRoadmap(e.target.value); setSelectedGoal(undefined) }}
        >
          <option value="">Välj färdplansversion</option>
          {roadmapList.map((roadmap) => (
            <option value={roadmap.id} key={`roadmap-inherit${roadmap.id}`}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.goals} mål`}
            </option>
          ))}
        </select>
      </label>

      {roadmapData &&
        <label className="block margin-block-75">
          Välj en målbana att använda som baslinje (värdena kopieras snarare än att länkas)
          <select name="inheritFrom" id="inheritFrom" className="margin-inline-25" required
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
          >
            <option value="">Välj målbana</option>
            {roadmapData?.goals.map((goal) => (
              <option value={goal.id} key={`inherit-${goal.id}`} disabled={!goal.dataSeries}>
                {`${(!goal.dataSeries) ? "DATA SAKNAS; " : ""}${goal.name ?? "Namnlöst mål"}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || "Enhet saknas"})`}
              </option>
            ))}
          </select>
        </label>
      }

      {goalData &&
        <label className="block margin-block-75">
          Baslinje, kopierad från vald målbana
          <input name="baselineDataSeries" id="baselineDataSeries" type="text" readOnly value={dataSeriesString} />
        </label>
      }
    </>
  )
}