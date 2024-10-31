import WrappedChart, { floatSmoother } from "@/lib/chartWrapper";
import { DataSeriesDataFields, dataSeriesDataFieldNames } from "@/types";
import { ActionImpactType, DataSeries, Effect, Goal } from "@prisma/client";
import styles from '../graphs.module.css'
import { PxWebApiV2TableContent } from "@/lib/pxWeb/pxWebApiV2Types";
import { parsePeriod } from "@/lib/pxWeb/utility";

export default function MainGraph({
  goal,
  secondaryGoal,
  nationalGoal,
  historicalData,
  effects,
}: {
  goal: Goal & { dataSeries: DataSeries | null, baselineDataSeries: DataSeries | null },
  secondaryGoal: Goal & { dataSeries: DataSeries | null } | null,
  nationalGoal: Goal & { dataSeries: DataSeries | null } | null,
  historicalData?: PxWebApiV2TableContent | null,
  effects: (Effect & { dataSeries: DataSeries | null })[],
}) {
  if (!goal.dataSeries) {
    return null
  }

  const mainChartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'line',
      animations: { enabled: false, dynamicAnimation: { enabled: false } }
    },
    stroke: { curve: 'straight' },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      min: new Date(dataSeriesDataFieldNames[0].replace('val', '')).getTime(),
      max: new Date(dataSeriesDataFieldNames[dataSeriesDataFieldNames.length - 1].replace('val', '')).getTime()
      // categories: dataSeriesDataFieldNames.map(name => name.replace('val', ''))
    },
    yaxis: [
      {
        title: { text: goal.dataSeries?.unit },
        labels: { formatter: floatSmoother },
      }
    ],
    tooltip: {
      x: { format: 'yyyy-MM-dd' },
      shared: true,
    },
  }

  const mainChart: ApexAxisChartSeries = [];
  if (goal.dataSeries) {
    const mainSeries = [];
    for (const i of dataSeriesDataFieldNames) {
      if (goal.dataSeries[i] != null) {
        mainSeries.push({
          x: new Date(i.replace('val', '')).getTime(),
          y: goal.dataSeries[i]
        })
      }
    }
    mainChart.push({
      name: (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
      data: mainSeries,
      type: 'line',
    })
  }

  if (goal.baselineDataSeries) {
    // Predicted outcome without actions/effects
    const baseline = [];
    for (const i of dataSeriesDataFieldNames) {
      if (goal.baselineDataSeries[i]) {
        baseline.push({
          x: new Date(i.replace('val', '')).getTime(),
          y: goal.baselineDataSeries[i]
        })
      }
    }
    mainChart.push({
      name: 'Basscenario',
      data: baseline,
      type: 'line',
    })

    // Calculate total impact of actions
    const totalEffect: Partial<DataSeriesDataFields> = {};
    for (const i of dataSeriesDataFieldNames) {
      for (const effect of effects) {
        if (effect.dataSeries && effect.dataSeries[i] != null) {
          if (!totalEffect[i]) {
            totalEffect[i] = 0;
          }
          switch (effect.impactType) {
            case ActionImpactType.DELTA:
              // Add sum of all deltas up to this point for the current effect
              let totalDelta = 0;
              for (const j of dataSeriesDataFieldNames.slice(0, dataSeriesDataFieldNames.indexOf(i) + 1)) {
                if (effect.dataSeries[j] != null) {
                  totalDelta += effect.dataSeries[j];
                }
              }
              totalEffect[i] += totalDelta;
              break;
            case ActionImpactType.PERCENT:
              // Add previous year's (baseline + totalEffect) multiplied by current effect as percent
              const previous = dataSeriesDataFieldNames[dataSeriesDataFieldNames.indexOf(i) - 1];
              if (previous == undefined) {
                break;
              }
              // Substitute with 0 if any value is missing
              totalEffect[i] += ((totalEffect[previous] ?? 0) + (goal.baselineDataSeries[previous] ?? 0)) * (effect.dataSeries[i] / 100);
              break;
            case ActionImpactType.ABSOLUTE:
            default:
              // Add current value
              totalEffect[i] += effect.dataSeries[i];
              break;
          }
        }
      }
    }

    // Line based on totalEffect + baseline
    if (Object.keys(totalEffect).length > 0) {
      const actionOutcome = [];
      for (const i of dataSeriesDataFieldNames) {
        if (goal.baselineDataSeries[i] != null) {
          actionOutcome.push({
            x: new Date(i.replace('val', '')).getTime(),
            y: (totalEffect[i] || 0) + goal.baselineDataSeries[i]
          })
        }
      }
      mainChart.push({
        name: 'Förväntat utfall',
        data: actionOutcome,
        type: 'line',
      });
    }
  } else {
    // If no baseline is set, use the first non-null value as baseline
    const firstNonNull = dataSeriesDataFieldNames.find(i => (goal.dataSeries!)[i] != null);

    if (firstNonNull) {
      // Calculate total impact of actions/effects
      const totalEffect: Partial<DataSeriesDataFields> = {};
      for (const i of dataSeriesDataFieldNames) {
        for (const effect of effects) {
          if (effect.dataSeries && effect.dataSeries[i] != null) {
            if (!totalEffect[i]) {
              totalEffect[i] = 0;
            }
            switch (effect.impactType) {
              case ActionImpactType.DELTA:
                // Add sum of all deltas up to this point for the current action
                let totalDelta = 0;
                for (const j of dataSeriesDataFieldNames.slice(0, dataSeriesDataFieldNames.indexOf(i) + 1)) {
                  if (effect.dataSeries[j] != null) {
                    totalDelta += effect.dataSeries[j];
                  }
                }
                totalEffect[i] += totalDelta;
                break;
              case ActionImpactType.PERCENT:
                // Add previous year's (baseline + totalEffect) multiplied by current action as percent
                const previous = dataSeriesDataFieldNames[dataSeriesDataFieldNames.indexOf(i) - 1];
                if (previous == undefined) {
                  break;
                }
                // Substitute with 0 if any value is missing
                totalEffect[i] += ((totalEffect[previous] ?? 0) + (goal.dataSeries[firstNonNull] ?? 0)) * (effect.dataSeries[i] / 100);
                break;
              case ActionImpactType.ABSOLUTE:
              default:
                // Add current value
                totalEffect[i] += effect.dataSeries[i];
                break;
            }
          }
        }
      }

      // Only draw if totalEffect has values
      if (Object.keys(totalEffect).length > 0) {
        // Flat line based on goal.dataSeries[firstNonNull]
        const baseline = [];
        for (const i of dataSeriesDataFieldNames) {
          baseline.push({
            x: new Date(i.replace('val', '')).getTime(),
            y: goal.dataSeries[firstNonNull]
          })
        }
        mainChart.push({
          name: 'Basscenario',
          data: baseline,
          type: 'line',
        });

        // Line based on totalEffect + goal.dataSeries[firstNonNullIndex]
        const actionOutcome = [];
        for (const i of dataSeriesDataFieldNames) {
          if (goal.dataSeries[firstNonNull] != null) {
            actionOutcome.push({
              x: new Date(i.replace('val', '')).getTime(),
              y: (totalEffect[i] || 0) + goal.dataSeries[firstNonNull]!
            })
          }
        }
        mainChart.push({
          name: 'Förväntat utfall',
          data: actionOutcome,
          type: 'line',
        });
      }
    }
  }

  if (secondaryGoal?.dataSeries) {
    const secondarySeries = [];
    for (const i of dataSeriesDataFieldNames) {
      if (secondaryGoal.dataSeries[i] != null) {
        secondarySeries.push({
          x: new Date(i.replace('val', '')).getTime(),
          y: secondaryGoal.dataSeries[i]
        })
      }
    }
    mainChart.push({
      name: secondaryGoal.name || secondaryGoal.indicatorParameter,
      data: secondarySeries,
      type: 'line',
    });
    // Place secondary and main series on same scale if they share unit
    if (secondaryGoal.dataSeries.unit != goal.dataSeries.unit) {
      (mainChartOptions.yaxis as ApexYAxis[]).push({
        title: { text: `Sekundär målbana (${secondaryGoal.dataSeries.unit})` },
        labels: { formatter: floatSmoother },
        opposite: true,
      });
    }
  }

  if (nationalGoal?.dataSeries) {
    const nationalSeries = [];
    for (const i of dataSeriesDataFieldNames) {
      if (nationalGoal.dataSeries[i] != null) {
        nationalSeries.push({
          x: new Date(i.replace('val', '')).getTime(),
          y: nationalGoal.dataSeries[i]
        })
      }
    }
    mainChart.push({
      name: 'Nationell motsvarighet',
      data: nationalSeries,
      type: 'line',
    });
    (mainChartOptions.yaxis as ApexYAxis[]).push({
      title: { text: "Nationell målbana" },
      labels: { formatter: floatSmoother },
      opposite: true,
    });
  }

  if (historicalData) {
    const historicalSeries = [];
    for (const i of historicalData.data) {
      historicalSeries.push({
        x: parsePeriod(i.key[0]).getTime(),
        y: parseFloat(i.values[0])
      })
    }
    mainChart.push({
      name: `${historicalData.metadata[0]?.label}`,
      data: historicalSeries,
      type: 'line',
    });
    (mainChartOptions.yaxis as ApexYAxis[]).push({
      title: { text: "Historik" },
      labels: { formatter: floatSmoother },
      opposite: true,
    });
  }

  return (
    <>
      <div className={styles.graphWrapper}>
        <WrappedChart
          options={mainChartOptions}
          series={mainChart}
          type="line"
          width="100%"
          height="100%"
        />
      </div>
    </>
  )
}