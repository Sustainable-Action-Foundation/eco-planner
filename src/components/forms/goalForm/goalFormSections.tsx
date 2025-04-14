"use client";

import { clientSafeGetOneGoal } from "@/fetchers/getOneGoal";
import { clientSafeGetOneRoadmap } from "@/fetchers/getOneRoadmap";
import type getRoadmaps from "@/fetchers/getRoadmaps";
import { clientSafeGetRoadmaps } from "@/fetchers/getRoadmaps";
import mathjs from "@/math";
import { dataSeriesDataFieldNames } from "@/types";
import { DataSeries, Goal } from "@prisma/client";
import { Fragment, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { dataSeriesPattern } from "./goalForm";
import styles from "./goalForm.module.css";

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
  const { t } = useTranslation();
  const [parsedUnit, setParsedUnit] = useState<string | null>(null);
  const [dataSeriesValues, setDataSeriesValues] = useState<string[]>(
    dataSeriesString?.split(/[\t;]/) ?? [""]
  );
  const isPasting = useRef(false);

  useEffect(() => {
    if (currentGoal?.dataSeries?.unit) {
      try {
        setParsedUnit(mathjs.unit(currentGoal.dataSeries.unit).toString());
      } catch {
        setParsedUnit(null)
      }
    }
  }, [currentGoal]);

  useEffect(() => {
    // console.log("Data series values changed:", dataSeriesValues);
  }, [dataSeriesValues]);

  function isValidSingleInputForGrid(char: string): boolean {
    // For onBeforeInput – blocks invalid keystrokes
    return /^[0-9.,]+$/.test(char);
  }
  function isValidSingleInputForTextField(char: string): boolean {
    // For onBeforeInput – blocks invalid keystrokes
    return /^[0-9;\t\b.,]$/.test(char);
  }

  function isValidPastedInput(text: string): boolean {
    // For onPaste – allows numbers, semicolons, tabs, whitespace, and newlines
    return /^[0-9;\t\n\r\s.,]+$/.test(text);
  }

  function handleValueChange(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    if (isPasting.current) return;

    const newValues = [...dataSeriesValues];
    newValues[index] = e.target.value;
    setDataSeriesValues(newValues);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, startIndex: number) {
    isPasting.current = true;
    const clipboardText = e.clipboardData.getData("text");
    const pastedValues = clipboardText.split(/[\t;]/);

    const newValues = [...dataSeriesValues];

    for (let i = 0; i < pastedValues.length && i + startIndex < dataSeriesDataFieldNames.length; i++) {
      const targetIndex = startIndex + i;
      if (targetIndex < newValues.length) {
        newValues[targetIndex] = pastedValues[i].trim();
      } else {
        newValues.push(pastedValues[i].trim());
      }
    }

    setDataSeriesValues(newValues);

    setTimeout(() => {
      isPasting.current = false;
    }, 0);
  }

  return (
    <>
      <label className="block margin-bottom-100">
        {t("forms:goal.leap_parameter")}
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required id="indicatorParameter" defaultValue={currentGoal?.indicatorParameter || undefined} />
      </label>

      <label className="block margin-block-100">
        {t("forms:goal.data_unit")}
        <input className="margin-block-25" type="text" name="dataUnit" required id="dataUnit" defaultValue={currentGoal?.dataSeries?.unit} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-block-25">{t("forms:goal.unit_interpreted_as")} <strong>{parsedUnit}</strong></p>
          : <p className="margin-block-25">{t("forms:goal.unit_not_interpreted")}</p>
        }
      </label>

      { /* Use grid input here */ }
      <details className="margin-block-75">
        <summary>
          {t("forms:goal.extra_info_data_series")}
        </summary>
        <p>
          <Trans
            i18nKey={"forms:goal.data_series_info"}
            components={{ strong: <strong />, br: <br /> }}
          />
          {/* The &quot;Data series&quot; field accepts a series of values separated by semicolons or tabs, which means you can paste a series of values from Excel or similar.<br />
          <strong>NOTE: Values must not be separated by commas (&quot;,&quot;).</strong><br />
          Decimal numbers can use either decimal points or decimal commas.<br />
          The first value represents the year 2020 and the series can continue up to the year 2050 (a total of 31 values).<br />
          If values are missing for a year, you can leave it blank, for example &quot;;1;;;;5&quot; can be used to specify the values 1 and 5 for the years 2021 and 2025. */}
        </p>
      </details>

      <label className="block margin-block-75">
        {t("forms:goal.data_series")}
        {/* TODO: Make this allow .csv files and possibly excel files */}
        <div style={{ border: "1px solid var(--gray-90)", padding: ".25rem", borderRadius: "0.25rem", maxWidth: "48.5rem" }}>
          <div id="inputGrid" className={`${styles.sideScroll}`} style={{ display: "grid", gridTemplateColumns: `repeat(${dataSeriesValues.length}, 1fr)`, gap: "0rem", gridTemplateRows: "auto", borderRadius: "0.25rem" }}>
            {dataSeriesValues.map((value, index) => index < dataSeriesDataFieldNames.length && (
              <div key={`column-${index}`}>
                <label htmlFor={dataSeriesDataFieldNames[index]} className="padding-25">{dataSeriesDataFieldNames[index].replace("val", "")}</label>
                <input
                  type="number"
                  id={dataSeriesDataFieldNames[index]}
                  name="dataSeriesInput"
                  value={value}
                  onChange={(e) => handleValueChange(e, index)}
                  onBeforeInput={(e) => {
                    const inputEvent = e.nativeEvent as InputEvent;
                    if (inputEvent.data && !isValidSingleInputForGrid(inputEvent.data)) {
                      e.preventDefault();
                    }
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    if (!isValidPastedInput(pasted)) {
                      e.preventDefault();
                    } else {
                      handlePaste(e, index); // TODO - pass text instead of event
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </label>
      <details className="margin-block-75">
        <summary>
          Advanced {/* TODO - translate */}
        </summary>
        <p>
          {/* TODO - translate (data series text field info) */}
          <Trans
            i18nKey={"forms:goal.data_series_info"}
            components={{ strong: <strong />, br: <br /> }}
          />
        </p>
        <label className="block margin-block-75">
          {t("forms:goal.data_series")}
          <input type="text" name="dataSeries" required id="dataSeries"
            pattern={dataSeriesPattern}
            title={t("forms:goal.data_series_title")}
            value={dataSeriesValues.join(";")}
            className="margin-block-25"
            onBeforeInput={(e) => {
              if (isPasting.current) return;

              const inputEvent = e.nativeEvent as InputEvent;
              if (inputEvent.data && !isValidSingleInputForTextField(inputEvent.data)) {
                e.preventDefault();
              }
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (!isValidPastedInput(pasted)) {
                e.preventDefault();
                return;
              }

              isPasting.current = true;
              setTimeout(() => {
                isPasting.current = false;
              }, 0);
            }}
            onChange={(e) => {
              const values = e.target.value
                .split(/[\t;]/)
                .map((v) => v.trim())
                .slice(0, dataSeriesDataFieldNames.length);
              setDataSeriesValues(values);
            }}
          />
        </label>
      </details>
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
  const { t } = useTranslation();
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
        {t("forms:goal.select_roadmap_version")}
        <select name="selectedRoadmap" id="selectedRoadmap" className="margin-inline-25" required
          value={selectedRoadmap}
          onChange={(e) => { setSelectedRoadmap(e.target.value); setSelectedGoal(undefined) }}
        >
          <option value="">{t("forms:goal.select_roadmap_version")}</option>
          {roadmapAlternatives.map((roadmap) => (
            <option value={roadmap.id} key={`roadmap-inherit${roadmap.id}`}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${t("common:count.goal", { count: roadmap._count.goals })}`}
            </option>
          ))}
        </select>
      </label>

      {roadmapData &&
        <label className="block margin-block-75">
          {t("forms:goal.select_goal_to_inherit")}
          <select name="inheritFrom" id="inheritFrom" className="margin-inline-25" required
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
          >
            <option value="">{t("forms:goal.select_goal")}</option>
            {roadmapData?.goals.map((goal) => (
              <option value={goal.id} key={`inherit-${goal.id}`}>
                {`${goal.name ?? t("forms:goal.unnamed_goal")}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || t("forms:goal.unit_missing")})`}
              </option>
            ))}
          </select>
        </label>
      }

      <label className="block margin-block-75">
        {t("forms:goal.leap_parameter")}
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required disabled id="indicatorParameter" value={goalData?.indicatorParameter || ""} />
      </label>

      <label className="block margin-block-75">
        {t("forms:goal.data_unit")}
        <input className="margin-block-25" type="text" name="dataUnit" required disabled id="dataUnit" value={goalData?.dataSeries?.unit || ""} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-block-25">{t("forms:goal.unit_interpreted_as")} <strong>{parsedUnit}</strong></p>
          : <p className="margin-block-25">{t("forms:goal.unit_not_interpreted")}</p>
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
  const { t } = useTranslation();
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
        {t("forms:goal.leap_parameter")}
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required id="indicatorParameter" defaultValue={currentGoal?.indicatorParameter || undefined} />
      </label>

      <label className="block margin-block-75">
        {t("forms:goal.data_unit")}
        <input className="margin-block-25" type="text" name="dataUnit" required id="dataUnit" defaultValue={currentGoal?.dataSeries?.unit} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-block-25">{t("forms:goal.unit_interpreted_as")} <strong>{parsedUnit}</strong></p>
          : <p className="margin-block-25">{t("forms:goal.unit_not_interpreted")}</p>
        }
      </label>

      <fieldset className="padding-50 smooth position-relative" style={{ border: '1px solid var(--gray-90)' }}>
        <legend className="padding-25">
          {t("forms:goal.select_goals_to_combine")}
        </legend>
        <Trans
          i18nKey={"forms:goal.search_tip"}
          components={{ kbd: <kbd /> }}
        />
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
                {`${goal.name ?? t("forms:goal.unnamed_goal")}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || t("forms:goal.unit_missing")})`}
              </label>
              {/* TODO: marginLeft: 25? What? */}
              {inheritFrom?.includes(goal.id) &&
                <label className="block margin-block-25" style={{ marginLeft: 25 }}>
                  <input type="checkbox" name="invert-inherit" className="margin-inline-25" value={goal.id}
                    defaultChecked={currentGoal?.combinationParents.some((parent) => parent.parentGoal.id == goal.id && parent.isInverted)}
                  />
                  {t("forms:goal.invert_goal")}
                </label>
              }
            </Fragment>
        ))}
      </fieldset>
    </>
  )
}

export function InheritingBaseline() {
  const { t } = useTranslation();
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
        {t("forms:goal.select_roadmap_version")}
        <select name="selectedRoadmap" id="selectedRoadmap" className="margin-inline-25" required
          value={selectedRoadmap}
          onChange={(e) => { setSelectedRoadmap(e.target.value); setSelectedGoal(undefined) }}
        >
          <option value="">{t("forms:goal.select_roadmap_version")}</option>
          {roadmapList.map((roadmap) => (
            <option value={roadmap.id} key={`roadmap-inherit${roadmap.id}`}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${t("common:count.goal", { count: roadmap._count.goals })}`}
            </option>
          ))}
        </select>
      </label>

      {roadmapData &&
        <label className="block margin-block-75">
          {t("forms:goal.select_goal_as_baseline")}
          <select name="inheritFrom" id="inheritFrom" className="margin-inline-25" required
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
          >
            <option value="">{t("forms:goal.select_goal")}</option>
            {roadmapData?.goals.map((goal) => (
              <option value={goal.id} key={`inherit-${goal.id}`} disabled={!goal.dataSeries}>
                {`${(!goal.dataSeries) ? t("forms:goal.data_missing") : ""}${goal.name ?? t("forms:goal.unnamed_goal")}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || t("forms:goal.unit_missing")})`}
              </option>
            ))}
          </select>
        </label>
      }

      {goalData &&
        <label className="block margin-block-75">
          {t("forms:goal.baseline_copied")}
          <input name="baselineDataSeries" id="baselineDataSeries" type="text" readOnly value={dataSeriesString} />
        </label>
      }
    </>
  )
}