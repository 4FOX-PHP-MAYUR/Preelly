import React, { useMemo, useState } from 'react'
import { useAdminTheme } from '../AdminThemeContext'
import ChartLegend from './ChartLegend'
import ChartTooltip from './ChartTooltip'
import { getChartTokens } from './chartTheme'
import {
  EMPTY_SERIES_MESSAGE,
  areaPath,
  buildScale,
  formatCompact,
  formatNumber,
  linePath,
  thinLabels,
  useElementWidth,
  useTooltip,
} from './chartUtils'

const MARGIN = { top: 12, right: 16, bottom: 26, left: 44 }

/**
 * Multi-series line chart with a snapping crosshair.
 *
 * One y-axis only — two measures of different scale belong in two charts, never
 * on a second axis. A single series gets a 10%-opacity area wash and no legend
 * (the card title already names it).
 *
 * @param {Array<object>} data     `[{ label, <seriesKey>: number }]`
 * @param {Array<object>} series   `[{ key, name, format? }]`
 * @param {Function} [formatValue] value → tooltip string (default: thousands)
 */
function LineChart({
  data = [],
  series = [],
  height = 240,
  formatValue = (value) => formatNumber(value),
  formatAxis = formatCompact,
  showArea,
  className = '',
}) {
  const { theme } = useAdminTheme()
  const tokens = getChartTokens(theme)
  const [containerRef, width] = useElementWidth()
  const { tooltip, show, hide } = useTooltip()
  const [hiddenSeries, setHiddenSeries] = useState([])

  const visibleSeries = series.filter((entry) => !hiddenSeries.includes(entry.key))
  const seriesKeys = series.map((entry) => entry.key)

  const geometry = useMemo(() => {
    const innerWidth = Math.max(40, width - MARGIN.left - MARGIN.right)
    const innerHeight = Math.max(40, height - MARGIN.top - MARGIN.bottom)

    const maxValue = data.reduce((max, point) => {
      const rowMax = visibleSeries.reduce(
        (rowBest, entry) => Math.max(rowBest, Number(point[entry.key] || 0)),
        0,
      )
      return Math.max(max, rowMax)
    }, 0)

    const { top, ticks } = buildScale(maxValue, 4)
    const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0
    const xFor = (index) => MARGIN.left + (data.length > 1 ? index * stepX : innerWidth / 2)
    const yFor = (value) => MARGIN.top + innerHeight - (Number(value || 0) / top) * innerHeight

    return { innerWidth, innerHeight, top, ticks, stepX, xFor, yFor, baselineY: MARGIN.top + innerHeight }
    // `hiddenSeries` rather than `visibleSeries`: the latter is a fresh array
    // every render and would defeat the memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, series, hiddenSeries, width, height])

  const ticks = geometry.ticks
  const labelIndexes = useMemo(
    () => thinLabels(data, Math.max(2, Math.floor(geometry.innerWidth / 64))),
    [data, geometry.innerWidth],
  )

  const hasData = data.length > 0 && series.length > 0

  const handlePointer = (event) => {
    if (!hasData || data.length === 0) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const offsetX = event.clientX - bounds.left
    const ratio = (offsetX - MARGIN.left) / (geometry.innerWidth || 1)
    const index = Math.round(Math.min(1, Math.max(0, ratio)) * (data.length - 1))
    const point = data[index]
    if (!point) return

    show({
      index,
      x: geometry.xFor(index),
      y: MARGIN.top + 8,
      title: point.label,
      rows: visibleSeries.map((entry) => ({
        key: entry.key,
        label: entry.name,
        color: tokens.series[seriesKeys.indexOf(entry.key) % tokens.series.length],
        value: (entry.format || formatValue)(point[entry.key]),
      })),
    })
  }

  const toggleSeries = (key) =>
    setHiddenSeries((prev) =>
      prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key],
    )

  const legendItems = series.map((entry) => ({
    key: entry.key,
    label: entry.name,
    color: tokens.series[seriesKeys.indexOf(entry.key) % tokens.series.length],
  }))

  const useAreaWash = showArea ?? visibleSeries.length === 1

  return (
    <div className={className}>
      <div ref={containerRef} className="relative w-full">
        {!hasData ? (
          <EmptyPlot height={height} />
        ) : (
          <>
            <svg
              width={width}
              height={height}
              role="img"
              aria-label="Line chart"
              onPointerMove={handlePointer}
              onPointerLeave={hide}
              className="touch-pan-y select-none"
            >
              {/* Gridlines: hairline, solid, one step off the surface. */}
              {ticks.map((tick) => {
                const y = geometry.yFor(tick)
                return (
                  <g key={tick}>
                    <line
                      x1={MARGIN.left}
                      x2={width - MARGIN.right}
                      y1={y}
                      y2={y}
                      stroke={tokens.grid}
                      strokeWidth="1"
                    />
                    <text
                      x={MARGIN.left - 8}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="10"
                      fill={tokens.textMuted}
                      className="tabular-nums"
                    >
                      {formatAxis(tick)}
                    </text>
                  </g>
                )
              })}

              {/* X labels, thinned so they never collide. */}
              {labelIndexes.map((index) => (
                <text
                  key={index}
                  x={geometry.xFor(index)}
                  y={height - 8}
                  textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
                  fontSize="10"
                  fill={tokens.textMuted}
                >
                  {data[index]?.label}
                </text>
              ))}

              {/* Crosshair — readers aim at a date, not a 2px line. */}
              {tooltip && (
                <line
                  x1={tooltip.x}
                  x2={tooltip.x}
                  y1={MARGIN.top}
                  y2={geometry.baselineY}
                  stroke={tokens.axis}
                  strokeWidth="1"
                />
              )}

              {visibleSeries.map((entry) => {
                const color = tokens.series[seriesKeys.indexOf(entry.key) % tokens.series.length]
                const points = data.map((point, index) => ({
                  x: geometry.xFor(index),
                  y: geometry.yFor(point[entry.key]),
                }))

                return (
                  <g key={entry.key}>
                    {useAreaWash && (
                      <path d={areaPath(points, geometry.baselineY)} fill={color} opacity="0.1" />
                    )}
                    <path
                      d={linePath(points)}
                      fill="none"
                      stroke={color}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* End marker: ≥8px with a 2px surface ring. */}
                    {points.length > 0 && (
                      <circle
                        cx={points[points.length - 1].x}
                        cy={points[points.length - 1].y}
                        r="4"
                        fill={color}
                        stroke={tokens.surface}
                        strokeWidth="2"
                      />
                    )}
                    {tooltip && points[tooltip.index] && (
                      <circle
                        cx={points[tooltip.index].x}
                        cy={points[tooltip.index].y}
                        r="4"
                        fill={color}
                        stroke={tokens.surface}
                        strokeWidth="2"
                      />
                    )}
                  </g>
                )
              })}
            </svg>

            {tooltip && (
              <ChartTooltip
                x={tooltip.x}
                y={tooltip.y}
                containerWidth={width}
                title={tooltip.title}
                rows={tooltip.rows}
              />
            )}
          </>
        )}
      </div>

      {series.length > 1 && (
        <ChartLegend
          items={legendItems}
          variant="line"
          className="mt-3"
          onToggle={toggleSeries}
          hidden={hiddenSeries}
        />
      )}
    </div>
  )
}

export function EmptyPlot({ height = 240, message = EMPTY_SERIES_MESSAGE }) {
  return (
    <div
      style={{ height }}
      className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500"
    >
      {message}
    </div>
  )
}

export default LineChart
