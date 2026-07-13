"use client";


import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ClientGoal } from "@/types";
import type { TreeItem } from "@/components/types";
import { clientSafeGetRoadmaps, clientSafeGetOneRoadmap, clientSafeGetOneGoal } from "@/fetchers/client";
import SelectSingleTree from "../elements/combobox/selectSingleTree";
 
export function InheritingBaseline({
  outputFormElement,
}: {
  outputFormElement: React.ReactElement<HTMLInputElement>;
}) {
  const { t } = useTranslation(["forms", "common"]);
  const [treeItems, setTreeItems] = useState<TreeItem[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<TreeItem | null>(null);
  const [goalData, setGoalData] = useState<ClientGoal | null>(null);

  // Roadmaps are the top-level nodes; each one's goals are fetched lazily
  // the first time it's expanded, via onExpand.
  useEffect(() => {
    clientSafeGetRoadmaps()
      .then((roadmapList) => {
        setTreeItems(
          roadmapList.map((roadmap): TreeItem => ({
            value: roadmap.id,
            name: `${roadmap.metaRoadmap.name} (v${roadmap.version}): ${t("common:count.goal", { count: roadmap._count.goals })}`,
            expanded: false,
            onExpand: async () => {
              const roadmapData = await clientSafeGetOneRoadmap(roadmap.id).catch(() => null);
              if (!roadmapData) return [];
              return roadmapData.goals.map((goal): TreeItem => ({
                value: goal.id,
                name: `${(!goal.dataSeries) ? t("forms:goal.data_missing") : ""}${goal.name ?? t("forms:goal.unnamed_goal")}: ${goal.indicatorParameter} (${goal.dataSeries?.unit === null ? t("common:tsx.unitless") : goal.dataSeries?.unit || t("common:tsx.unit_missing")})`,
                expanded: null,
              }));
            },
          })),
        );
      })
      .catch(() => setTreeItems([]));
  }, [t]);

  // Once a goal is picked in the tree, fetch the full goal record so we can
  // read its baseline (the roadmap-level goal list only carries the dataSeries id).
  useEffect(() => {
    if (!selectedGoal || selectedGoal.value === "") {
      setGoalData(null);
      return;
    }
    clientSafeGetOneGoal(selectedGoal.value)
      .then(setGoalData)
      .catch(() => {
        setGoalData(null);
      });
  }, [selectedGoal]);

  return (
    <>
      {/* Roadmap + goal select, combined into a single expandable tree.
          NOTE: SelectSingleTree must NOT be nested inside the <label> - the
          toggle <button> it renders would get an implicit label association,
          and the browser then re-fires a synthetic click on that button for
          *any* click inside the label (including clicks on tree items),
          which stomps on menuOpen and causes the menu to open/close
          unpredictably. Associate the label via htmlFor instead. */}
      <label htmlFor="inheritFrom">
        {t("forms:goal.select_goal_as_baseline")}
      </label>
      <SelectSingleTree
        treeItems={treeItems}
        props={{
          id: "inheritFrom",
          name: "inheritFrom",
          required: true,
          className: "block margin-top-25 margin-bottom-100 width-100",
          placeholder: t("forms:goal.select_goal"),
        }}
        onChange={setSelectedGoal}
      />

      {goalData ? <label className="block margin-block-75">
        {`${t("forms:goal.baseline_copied")}: "${goalData.name}"`}
        {React.cloneElement(outputFormElement, {
          value: goalData.baseline?.id ?? goalData.dataSeries?.id ?? "",
          type: "hidden",
          hidden: true,
          readOnly: true,
        })}
      </label> : null
      }
    </>
  );
}