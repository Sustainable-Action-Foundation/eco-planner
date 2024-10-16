import WrappedChart, { floatSmoother } from "@/lib/chartWrapper";
import { dataSeriesDataFieldNames, DataSeriesDataFields } from "@/types";
import { Goal, DataSeries, Action, ActionImpactType } from "@prisma/client";
import styles from '../graphs.module.css';

export default function MainDeltaGraph({
  goal,
  secondaryGoal,
  nationalGoal,
  actions,
}: {
  goal: Goal & { dataSeries: DataSeries | null, baselineDataSeries: DataSeries | null },
  secondaryGoal: Goal & { dataSeries: DataSeries | null } | null,
  nationalGoal: Goal & { dataSeries: DataSeries | null } | null,
  actions: (Action & { dataSeries: DataSeries | null })[],
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
    // Baseline / predicted outcome without actions
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
    const actionSum: Partial<DataSeriesDataFields> = {};
    for (const i of dataSeriesDataFieldNames) {
      for (const action of actions) {
        if (action.dataSeries && action.dataSeries[i] != null) {
          if (!actionSum[i]) {
            actionSum[i] = 0;
          }
          switch (action.impactType) {
            case ActionImpactType.DELTA:
              // Add sum of all deltas up to this point for the current action
              let totalDelta = 0;
              for (const j of dataSeriesDataFieldNames.slice(0, dataSeriesDataFieldNames.indexOf(i) + 1)) {
                if (action.dataSeries[j] != null) {
                  totalDelta += action.dataSeries[j];
                }
              }
              actionSum[i] += totalDelta;
              break;
            case ActionImpactType.PERCENT:
              // Add previous year's (baseline + actionSum) multiplied by current action as percent
              const previous = dataSeriesDataFieldNames[dataSeriesDataFieldNames.indexOf(i) - 1];
              if (previous == undefined) {
                break;
              }
              // Substitute with 0 if any value is missing
              actionSum[i] += ((actionSum[previous] ?? 0) + (goal.baselineDataSeries[previous] ?? 0)) * (action.dataSeries[i] / 100);
              break;
            case ActionImpactType.ABSOLUTE:
            default:
              // Add current value
              actionSum[i] += action.dataSeries[i];
              break;
          }
        }
      }
    }

    // Predicted outcome with actions
    if (Object.keys(actionSum).length > 0) {
      const actionOutcome = [];
      for (let i = 1; i < dataSeriesDataFieldNames.length; i++) {
        const currentField = dataSeriesDataFieldNames[i];
        const previousField = dataSeriesDataFieldNames[i - 1];
        if (actionSum[currentField] != null && actionSum[previousField] != null && goal.baselineDataSeries[currentField] != null && goal.baselineDataSeries[previousField] != null) {
          actionOutcome.push({
            x: new Date(currentField.replace('val', '')).getTime(),
            y: (actionSum[currentField]! + goal.baselineDataSeries[currentField]!) - (actionSum[previousField]! + goal.baselineDataSeries[previousField]!)
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
      const actionSum: Partial<DataSeriesDataFields> = {};
      for (const i of dataSeriesDataFieldNames) {
        for (const action of actions) {
          if (action.dataSeries && action.dataSeries[i] != null) {
            if (!actionSum[i]) {
              actionSum[i] = 0;
            }
            switch (action.impactType) {
              case ActionImpactType.DELTA:
                // Add sum of all deltas up to this point for the current action
                let totalDelta = 0;
                for (const j of dataSeriesDataFieldNames.slice(0, dataSeriesDataFieldNames.indexOf(i) + 1)) {
                  if (action.dataSeries[j] != null) {
                    totalDelta += action.dataSeries[j];
                  }
                }
                actionSum[i] += totalDelta;
                break;
              case ActionImpactType.PERCENT:
                // Add previous year's (baseline + actionSum) multiplied by current action as percent
                const previous = dataSeriesDataFieldNames[dataSeriesDataFieldNames.indexOf(i) - 1];
                if (previous == undefined) {
                  break;
                }
                // Substitute with 0 if any value is missing
                actionSum[i] += ((actionSum[previous] ?? 0) + (goal.dataSeries[firstNonNull] ?? 0)) * (action.dataSeries[i] / 100);
                break;
              case ActionImpactType.ABSOLUTE:
              default:
                // Add current value
                actionSum[i] += action.dataSeries[i];
                break;
            }
          }
        }
      }

      // Predicted outcome with actions
      if (Object.keys(actionSum).length > 0) {
        const actionOutcome = [];
        for (let i = 1; i < dataSeriesDataFieldNames.length; i++) {
          const currentField = dataSeriesDataFieldNames[i];
          const previousField = dataSeriesDataFieldNames[i - 1];
          if (actionSum[currentField] != null && actionSum[previousField] != null) {
            actionOutcome.push({
              x: new Date(currentField.replace('val', '')).getTime(),
              y: actionSum[currentField]! - actionSum[previousField]!
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
      if (secondaryGoal.dataSeries[currentField] && secondaryGoal.dataSeries[previousField]) {
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
      if (nationalGoal.dataSeries[currentField] && nationalGoal.dataSeries[previousField]) {
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
      <div className={styles.graphWrapper}>
        <WrappedChart
          options={chartOptions}
          series={chart}
          type="line"
          width="100%"
          height="100%"
        />
      </div>
    </>
  );
}