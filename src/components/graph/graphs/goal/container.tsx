"use client";

import { getHistoricalDataset } from "@/functions/getHistoricalDataset";
import { useState } from "react";
import { calculatePredictedOutcome, getStoredGraphType } from "../../functions/graphFunctions";
import GraphSelector from "../../graphSelectors/graphSelector";
import SecondaryGoalSelector from "../../graphSelectors/secondaryGoalSelector";
import { Trans, useTranslation } from "react-i18next";
import type { DataSeries, DateValues, DateValuesWithUnit, Goal, LoginData, Roadmap } from "@/types";
import { GraphType } from "@/types/enums";
import CopyAndScale from "@/components/modals/copyAndScale";
import styles from './goal.module.css';
import GoalGraph from "./main";
import TabListSimple from "@/components/generic/tablist/tabListSimple";
import findSiblings from "@/functions/findSiblings";
import ChildGraphContainer from "./child/container";
import { IconChartAreaLineFilled, IconLink } from "@tabler/icons-react";
// import SiblingGraph from "./sibling/siblings";

type TimestampedValue = { timestamp: Date; value: number };

export default function GoalGraphContainer({
  goal,
  secondaryGoal,
  childGoals,
  roadmap,
  parentGoal,
  session,
  roadmapOptions,
}: {
  goal: Goal,
  secondaryGoal: Goal | null,
  childGoals: Goal[],
  roadmap: Roadmap,
  parentGoal: Goal | null,
  session: LoginData,
  roadmapOptions: {
    id: string;
    name: string;
    version: number;
    actor: string | null;
  }[]
}) {
  const { t } = useTranslation("graphs");

  const [graphType, setGraphType] = useState<GraphType | "">(getStoredGraphType(goal.id));
  const [isStacked, setIsStacked] = useState<boolean>(true);

  const historicalDatasetLabel = getHistoricalDataset(goal).label;
  const historicalLabel = historicalDatasetLabel
    ? `${historicalDatasetLabel} (${t("common:historical_data")})`
    : t("common:historical_data");

  const siblings = findSiblings(roadmap, goal);
  const siblingsSeries: Array<(DataSeries | DateValuesWithUnit) & { name: string }> = findSiblings(roadmap, goal)
    .filter(
      (sibling): sibling is typeof sibling & { name: string; dataSeries: NonNullable<typeof sibling.dataSeries> } =>
        sibling.name != null && sibling.dataSeries != null,
    )
    .map((sibling) => {
      const dateValues: DateValues = Object.fromEntries(
        sibling.dataSeries.values.map((value) => [value.timestamp.toISOString(), value.value]),
      );

      return {
        name: sibling.name,
        unit: sibling.dataSeries.unit,
        dateValues,
      };
    });
 
  function toDeltaSeries(values: TimestampedValue[]): TimestampedValue[] {
    const sorted = [...values].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    const deltas: TimestampedValue[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const delta = sorted[i].value - sorted[i - 1].value;
      if (Number.isFinite(delta)) {
        deltas.push({ timestamp: sorted[i].timestamp, value: delta });
      }
    }
    return deltas;
  }

  function toDateValues(
    values: { timestamp: Date; value: number | null }[],
  ): DateValues {
    const dateValues: DateValues = {};
    for (const { timestamp, value } of values) {
      if (value === null) continue;
      const dateKey = (timestamp.toISOString().slice(0, 10) +
        "T00:00:00Z") as `${number}-${number}-${number}T00:00:00Z`;
      dateValues[dateKey] = value;
    }
    return dateValues;
  }


  function toDeltaDateValues(values: TimestampedValue[]): DateValues {
    return toDateValues(toDeltaSeries(values));
  }

  function toPercentOfFirstSeries(
    values: TimestampedValue[],
  ): { timestamp: Date; value: number | null }[] {
    const sorted = [...values].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    const base = sorted.find((v) => Number.isFinite(v.value) && v.value !== 0);
    const baseValue = base?.value ?? NaN;
    const baseIsUsable = Number.isFinite(baseValue) && baseValue !== 0;

    return sorted.map(({ timestamp, value }) => ({
      timestamp,
      value: baseIsUsable ? (value / baseValue) * 100 : null,
    }));
  }

  /** Convenience: sort, normalize to % of first value, and format in one call. */
  function toPercentOfFirstDateValues(values: TimestampedValue[]): DateValues {
    return toDateValues(toPercentOfFirstSeries(values));
  }

  function graphSwitch(graphType: GraphType) {
    switch (graphType) {

      case GraphType.Delta: {
        // TODO: Is timestamp the time the value was created or the time it represents?
        const sortedValues = [...(goal.dataSeries?.values ?? [])].sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
        );

        const deltaValues: DateValues = {};
        for (let i = 1; i < sortedValues.length; i++) {
          const current = sortedValues[i];
          const previous = sortedValues[i - 1];
          const delta = current.value - previous.value;
          if (Number.isFinite(delta)) {
            const dateKey = current.timestamp.toISOString().slice(0, 10) + 'T00:00:00Z';
            deltaValues[dateKey as `${number}-${number}-${number}T00:00:00Z`] = delta;
          }
        }

        return (
          <GoalGraph
            chartType="main"
            series={{
              main: goal.dataSeries && {
                name: `${(goal.name || goal.indicatorParameter).split('\\').slice(-1)[0]} (${t("common:goal_one")})`,
                unit: goal.dataSeries.unit,
                dateValues: toDeltaDateValues(goal.dataSeries?.values ?? []),
              },
              baseline: goal.baseline && {
                name: t("graphs:common.baseline_scenario"),
                unit: goal.baseline.unit,
                dateValues: toDeltaDateValues(goal.baseline.values),
              },
              historical: goal.historical && {
                name: goal.historical ? historicalLabel : "",
                unit: goal.historical.unit,
                dateValues: toDeltaDateValues(goal.historical.values),
              },
              predictedOutcome:
                goal.effects.length > 0
                  ? {
                    name: t("graphs:common.expected_outcome"),
                    unit: goal.effects[0].dataSeries?.unit,
                    dateValues: toDeltaDateValues(
                      calculatePredictedOutcome(goal.effects, goal.baseline)
                        .filter((p): p is { x: number; y: number } => p.y !== null)
                        .map((p) => ({ timestamp: new Date(p.x), value: p.y })),
                    ),
                  }
                  : null,
              comparison: secondaryGoal?.dataSeries && {
                name: secondaryGoal.name || secondaryGoal.indicatorParameter.split('\\').slice(-1)[0],
                unit: secondaryGoal.dataSeries.unit,
                dateValues: toDeltaDateValues(secondaryGoal.dataSeries.values),
              },
              parent: parentGoal?.dataSeries && {
                name: t("graphs:common.parent_counterpart", { parent: (parentGoal?.name || parentGoal?.indicatorParameter || "").split('\\').slice(-1)[0] }),
                unit: parentGoal.dataSeries.unit,
                dateValues: toDeltaDateValues(goal.dataSeries?.values ?? []),
              },
            }}
          />
        );
      }

      case GraphType.Relative: {
        return <GoalGraph
          chartType="main"
          series={{
            main: goal.dataSeries && {
              name: `${(goal.name || goal.indicatorParameter).split('\\').slice(-1)[0]} (${t("common:goal_one")})`,
              unit: goal.dataSeries.unit,
              dateValues: toPercentOfFirstDateValues(goal.dataSeries.values),
            },
            baseline: goal.baseline && {
              name: t("graphs:common.baseline_scenario"),
              unit: goal.baseline.unit,
              dateValues: toPercentOfFirstDateValues(goal.baseline.values),
            },
            historical: goal.historical && {
              name: goal.historical ? historicalLabel : "",
              unit: goal.historical.unit,
              dateValues: toPercentOfFirstDateValues(goal.historical.values),
            },
            predictedOutcome: goal.effects.length > 0
              ? {
                name: t("graphs:common.expected_outcome"),
                // TODO: Not good if there are multiple different units for different effects.
                // We likely want some conversion or warning, this includes units that differ between
                // historical, baseline and main dataseries aswell!
                unit: goal.effects[0].dataSeries?.unit,
                dateValues: toPercentOfFirstDateValues(
                  calculatePredictedOutcome(goal.effects, goal.baseline)
                    .filter((point): point is { x: number; y: number } => point.y !== null)
                    .map((p) => ({ timestamp: new Date(p.x), value: p.y })),
                ),
              }
              : null,
            comparison: secondaryGoal?.dataSeries && {
              name: secondaryGoal.name || secondaryGoal.indicatorParameter.split('\\').slice(-1)[0],
              unit: secondaryGoal.dataSeries.unit,
              dateValues: toPercentOfFirstDateValues(secondaryGoal.dataSeries.values),
            },
            parent: parentGoal?.dataSeries && {
              name: t("graphs:common.parent_counterpart", { parent: (parentGoal?.name || parentGoal?.indicatorParameter || "").split('\\').slice(-1)[0] }),
              unit: parentGoal.dataSeries.unit,
              dateValues: toPercentOfFirstDateValues(parentGoal.dataSeries.values),
            },
          }}
        />;
      }

      case GraphType.Main:
      default: {
        return <GoalGraph
          chartType="main"
          series={{
            main: goal.dataSeries && {
              name: `${(goal.name || goal.indicatorParameter).split('\\').slice(-1)[0]} (${t("common:goal_one")})`,
              unit: goal.dataSeries.unit,
              dateValues: Object.fromEntries(
                goal.dataSeries.values.map((value) => [
                  value.timestamp.toISOString(),
                  value.value,
                ]),
              ),
            },
            baseline: goal.baseline && {
              name: t("graphs:common.baseline_scenario"),
              unit: goal.baseline.unit,
              dateValues: Object.fromEntries(
                goal.baseline.values.map((value) => [
                  value.timestamp.toISOString(),
                  value.value,
                ]),
              ),
            },
            historical: goal.historical && {
              name: goal.historical ? historicalLabel : "",
              unit: goal.historical.unit,
              dateValues: Object.fromEntries(
                goal.historical.values.map((value) => [
                  value.timestamp.toISOString(),
                  value.value,
                ]),
              ),
            },
            predictedOutcome: goal.effects.length > 0
              ? {
                name: t("graphs:common.expected_outcome"),
                // TODO: Not good if there are multiple different units for different effects.
                // We likely want some conversion or warning, this includes units that differ between
                // historical, baseline and main dataseries aswell!
                unit: goal.effects[0].dataSeries?.unit,
                dateValues: Object.fromEntries(
                  calculatePredictedOutcome(goal.effects, goal.baseline)
                    .filter((point): point is { x: number; y: number } => point.y !== null)
                    .map((point) => [new Date(point.x).toISOString(), point.y]),
                ),
              }
              : null,
            comparison: secondaryGoal?.dataSeries && {
              name: secondaryGoal.name || secondaryGoal.indicatorParameter.split('\\').slice(-1)[0],
              unit: secondaryGoal.dataSeries.unit,
              dateValues: Object.fromEntries(
                secondaryGoal.dataSeries.values.map((value) => [
                  value.timestamp.toISOString(),
                  value.value,
                ]),
              ),
            },
            parent: parentGoal?.dataSeries && {
              name: t("graphs:common.parent_counterpart", { parent: (parentGoal?.name || parentGoal?.indicatorParameter || "").split('\\').slice(-1)[0] }),
              unit: parentGoal.dataSeries.unit,
              dateValues: Object.fromEntries(
                parentGoal.dataSeries.values.map((value) => [
                  value.timestamp.toISOString(),
                  value.value,
                ]),
              ),
            },
          }}
        />;
      }
    }
  };

  const { dataset } = getHistoricalDataset(goal);

  if (!(childGoals.length > 0) && !(siblings.length > 1)) {
    return (
      <section>
        <div className={`${styles['tab-panel']}`}>
          {/* TODO: Use role="toolbar" (or menubar) for this */}
          <header>
            <menu className={`${styles['menu']}`}>
              <GraphSelector goal={goal} currentSelection={graphType} setter={setGraphType} />
              <SecondaryGoalSelector />
              {(goal.dataSeries?.id && session.user) ?
                <CopyAndScale goal={goal} roadmapOptions={roadmapOptions} />
                : null}
            </menu>
            <h2 className={`${styles['heading']}`}>
              {!!goal.name ? goal.name : goal.indicatorParameter}
            </h2>
            {secondaryGoal ? <p className="margin-block-0 margin-inline-auto text-align-center">
              {t("graphs:graph_graph.compare_with_goal", { goalName: secondaryGoal.name || secondaryGoal.indicatorParameter })}
            </p> : null
            }
          </header>

          <div className={`${styles['body']}`}>
            {graphSwitch(graphType || GraphType.Main)}
          </div>

          {goal.historical && dataset ?
            <footer className={`${styles['footer']}`} >
              <Trans
                i18nKey="graphs:graph_graph.historical_data_source"
                components={{ a: <a href={dataset.userFacingUrl} target="_blank" rel="noreferrer" /> }}
                tOptions={{ source: dataset.fullName ?? dataset.userFacingUrl }}
              />
            </footer>
            : null}
        </div>
      </section>
    );
  }

  return (
    <section>
      <TabListSimple
        props={{
          className: `padding-inline-25 padding-bottom-0 grid ${styles['tablist']}`,
        }}
      >
        <TabListSimple.Tab
          className={`font-size-14px padding-25 ${styles['tab']}`}
          style={{ textTransform: 'capitalize' }}
        >
          {t("common:goal_one")}
        </TabListSimple.Tab>
        {childGoals.length > 0 ?
          <TabListSimple.Tab
            className={`font-size-14px padding-25 ${styles['tab']}`}
          >
            {t("pages:goal.sub_goals")}
          </TabListSimple.Tab>
          : null}
        {siblings.length > 1 ?
          <TabListSimple.Tab
            className={`font-size-14px padding-25 ${styles['tab']}`}
          >
            {t("pages:goal.related_goals")}
          </TabListSimple.Tab>
          : null}

        <TabListSimple.TabPanel>
          <div className={`${styles['tab-panel']}`}>
            {/* TODO: Use role="toolbar" (or menubar) for this */}
            <header>
              <menu className={`${styles['menu']}`}>
                <GraphSelector goal={goal} currentSelection={graphType} setter={setGraphType} />
                <SecondaryGoalSelector />
                {(goal.dataSeries?.id && session.user) ?
                  <CopyAndScale goal={goal} roadmapOptions={roadmapOptions} />
                  : null}
              </menu>
              <h2 className={`${styles['heading']}`}>
                {!!goal.name ? goal.name : goal.indicatorParameter}
              </h2>
              {secondaryGoal ? <p className="margin-block-0 margin-inline-auto text-align-center">
                {t("graphs:graph_graph.compare_with_goal", { goalName: secondaryGoal.name || secondaryGoal.indicatorParameter })}
              </p> : null
              }
            </header>

            <div className={`${styles['body']}`}>
              {graphSwitch(graphType || GraphType.Main)}
            </div>

            {goal.historical && dataset ?
              <footer className={`${styles['footer']}`} >
                <Trans
                  i18nKey="graphs:graph_graph.historical_data_source"
                  components={{ a: <a href={dataset.userFacingUrl} target="_blank" rel="noreferrer" /> }}
                  tOptions={{ source: dataset.fullName ?? dataset.userFacingUrl }}
                />
              </footer>
              : null}
          </div>
        </TabListSimple.TabPanel>

        {childGoals.length > 0 ?
          <TabListSimple.TabPanel>
            <ChildGraphContainer goal={goal} childGoals={childGoals} />
          </TabListSimple.TabPanel>
          : null}
        {siblings.length > 0 ?
          <TabListSimple.TabPanel>
            <div className={`${styles['tab-panel']}`}>

              <header>
                <menu className={`${styles['menu']}`}>
                  <button
                    className="flex align-items-center gap-50 transparent font-weight-500 gray-90 fit-content font-size-75 line-height-150"
                    style={{ padding: '.3rem .6rem' }}
                    type="button"
                    onClick={() => setIsStacked(!isStacked)}
                  >
                    {t("graphs:common.change_graph_type")}
                    <IconChartAreaLineFilled aria-hidden="true" width={16} height={16} />
                  </button>
                </menu>
                <h2 className={`${styles['heading']}`}>
                  {t("graphs:sibling_graph.related_goals")}
                </h2>
              </header>

              <div className={`${styles['body']}`}>
                <GoalGraph
                  chartType="siblings"
                  chartOptionsType={isStacked ? 'area' : 'line'}
                  series={{
                    main: goal.dataSeries && {
                      name: `${(goal.name || goal.indicatorParameter).split('\\').slice(-1)[0]} (${t("common:goal_one")})`,
                      unit: goal.dataSeries.unit,
                      dateValues: Object.fromEntries(
                        goal.dataSeries.values.map((value) => [
                          value.timestamp.toISOString(),
                          value.value,
                        ]),
                      ),
                    },
                    siblings: siblingsSeries,
                  }}
                />
              </div>

              <footer className={`${styles['footer']}`} >
                <nav className="flex gap-75 flex-wrap-wrap justify-content-center">
                  {siblings.map((sibling, index) =>
                    <span key={sibling.id} className="flex gap-50 line-height-100">
                      <a href={`/goal/${sibling.id}`} className="flex gap-25 align-items-center">
                        <IconLink width={14} height={14} strokeWidth={1.5} />
                        {sibling.name ? sibling.name : sibling.indicatorParameter.split('\\').at(-1)}
                      </a>
                      {index !== siblings.length - 1 ?
                        <hr aria-orientation="vertical" className="padding-0 margin-block-25" /> /* TODO: Need to add orientation aria to other HR */
                        : null}
                    </span>,
                  )}
                </nav>
              </footer>
            </div>
            {/* <SiblingGraph roadmap={roadmap} goal={goal} />*/}
          </TabListSimple.TabPanel>
          : null}
      </TabListSimple>
    </section>
  );
}