"use client";

import clientSafeGetOneGoal from "@/fetchers/clientSafeGetOneGoal";
import clientSafeGetOneRoadmap from "@/fetchers/clientSafeGetOneRoadmap";
import clientSafeGetRoadmaps from "@/fetchers/clientSafeGetRoadmaps";
import mathjs, { allOurUnits } from "@/math";
import { DataSeries, Goal } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import DateValuesInput from "../elements/dataSeriesInput/dataSeriesInput";
import TextSingleAutocomplete from "../elements/combobox/textSingleAutocomplete";
import parameterOptions from "@/lib/LEAPList.json" with { type: "json" };

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

  const indicatorParameters = useMemo(() => {
    return [...new Set(parameterOptions)].map(option => ({
      name: option,
      value: option
    }));
  }, []);

  const units = useMemo(
    () => allOurUnits.map(unit => ({ name: unit, value: unit })),
    []
  );

  return (
    <>
      <label htmlFor="indicatorParameter">
        {t("forms:goal.leap_parameter")}
      </label>
      <TextSingleAutocomplete
        props={{
          id: "indicatorParameter",
          name: "indicatorParameter",
          placeholder: t("forms:combobox.default_autocomplete_placeholder"),
          className: "margin-top-25 margin-bottom-100",
          defaultValue: currentGoal?.indicatorParameter ?? undefined
        }}
        options={indicatorParameters}
        fuseOptions={{
          threshold: 0.3,
          ignoreLocation: true,
          minMatchCharLength: 2,
        }}
      />

      <label htmlFor="dataUnit">
        {t("forms:goal.data_unit")}
      </label>
      <TextSingleAutocomplete
        props={{
          id: "dataUnit",
          name: "dataUnit",
          placeholder: t("forms:combobox.default_autocomplete_placeholder"),
          className: "margin-top-25",
          defaultValue: currentGoal?.dataSeries?.unit ?? undefined
        }}
        options={units}
        onChange={(unit) => {
          try {
            setParsedUnit(mathjs.unit(unit).toString())
          } catch {
            setParsedUnit(null);
          }
        }}
      />
      <small className="block margin-top-25 margin-bottom-100 font-style-italic" style={{ height: '20px' }}>
        {parsedUnit === null && t("forms:goal.unit_not_interpreted")}

        {parsedUnit && (
          <>
            {t("forms:goal.unit_interpreted_as")} <strong>{parsedUnit}</strong>
          </>
        )}
      </small>

      <DateValuesInput
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