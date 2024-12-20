import WrappedChart, { floatSmoother } from "@/lib/chartWrapper";
import { DataSeriesDataFields, dataSeriesDataFieldNames } from "@/types";
import { ActionImpactType, DataSeries, Effect, Goal } from "@prisma/client";
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
    return null;
  }

  const mainChartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'line',
      animations: { enabled: false, dynamicAnimation: { enabled: false } },
      zoom: { allowMouseWheelZoom: false },
    },
    stroke: { curve: 'straight' },
    markers: { size: 5 },
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
        seriesName: [
          (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
          'Basscenario',
          'Förväntat utfall',
          (secondaryGoal?.dataSeries?.unit == goal.dataSeries.unit) ? (secondaryGoal.name || secondaryGoal.indicatorParameter).split('\\').slice(-1)[0] : "",
        ]
      }
    ],
    tooltip: {
      x: { format: 'yyyy' },
      shared: true,
    },
  }

  const mainChart: ApexAxisChartSeries = [];

  // Main data series for the goal
  const mainSeries = [];
  for (const i of dataSeriesDataFieldNames) {
    const value = goal.dataSeries[i];

    mainSeries.push({
      x: new Date(i.replace('val', '')).getTime(),
      y: Number.isFinite(value) ? value : null,
    });
  }
  mainChart.push({
    name: (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
    data: mainSeries,
    type: 'line',
  })

  if (goal.baselineDataSeries) {
    // Predicted outcome without actions/effects
    const baseline = [];
    for (const i of dataSeriesDataFieldNames) {
      const value = goal.baselineDataSeries[i];

      baseline.push({
        x: new Date(i.replace('val', '')).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
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
        if (effect.dataSeries && effect.dataSeries[i] != null && Number.isFinite(effect.dataSeries[i])) {
          if (!totalEffect[i]) {
            totalEffect[i] = 0;
          }
          switch (effect.impactType) {
            case ActionImpactType.DELTA:
              // Add sum of all deltas up to this point for the current effect
              let totalDelta = 0;
              for (const j of dataSeriesDataFieldNames.slice(0, dataSeriesDataFieldNames.indexOf(i) + 1)) {
                if (effect.dataSeries[j] != null && Number.isFinite(effect.dataSeries[j])) {
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
              // Substitute with 0 if any value is missing or NaN
              totalEffect[i] += ((totalEffect[previous] || 0) + (goal.baselineDataSeries[previous] || 0)) * (effect.dataSeries[i] / 100);
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
        const baselineValue = goal.baselineDataSeries[i] ?? NaN;
        const effectValue = totalEffect[i] || 0;

        const value = baselineValue + effectValue;

        actionOutcome.push({
          x: new Date(i.replace('val', '')).getTime(),
          y: Number.isFinite(value) ? value : null,
        });
      }
      mainChart.push({
        name: 'Förväntat utfall',
        data: actionOutcome,
        type: 'line',
      });
    }
  } else {
    // If no baseline is set, use the first non-null value as baseline
    const firstNonNull = dataSeriesDataFieldNames.find(i => goal.dataSeries && Number.isFinite((goal.dataSeries)[i]));

    if (firstNonNull) {
      // Calculate total impact of actions/effects
      const totalEffect: Partial<DataSeriesDataFields> = {};
      for (const i of dataSeriesDataFieldNames) {
        for (const effect of effects) {
          if (effect.dataSeries && effect.dataSeries[i] != null && Number.isFinite(effect.dataSeries[i])) {
            if (!totalEffect[i]) {
              totalEffect[i] = 0;
            }
            switch (effect.impactType) {
              case ActionImpactType.DELTA:
                // Add sum of all deltas up to this point for the current action
                let totalDelta = 0;
                for (const j of dataSeriesDataFieldNames.slice(0, dataSeriesDataFieldNames.indexOf(i) + 1)) {
                  if (effect.dataSeries[j] != null && Number.isFinite(effect.dataSeries[j])) {
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
                totalEffect[i] += ((totalEffect[previous] || 0) + (goal.dataSeries[firstNonNull] || 0)) * (effect.dataSeries[i] / 100);
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
          });
        }
        mainChart.push({
          name: 'Basscenario',
          data: baseline,
          type: 'line',
        });

        // Line based on totalEffect + goal.dataSeries[firstNonNullIndex]
        const actionOutcome = [];
        for (const i of dataSeriesDataFieldNames) {
          const baselineValue = goal.dataSeries[firstNonNull] ?? NaN;
          const effectValue = totalEffect[i] || 0;

          const value = baselineValue + effectValue;

          actionOutcome.push({
            x: new Date(i.replace('val', '')).getTime(),
            y: Number.isFinite(value) ? value : null,
          });
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
      const value = secondaryGoal.dataSeries[i];

      secondarySeries.push({
        x: new Date(i.replace('val', '')).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
    mainChart.push({
      name: secondaryGoal.name || secondaryGoal.indicatorParameter,
      data: secondarySeries,
      type: 'line',
    });
    // Place secondary and main series on different scales if they don't share the same unit
    // TODO: Use mathjs to see if the units are the same, rather than just comparing strings
    if (secondaryGoal.dataSeries.unit != goal.dataSeries.unit) {
      (mainChartOptions.yaxis as ApexYAxis[]).push({
        title: { text: `Sekundär målbana (${secondaryGoal.dataSeries.unit})` },
        labels: { formatter: floatSmoother },
        seriesName: [(secondaryGoal.name || secondaryGoal.indicatorParameter).split('\\').slice(-1)[0]],
        opposite: true,
      });
    }
  }

  if (nationalGoal?.dataSeries) {
    const nationalSeries = [];
    for (const i of dataSeriesDataFieldNames) {
      const value = nationalGoal.dataSeries[i];

      nationalSeries.push({
        x: new Date(i.replace('val', '')).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
    mainChart.push({
      name: 'Nationell motsvarighet',
      data: nationalSeries,
      type: 'line',
    });
    (mainChartOptions.yaxis as ApexYAxis[]).push({
      title: { text: "Nationell målbana" },
      labels: { formatter: floatSmoother },
      seriesName: ['Nationell motsvarighet'],
      opposite: true,
    });
  }

  if (historicalData) {
    const historicalSeries = [];
    for (const i of historicalData.data) {
      const value = parseFloat(i.values[0]);

      historicalSeries.push({
        x: parsePeriod(i.key[0]).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
    mainChart.push({
      name: `${historicalData.metadata[0]?.label}`,
      data: historicalSeries,
      type: 'line',
    });
    (mainChartOptions.yaxis as ApexYAxis[]).push({
      title: { text: "Historik" },
      labels: { formatter: floatSmoother },
      seriesName: [`${historicalData.metadata[0]?.label}`],
      opposite: true,
    });
  }

  return (
    <>
      <WrappedChart
        options={mainChartOptions}
        series={mainChart}
        type="line"
        width="100%"
        height="100%"
      />
    </>
  )
}