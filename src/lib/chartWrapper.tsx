'use client'

import dynamic from 'next/dynamic'

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

/**
 * A wrapper for ApexCharts that only renders the chart on the client.
 * This is because ApexCharts uses `window`, which is not available on the server.
 */
export default function WrappedChart({
  type,
  series,
  width,
  height,
  options,
  ...props
}: {
  type?:
  | "line"
  | "area"
  | "bar"
  | "pie"
  | "donut"
  | "radialBar"
  | "scatter"
  | "bubble"
  | "heatmap"
  | "candlestick"
  | "boxPlot"
  | "radar"
  | "polarArea"
  | "rangeBar"
  | "rangeArea"
  | "treemap",
  series?: ApexCharts.ApexOptions['series'],
  width?: string | number,
  height?: string | number,
  options?: ApexCharts.ApexOptions
}) {
  return (
    <>
      <Chart
        type={type}
        series={series}
        width={width}
        height={height}
        options={options}
        {...props}
      />
    </>
  )
}

/**
 * A somewhat inaccurate formatter for numbers in the graph, since the numbers we work with should be rough estimates rather than exact values.
 * Declared as a client-side function so it can be used in `WrappedChart`.
 */
export function graphNumberFormatter(value: number) {
  if (value < 100) {
    return value?.toLocaleString('sv-SE', { maximumSignificantDigits: 3 })
  } else {
    return value?.toLocaleString('sv-SE', { maximumFractionDigits: 0 })
  }
}