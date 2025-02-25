'use client';

import { clientSafeGetOneGoal } from "@/fetchers/getOneGoal";
import { clientSafeGetOneRoadmap } from "@/fetchers/getOneRoadmap";
import type getRoadmaps from "@/fetchers/getRoadmaps";
import { clientSafeGetRoadmaps } from "@/fetchers/getRoadmaps";
import { LocaleContext } from "@/app/context/localeContext.tsx";
import mathjs from "@/math";
import { dataSeriesDataFieldNames } from "@/types";
import { DataSeries, Goal } from "@prisma/client";
import { Fragment, useContext, useEffect, useState } from "react";
import { dataSeriesPattern } from "./goalForm";
import dict from "./goalFormSections.dict.json" with { type: "json" };

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
  const locale = useContext(LocaleContext);

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
        {dict.manualGoalForm.leapParameter[locale]}
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required id="indicatorParameter" defaultValue={currentGoal?.indicatorParameter || undefined} />
      </label>

      <label className="block margin-block-100">
        {dict.manualGoalForm.unit.unit[locale]}
        <input className="margin-block-25" type="text" name="dataUnit" required id="dataUnit" defaultValue={currentGoal?.dataSeries?.unit} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-block-25">{dict.manualGoalForm.unit.parseAs[locale]} <strong>{parsedUnit}</strong></p>
          : <p className="margin-block-25">{dict.manualGoalForm.unit.parseError[locale]}</p>
        }
      </label>

      <details className="margin-block-75">
        <summary>
          {dict.manualGoalForm.extraInfo.extraInfo[locale]}
        </summary>
        <p>
          {dict.manualGoalForm.extraInfo.infoDescription[locale]}
        </p>
      </details>

      <label className="block margin-block-75">
        {dict.manualGoalForm.dataSeries.dataSeries[locale]}
        {/* TODO: Make this allow .csv files and possibly excel files */}
        <input type="text" name="dataSeries" required id="dataSeries"
          pattern={dataSeriesPattern}
          title={dict.manualGoalForm.dataSeries.input.title[locale]}
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
  const locale = useContext(LocaleContext);

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
        {dict.inheritedGoalForm.roadmapVersion.chooseToInheritFrom[locale]}
        <select name="selectedRoadmap" id="selectedRoadmap" className="margin-inline-25" required
          value={selectedRoadmap}
          onChange={(e) => { setSelectedRoadmap(e.target.value); setSelectedGoal(undefined) }}
        >
          <option value="">{dict.inheritedGoalForm.roadmapVersion.choose[locale]}</option>
          {roadmapAlternatives.map((roadmap) => (
            <option value={roadmap.id} key={`roadmap-inherit${roadmap.id}`}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.goals} ${dict.inheritedGoalForm.roadmapVersion.goal[locale]}`}
            </option>
          ))}
        </select>
      </label>

      {roadmapData &&
        <label className="block margin-block-75">
          {dict.inheritedGoalForm.roadmapData.chooseToInheritFrom[locale]}
          <select name="inheritFrom" id="inheritFrom" className="margin-inline-25" required
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
          >
            <option value="">{dict.inheritedGoalForm.roadmapData.choose[locale]}</option>
            {roadmapData?.goals.map((goal) => (
              <option value={goal.id} key={`inherit-${goal.id}`}>
                {`${goal.name ?? dict.inheritedGoalForm.roadmapData.namelessGoal[locale]}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || dict.inheritedGoalForm.roadmapData.unitMissing[locale]})`}
              </option>
            ))}
          </select>
        </label>
      }

      <label className="block margin-block-75">
        {dict.inheritedGoalForm.leapParameter[locale]}
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required disabled id="indicatorParameter" value={goalData?.indicatorParameter || ""} />
      </label>

      <label className="block margin-block-75">
        {dict.inheritedGoalForm.unit.unit[locale]}
        <input className="margin-block-25" type="text" name="dataUnit" required disabled id="dataUnit" value={goalData?.dataSeries?.unit || ""} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-block-25">{dict.inheritedGoalForm.unit.parseAs[locale]} <strong>{parsedUnit}</strong></p>
          : <p className="margin-block-25">{dict.inheritedGoalForm.unit.parseError[locale]}</p>
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
  const locale = useContext(LocaleContext);

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
        {dict.combinedGoalForm.leapParameter[locale]}
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required id="indicatorParameter" defaultValue={currentGoal?.indicatorParameter || undefined} />
      </label>

      <label className="block margin-block-75">
        {dict.combinedGoalForm.unit.unit[locale]}
        <input className="margin-block-25" type="text" name="dataUnit" required id="dataUnit" defaultValue={currentGoal?.dataSeries?.unit} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-block-25">{dict.combinedGoalForm.unit.parseAs[locale]} <strong>{parsedUnit}</strong></p>
          : <p className="margin-block-25">{dict.combinedGoalForm.unit.parseError[locale]}</p>
        }
      </label>

      <fieldset className="padding-50 smooth position-relative" style={{ border: '1px solid var(--gray-90)' }}>
        <legend className="padding-25">
          {dict.combinedGoalForm.goals.chooseGoals[locale]}
        </legend>
        <p>{dict.combinedGoalForm.goals.tip[locale]}</p>
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
                {`${goal.name ?? dict.combinedGoalForm.goals.namelessGoal[locale]}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || dict.combinedGoalForm.goals.unitMissing[locale]})`}
              </label>
              {/* TODO: marginLeft: 25? What? */}
              {inheritFrom?.includes(goal.id) &&
                <label className="block margin-block-25" style={{ marginLeft: 25 }}>
                  <input type="checkbox" name="invert-inherit" className="margin-inline-25" value={goal.id}
                    defaultChecked={currentGoal?.combinationParents.some((parent) => parent.parentGoal.id == goal.id && parent.isInverted)}
                  />
                  {dict.combinedGoalForm.goals.invertGoal[locale]}
                </label>
              }
            </Fragment>
        ))}
      </fieldset>
    </>
  )
}

export function InheritingBaseline() {
  const locale = useContext(LocaleContext);

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
        {dict.inheritingBaseline.roadmapVersion.chooseToInheritFrom[locale]}
        <select name="selectedRoadmap" id="selectedRoadmap" className="margin-inline-25" required
          value={selectedRoadmap}
          onChange={(e) => { setSelectedRoadmap(e.target.value); setSelectedGoal(undefined) }}
        >
          <option value="">{dict.inheritingBaseline.roadmapVersion.choose[locale]}</option>
          {roadmapList.map((roadmap) => (
            <option value={roadmap.id} key={`roadmap-inherit${roadmap.id}`}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.goals} ${dict.inheritingBaseline.roadmapVersion.goal[locale]}`}
            </option>
          ))}
        </select>
      </label>

      {roadmapData &&
        <label className="block margin-block-75">
          {dict.inheritingBaseline.roadmapData.chooseToUseAsBaseline[locale]}
          <select name="inheritFrom" id="inheritFrom" className="margin-inline-25" required
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
          >
            <option value="">{dict.inheritingBaseline.roadmapData.choose[locale]}</option>
            {roadmapData?.goals.map((goal) => (
              <option value={goal.id} key={`inherit-${goal.id}`} disabled={!goal.dataSeries}>
                {`${(!goal.dataSeries) ? dict.inheritingBaseline.roadmapData.dataMissing[locale] : ""}${goal.name ?? dict.inheritingBaseline.roadmapData.namelessGoal[locale]}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || dict.inheritingBaseline.roadmapData.unitMissing[locale]})`}
              </option>
            ))}
          </select>
        </label>
      }

      {goalData &&
        <label className="block margin-block-75">
          {dict.inheritingBaseline.goalData.basline[locale]}
          <input name="baselineDataSeries" id="baselineDataSeries" type="text" readOnly value={dataSeriesString} />
        </label>
      }
    </>
  )
}