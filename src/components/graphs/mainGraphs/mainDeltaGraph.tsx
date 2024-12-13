import WrappedChart, { floatSmoother } from "@/lib/chartWrapper";
import { dataSeriesDataFieldNames, DataSeriesDataFields } from "@/types";
import { Goal, DataSeries, ActionImpactType, Effect } from "@prisma/client";

export default function MainDeltaGraph({
  goal,
  secondaryGoal,
  nationalGoal,
  effects,
}: {
  goal: Goal & { dataSeries: DataSeries | null, baselineDataSeries: DataSeries | null },
  secondaryGoal: Goal & { dataSeries: DataSeries | null } | null,
  nationalGoal: Goal & { dataSeries: DataSeries | null } | null,
  effects: (Effect & { dataSeries: DataSeries | null })[],
}) {
  if (!goal.dataSeries) {
    return null
  }

  const chartOptions: ApexCharts.ApexOptions = {
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
    },
    yaxis: [{
      title: { text: `Årlig förändring i ${goal.dataSeries.unit.toLowerCase() == 'procent' ? 'procentenheter' : goal.dataSeries.unit}` },
      labels: { formatter: floatSmoother },
      seriesName: [
        (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
        'Basscenario',
        'Förväntat utfall',
        (secondaryGoal?.dataSeries?.unit == goal.dataSeries.unit) ? (secondaryGoal?.name || secondaryGoal?.indicatorParameter) : '',
        'Nationell motsvarighet',
      ],
    }],
    tooltip: {
      x: { format: 'yyyy' },
    },
  }

  const chart: ApexAxisChartSeries = [];

  // Local goal
  const mainSeries = [];
  // Start at 1 to skip the first value
  for (let i = 1; i < dataSeriesDataFieldNames.length; i++) {
    const currentField = dataSeriesDataFieldNames[i];
    const previousField = dataSeriesDataFieldNames[i - 1];
    if (goal.dataSeries[currentField] != null && goal.dataSeries[previousField] != null) {
      mainSeries.push({
        x: new Date(currentField.replace('val', '')).getTime(),
        y: goal.dataSeries[currentField]! - goal.dataSeries[previousField]!
      });
    }
  }
  chart.push({
    name: (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
    data: mainSeries,
    type: 'line',
  });

  if (goal.baselineDataSeries) {
    // Baseline / predicted outcome without actions/effects
    const baselineSeries = [];
    for (let i = 1; i < dataSeriesDataFieldNames.length; i++) {
      const currentField = dataSeriesDataFieldNames[i];
      const previousField = dataSeriesDataFieldNames[i - 1];
      if (goal.baselineDataSeries[currentField] != null && goal.baselineDataSeries[previousField] != null) {
        baselineSeries.push({
          x: new Date(currentField.replace('val', '')).getTime(),
          y: goal.baselineDataSeries[currentField]! - goal.baselineDataSeries[previousField]!
        });
      }
    }
    chart.push({
      name: 'Basscenario',
      data: baselineSeries,
      type: 'line',
    });

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
              // Add previous year's (baseline + actionSum) multiplied by current action as percent
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

    // Predicted outcome with actions
    if (Object.keys(totalEffect).length > 0) {
      const actionOutcome = [];
      for (let i = 1; i < dataSeriesDataFieldNames.length; i++) {
        const currentField = dataSeriesDataFieldNames[i];
        const previousField = dataSeriesDataFieldNames[i - 1];
        if (totalEffect[currentField] != null && totalEffect[previousField] != null && goal.baselineDataSeries[currentField] != null && goal.baselineDataSeries[previousField] != null) {
          actionOutcome.push({
            x: new Date(currentField.replace('val', '')).getTime(),
            y: (totalEffect[currentField]! + goal.baselineDataSeries[currentField]!) - (totalEffect[previousField]! + goal.baselineDataSeries[previousField]!)
          });
        }
      }
      chart.push({
        name: 'Förväntat utfall',
        data: actionOutcome,
        type: 'line',
      });
    }
  } else {
    // If no baseline is set, use the first non-null value as baseline
    const firstNonNull = dataSeriesDataFieldNames.find(i => goal.dataSeries![i] != null);

    if (firstNonNull) {
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
                // Add previous year's (baseline + actionSum) multiplied by current action as percent
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

      // Predicted outcome with actions
      if (Object.keys(totalEffect).length > 0) {
        const actionOutcome = [];
        for (let i = 1; i < dataSeriesDataFieldNames.length; i++) {
          const currentField = dataSeriesDataFieldNames[i];
          const previousField = dataSeriesDataFieldNames[i - 1];
          if (totalEffect[currentField] != null && totalEffect[previousField] != null) {
            actionOutcome.push({
              x: new Date(currentField.replace('val', '')).getTime(),
              y: totalEffect[currentField]! - totalEffect[previousField]!
            });
          }
        }
        chart.push({
          name: 'Förväntat utfall',
          data: actionOutcome,
          type: 'line',
        });
      }
    }
  }

  // Secondary goal
  if (secondaryGoal?.dataSeries) {
    const nationalSeries = [];
    for (let i = 1; i < dataSeriesDataFieldNames.length; i++) {
      const currentField = dataSeriesDataFieldNames[i];
      const previousField = dataSeriesDataFieldNames[i - 1];
      if (secondaryGoal.dataSeries[currentField] != null && secondaryGoal.dataSeries[previousField] != null) {
        nationalSeries.push({
          x: new Date(currentField.replace('val', '')).getTime(),
          y: secondaryGoal.dataSeries[currentField]! - secondaryGoal.dataSeries[previousField]!
        });
      }
    }
    chart.push({
      name: secondaryGoal.name || secondaryGoal.indicatorParameter,
      data: nationalSeries,
      type: 'line',
    });
    // Place secondary series on separate scale if it doesn't share unit with main
    if (secondaryGoal.dataSeries.unit != goal.dataSeries.unit) {
      (chartOptions.yaxis as ApexYAxis[]).push({
        title: { text: `Årlig förändring i ${secondaryGoal.dataSeries.unit.toLowerCase() == 'procent' ? 'procentenheter' : secondaryGoal.dataSeries.unit}` },
        labels: { formatter: floatSmoother },
        seriesName: secondaryGoal.name || secondaryGoal.indicatorParameter,
        opposite: true,
      });
    }
  }

  // National goal
  if (nationalGoal?.dataSeries) {
    const nationalSeries = []
    for (let i = 1; i < dataSeriesDataFieldNames.length; i++) {
      const currentField = dataSeriesDataFieldNames[i];
      const previousField = dataSeriesDataFieldNames[i - 1];
      if (nationalGoal.dataSeries[currentField] != null && nationalGoal.dataSeries[previousField] != null) {
        nationalSeries.push({
          x: new Date(currentField.replace('val', '')).getTime(),
          y: nationalGoal.dataSeries[currentField]! - nationalGoal.dataSeries[previousField]!
        });
      }
    }
    chart.push({
      name: 'Nationell motsvarighet',
      data: nationalSeries,
      type: 'line',
    });
  }

  return (
    <>
      <WrappedChart
        options={chartOptions}
        series={chart}
        type="line"
        width="100%"
        height="100%"
      />
    </>
  );
}