'use client';

import type { Dispatch, SetStateAction } from "react";
import type { ClientGoal, DateValuesWithUnit, Goal } from "@/types";
import { GoalFormName } from "@/types/form-names";
import { useTranslation } from "react-i18next";
import { FormSync, ManualDataSeriesInput, RecipeContextProvider } from "@/components/recipe";
import { useRecipe } from "@/components/recipe/context/recipeContext.use";
import { IconCheck, IconInfoCircle } from "@tabler/icons-react";
import { dataSeriesToDateValues } from "@/functions/recipe";
import { Recipe } from "@/functions/recipe/recipe";
import { useEffect, useRef, useState } from "react";
import type { TreeItem } from "@/components/types";
import { clientSafeGetRoadmaps, clientSafeGetOneRoadmap, clientSafeGetOneGoal } from "@/fetchers/client";
import SelectSingleTree from "@/components/form/elements/combobox/selectSingleTree";
import { RecipeSync } from "@/components/recipe/output/recipeSync";
import { parseUnit } from "@/functions/unit";
import { BaselineType } from "@/types/enums";
import { Trans } from "react-i18next/TransWithoutContext";
import i18next from "i18next";

export default function BaselineSeriesSection({
  goal,
  baselineType,
  initialBaselineType,
  dataSeries,
  setBaselineType,
  setPreviewBaselineSerie,
  hasInitializedInitial,
  hasInitializedInitialNonZero,
  hasInitializedManual,
  hasInitializedInherited,
}: {
  goal: Goal | undefined;
  baselineType: BaselineType;
  initialBaselineType: BaselineType;
  dataSeries: DateValuesWithUnit | null;
  setBaselineType: Dispatch<SetStateAction<BaselineType>>;
  setPreviewBaselineSerie: Dispatch<SetStateAction<DateValuesWithUnit | null>>;
  hasInitializedInitial: boolean;
  hasInitializedInitialNonZero: boolean;
  hasInitializedManual: boolean;
  hasInitializedInherited: boolean;
}) {
  const { t } = useTranslation(["forms", "common"]);

  return (
    <>
      {/* Radio group, TODO: Look over aria. Use radiogroup? role?*/}
      <fieldset className="fieldset-unset-pseudo-class">
        <legend className="margin-bottom-25">{t("forms:goal.data_series.baseline.type")}</legend>
        <div className="width-100 radio-group">
          <label className="flex align-items-start gap-50 margin-bottom-25">
            <input
              required={true}
              type="radio"
              name={GoalFormName.BaselineType}
              value={BaselineType.Initial}
              checked={baselineType === BaselineType.Initial}
              onChange={(e) => setBaselineType(e.target.value as BaselineType)}
            />
            <span>
              <span className="block" style={{ textShadow: '0 0' }}>{t("forms:goal.baseline_types.initial")}</span>
              <span style={{ color: '#292929' }}>{t("forms:goal.data_series.baseline.first_year_value")}</span>
            </span>
          </label>
          <label className="flex align-items-start gap-50 margin-bottom-25">
            <input
              required={true}
              type="radio"
              name={GoalFormName.BaselineType}
              value={BaselineType.InitialNonZero}
              checked={baselineType === BaselineType.InitialNonZero}
              onChange={(e) => setBaselineType(e.target.value as BaselineType)}
            />
            <span>
              <span className="block" style={{ textShadow: '0 0' }}>{t("forms:goal.baseline_types.initial_non_zero")}</span>
              <span style={{ color: '#292929' }}>{t("forms:goal.data_series.baseline.first_defined_year")}</span>
            </span>
          </label>
          <label className="flex align-items-start gap-50 margin-bottom-25">
            <input
              required={true}
              type="radio"
              name={GoalFormName.BaselineType}
              value={BaselineType.Custom}
              checked={baselineType === BaselineType.Custom}
              onChange={(e) => setBaselineType(e.target.value as BaselineType)}
            />
            <span>
              <span className="block" style={{ textShadow: '0 0' }}>{t("forms:goal.baseline_types.custom")}</span>
              <span style={{ color: '#292929' }}>{t("forms:goal.data_series.baseline.custom")}</span>
            </span>
          </label>
          <label className="flex align-items-start gap-50 margin-bottom-25">
            <input
              required={true}
              type="radio"
              name={GoalFormName.BaselineType}
              value={BaselineType.Inherited}
              checked={baselineType === BaselineType.Inherited}
              onChange={(e) => setBaselineType(e.target.value as BaselineType)}
            />
            <span>
              <span className="block" style={{ textShadow: '0 0' }}>{t("forms:goal.baseline_types.inherited")}</span>
              <span style={{ color: '#292929' }}>{t("forms:goal.data_series.baseline.another_goal")}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <div
        className="padding-100 smooth"
        style={{ border: '1px dashed var(--blue)' }}
      >
        <p className={`${baselineType === BaselineType.Initial || baselineType === BaselineType.InitialNonZero ? "margin-0" : "margin-top-0"} flex gap-50 align-items-center`} style={{ color: 'var(--blue)', textShadow: '0 0 var(--blue)' }}>
          <IconCheck aria-hidden="true" height={20} width={20} style={{ minWidth: '20px' }} />
          <span>
            <span className="text-transform-capitalize">{t("common:tsx.using")}</span>
            <span className="text-transform-lowercase">
              {baselineType === BaselineType.Initial ? ` ${t("forms:goal.baseline_types.initial")}`
                : baselineType === BaselineType.InitialNonZero ? ` ${t("forms:goal.baseline_types.initial_non_zero")}`
                  : baselineType === BaselineType.Custom ? ` ${t("forms:goal.baseline_types.custom")}`
                    : ` ${t("forms:goal.baseline_types.inherited")}`}
            </span>
          </span>
        </p> {/* TODO: Should be a legend? */}

        {hasInitializedInitial || hasInitializedInitialNonZero ?
          <fieldset
            className={`${baselineType === BaselineType.Initial || baselineType === BaselineType.InitialNonZero ? "" : "display-none"}`}
            disabled={baselineType !== BaselineType.Initial && baselineType !== BaselineType.InitialNonZero}
          >
            <RecipeContextProvider>
              <InitialBaseline
                dataSeries={dataSeries}
                nonZero={baselineType === BaselineType.InitialNonZero}
              />
              <RecipeSync
                onDateValues={setPreviewBaselineSerie}
                active={true}
              />
            </RecipeContextProvider>
          </fieldset>
          : null
        }

        {/* Custom baseline input */}
        {hasInitializedManual ?
          <fieldset className={`${baselineType === BaselineType.Custom ? "" : "display-none"}`} disabled={baselineType !== BaselineType.Custom}>
            <RecipeContextProvider
              initialRecipe={goal?.baseline?.recipeUsed?.recipe
                ? Recipe.from(goal.baseline.recipeUsed.recipe).serialize()
                : undefined}
            >
              <ManualDataSeriesInput
                id="baseline-dataseries"
                label={t("forms:data_series_input.data_series")}
                {...goal?.baseline?.recipeUsed?.recipe
                  ? { initialDateValues: dataSeriesToDateValues(goal.baseline) }
                  : {}
                }
              />
              <FormSync
                RecipeFormElement={<input name={GoalFormName.BaselineRecipe} />}
                DateValuesFormElement={<input name={GoalFormName.BaselineDataSeries} />}
              />
              <RecipeSync
                onDateValues={setPreviewBaselineSerie}
                active={baselineType === BaselineType.Custom}
              />
            </RecipeContextProvider>
          </fieldset>
          : null
        }


        {/* Inherited baseline input */}
        {hasInitializedInherited ?
          <fieldset className={`${baselineType === BaselineType.Inherited ? "" : "display-none"}`} disabled={baselineType !== BaselineType.Inherited}>
            <RecipeContextProvider
              initialRecipe={goal?.baseline?.recipeUsed?.recipe
                ? Recipe.from(goal.baseline.recipeUsed.recipe).serialize()
                : undefined}
              availableDataSeries={goal?.baseline?.recipeUsed?.sourceDataSeries}
            >
              <InheritingBaseline initialBaselineType={initialBaselineType} />
              <FormSync
                RecipeFormElement={<input name={GoalFormName.BaselineRecipe} />}
                DateValuesFormElement={<input name={GoalFormName.BaselineDataSeries} />}
              />
              <RecipeSync
                onDateValues={setPreviewBaselineSerie}
                active={baselineType === BaselineType.Inherited}
              />
            </RecipeContextProvider>
          </fieldset>
          : null
        }
      </div>
    </>
  );
}

