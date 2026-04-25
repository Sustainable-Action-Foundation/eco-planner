"use client";

import mathjs, { allOurUnits } from "@/math";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import TextSingleAutocomplete from "../elements/combobox/textSingleAutocomplete";
import parameterOptions from "@/lib/LEAPList.json" with { type: "json" };
import type { ClientGoal, ClientMultiRoadmapInstance, ClientRoadmap, Goal, UnitString } from "@/types";
import { dataSeriesToDateValues } from "@/functions/recipe/vectorAndMaskUtils";
import { clientSafeGetRoadmaps, clientSafeGetOneRoadmap, clientSafeGetOneGoal } from "@/fetchers/client";
import DataSeriesInputManual from "../elements/dataSeriesInput/dataSeriesInputManual";

export function ManualGoalForm({
  currentGoal,
  outputFormElement,
}: {
  currentGoal?: Goal;
  outputFormElement: React.ReactElement<HTMLInputElement>;
}) {
  const { t } = useTranslation("forms");
  const [parsedUnit, setParsedUnit] = useState<UnitString>(() => {
    if (currentGoal?.dataSeries?.unit) {
      try {
        return mathjs.unit(currentGoal.dataSeries.unit).toString();
      } catch {
        return null;
      }
    }
    return null;
  });

  const indicatorParameters = useMemo(() => {
    return [...new Set(parameterOptions)].map(option => ({
      name: option,
      value: option
    }));
  }, []);

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
        options={allOurUnits.map(u => ({ name: u, value: u }))}
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

      <DataSeriesInputManual
        {...currentGoal?.dataSeries
          ? { initialDateValues: dataSeriesToDateValues(currentGoal.dataSeries) }
          : {}
        }
        outputFormElement={outputFormElement}
      />
    </>
  )
}

export function InheritingBaseline({
  outputFormElement,
}: {
  outputFormElement: React.ReactElement<HTMLInputElement>;
}) {
  const { t } = useTranslation(["forms", "common"]);
  const [roadmapList, setRoadmapList] = useState<ClientMultiRoadmapInstance[]>([]);
  const [selectedRoadmap, setSelectedRoadmap] = useState<string | undefined>(undefined);
  const [roadmapData, setRoadmapData] = useState<ClientRoadmap | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<string | undefined>(undefined);
  const [goalData, setGoalData] = useState<ClientGoal | null>(null);

  useEffect(() => {
    clientSafeGetRoadmaps()
      .then(setRoadmapList)
      .catch(() => {
        setRoadmapList([]);
      });
  }, []);

  useEffect(() => {
    if (!selectedRoadmap) {
      setRoadmapData(null);
      setSelectedGoal(undefined);
      console.warn("No roadmap selected, skipping fetch.");
      return;
    }
    clientSafeGetOneRoadmap(selectedRoadmap)
      .then(setRoadmapData)
      .catch(() => {
        setRoadmapData(null);
      });
  }, [selectedRoadmap]);

  useEffect(() => {
    if (!selectedGoal) {
      setGoalData(null);
      console.warn("No goal selected, skipping fetch.");
      return;
    }
    clientSafeGetOneGoal(selectedGoal)
      .then(setGoalData)
      .catch(() => {
        setGoalData(null);
      });
  }, [selectedGoal]);

  return (
    <>
      {/* Roadmap select */}
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

      {/* Goal select */}
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
          {React.cloneElement(outputFormElement, {
            value: goalData.baseline?.id ?? goalData.dataSeries?.id ?? "",
            type: "hidden",
            hidden: true,
            readOnly: true,
          })}
        </label>
      }
    </>
  )
}