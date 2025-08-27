"use client";

import clientSafeGetOneGoal from "@/fetchers/clientSafeGetOneGoal";
import clientSafeGetOneRoadmap from "@/fetchers/clientSafeGetOneRoadmap";
import clientSafeGetRoadmaps from "@/fetchers/clientSafeGetRoadmaps";
import mathjs from "@/math";
import { Years } from "@/types";
import { DataSeries, Goal } from "@prisma/client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DataSeriesInput from "../elements/dataSeriesInput/dataSeriesInput";

export function ManualGoalForm({
  currentGoal,
  dataSeriesString,
}: {
  currentGoal?: Goal & {
    dataSeries: DataSeries | null,
    author: { id: string, username: string },
    links?: { url: string, description: string | null }[],
    roadmap: { id: string },
  },
  dataSeriesString?: string,
}) {
  const { t } = useTranslation("forms");
  const [parsedUnit, setParsedUnit] = useState<string | null>("");

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
        {t("forms:goal.leap_parameter")}
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required id="indicatorParameter" defaultValue={currentGoal?.indicatorParameter || undefined} />
      </label>

      <label className="block margin-block-100">
        {t("forms:goal.data_unit")}
        <input className="margin-block-25" type="text" name="dataUnit" id="dataUnit" defaultValue={currentGoal?.dataSeries?.unit ?? undefined} onChange={(e) => {
          try {
            if (e.target.value === "") {
              setParsedUnit("");
            }
            else {
              setParsedUnit(mathjs.unit(e.target.value).toString());
            }
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit?.length === 0 ? <></> : parsedUnit === null ?
          <small className="margin-block-25 font-style-italic">{t("forms:goal.unit_not_interpreted")}</small>
          :
          <small className="margin-block-25 font-style-italic">{t("forms:goal.unit_interpreted_as")} <strong>{parsedUnit}</strong></small>
        }
      </label>

      <DataSeriesInput
        dataSeriesString={dataSeriesString}
        inputName="dataSeries"
        inputId="dataSeries"
        labelKey="forms:data_series_input.data_series"
      />
    </>
  )
}

/** 
 * TODO: Update to use recipe editor and such fancy new stuff
 */
export function InheritingBaseline() {
  const { t } = useTranslation(["forms", "common"]);
  const [roadmapList, setRoadmapList] = useState<Awaited<ReturnType<typeof clientSafeGetRoadmaps>>>([]);
  const [selectedRoadmap, setSelectedRoadmap] = useState<string | undefined>(undefined);
  const [roadmapData, setRoadmapData] = useState<Awaited<ReturnType<typeof clientSafeGetOneRoadmap>>>(null);
  const [selectedGoal, setSelectedGoal] = useState<string | undefined>(undefined);
  const [goalData, setGoalData] = useState<Awaited<ReturnType<typeof clientSafeGetOneGoal>>>(null);

  useEffect(() => {
    clientSafeGetRoadmaps().then(setRoadmapList).catch(() => {
      setRoadmapList([]);
    });
  }, []);

  useEffect(() => {
    clientSafeGetOneRoadmap(selectedRoadmap ?? "").then(setRoadmapData).catch(() => {
      setRoadmapData(null);
    });
  }, [selectedRoadmap]);

  useEffect(() => {
    clientSafeGetOneGoal(selectedGoal ?? "").then(setGoalData).catch(() => {
      setGoalData(null);
    });
  }, [selectedGoal]);

  // If there is a data series, convert it to an array of numbers and then a string to use for the form
  const dataArray: (number | null)[] = []
  if (goalData?.dataSeries) {
    for (const i of Years) {
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
                {`${(!goal.dataSeries) ? t("forms:goal.data_missing") : ""}${goal.name ?? t("forms:goal.unnamed_goal")}: ${goal.indicatorParameter} (${goal.dataSeries?.unit === null ? t("common:tsx.unitless") : goal.dataSeries?.unit || t("common:tsx.unit_missing")})`}
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