function InitialBaseline({
  dataSeries,
  nonZero,
}: {
  dataSeries: DateValuesWithUnit | null;
  nonZero: boolean;
}) {
  const { applyRecipeUpdate } = useRecipe();

  useEffect(() => {
    if (!dataSeries?.dateValues || Object.keys(dataSeries.dateValues).length === 0) {
      return;
    }

    void applyRecipeUpdate(() => Recipe.fromInitialDateValue(
      { unit: dataSeries.unit, dateValues: dataSeries.dateValues },
      { nonZero },
    ));
  }, [dataSeries, nonZero, applyRecipeUpdate]);

  return null;
}


/**
 * Tree select for inheriting another goal's baseline (or, failing that, its
 * data series). The selection is pushed into the surrounding
 * {@link RecipeContextProvider} as a recipe linking the inherited series (see
      * {@link Recipe.fromLinkedDataSeries}), so the baseline reads like every other
      * data series input — the form reads the result via `FormSync`
      * (`BaselineRecipe` / `BaselineDataSeries`) instead of a bespoke id field.
      *
      * Must be rendered inside a `RecipeContextProvider` (seed it with the saved
      * baseline recipe when editing so the initial output and context agree).
      */
function InheritingBaseline({initialBaselineType}: {initialBaselineType: BaselineType}) {
  const { t } = useTranslation(["forms", "common"]);
  const { recipe, applyRecipeUpdate } = useRecipe();
  const [treeItems, setTreeItems] = useState<TreeItem[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<TreeItem | null>(null);
  const [goalData, setGoalData] = useState<ClientGoal | null>(null);

  // Keep the linked variable's id stable across selections so the recipe
  // identity only changes when the inherited series actually changes.
  const variableIdRef = useRef<string>(recipe.variables[0]?.id ?? crypto.randomUUID());

  // Push the picked goal's baseline into the recipe context. A cleared
  // selection intentionally leaves the recipe untouched: when editing, the
  // provider is seeded with the saved recipe before anything is picked.
  useEffect(() => {
    if (!goalData) return;

    const inheritedSeries = goalData.baseline ?? goalData.dataSeries;
    if (!inheritedSeries?.id) return;

    void applyRecipeUpdate(() => Recipe.fromLinkedDataSeries({
      name: goalData.name ?? t("forms:goal.unnamed_goal"),
      dataSeriesId: inheritedSeries.id,
      unit: parseUnit(inheritedSeries.unit),
      variableId: variableIdRef.current,
    }));
  }, [goalData, applyRecipeUpdate, t]);

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

      {goalData ? <p className="block margin-block-75">
        {`${t("forms:goal.baseline_copied")}: "${goalData.name}"`}
      </p> : null
      }
      {recipe.variables[0]?.name && !selectedGoal && initialBaselineType === BaselineType.Inherited ? // TODO: Should only show if our previous baseline is 
        <small style={{ color: '#B35400', textShadow: '0 0 #ffcb00' }}>
          <IconInfoCircle width={16} height={16} style={{ verticalAlign: 'bottom', marginRight: '.25rem' }} />
          <Trans
            i18nKey="forms:goal.data_series.baseline.inherit_error"
            tOptions={{
              goal: recipe.variables[0]?.name,
            }}
            i18n={i18next}
          />
          <ol>
            <li>{t("forms:goal.data_series.baseline.inherit_fix_one")}</li>
            <li>{t("forms:goal.data_series.baseline.inherit_fix_two")}</li>
          </ol>
        </small>
        : null
      }
    </>
  );
}