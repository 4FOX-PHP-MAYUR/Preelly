import React, { useMemo } from 'react'
import { useAdminTheme } from '../AdminThemeContext'
import ChartLegend from './ChartLegend'
import ChartTooltip from './ChartTooltip'
import { EmptyPlot } from './LineChart'
import { getChartTokens } from './chartTheme'
import {
  barPath,
  buildScale,
  formatCompact,
  formatNumber,
  thinLabels,
  useElementWidth,
  useTooltip,
} from './chartUtils'

const MARGIN = { top: 12, right: 16, bottom: 26, left: 44 }
const MAX_BAR_WIDTH = 24
const GAP = 2 // surface gap between touching bars

/**
 * Vertical column chart, single or grouped series.
 *
 * The mark is the hit target — each column carries its own tooltip and lifts on
 * hover; no crosshair. Bars cap at 24px so the band's leftover reads as air.
 */
function BarChart({
  data = [],
  series = [{ key: 'value', name: 'Value' }],
  height = 240,
  formatValue = (value) => formatNumber(value),
  formatAxis = formatCompact,
  className = '',
}) {
  const { theme } = useAdminTheme()
  const tokens = getChartTokens(theme)
  const [containerRef, width] = useElementWidth()
  const { tooltip, show, hide } = useTooltip()

  const seriesKeys = series.map((entry) => entry.key)

  const geometry = useMemo(() => {
    const innerWidth = Math.max(40, width - MARGIN.left - MARGIN.right)
    const innerHeight = Math.max(40, height - MARGIN.top - MARGIN.bottom)

    const maxValue = data.reduce(
      (max, point) =>
        Math.max(max, ...series.map((entry) => Number(point[entry.key] || 0))),
      0,
    )
    const { top, ticks } = buildScale(maxValue, 4)

    const bandWidth = data.length ? innerWidth / data.length : innerWidth
    const groupWidth = Math.min(bandWidth * 0.7, MAX_BAR_WIDTH * series.length + GAP * (series.length - 1))
    const barWidth = Math.max(2, (groupWidth - GAP * (series.length - 1)) / series.length)

    return {
      innerWidth,
      innerHeight,
      top,
      ticks,
      bandWidth,
      groupWidth,
      barWidth,
      baselineY: MARGIN.top + innerHeight,
      xFor: (index) => MARGIN.left + index * bandWidth + (bandWidth - groupWidth) / 2,
      heightFor: (value) => (Number(value || 0) / top) * innerHeight,
    }
  }, [data, series, width, height])

  const ticks = geometry.ticks
  const labelIndexes = useMemo(
    () => thinLabels(data, Math.max(2, Math.floor(geometry.innerWidth / 56))),
    [data, geometry.innerWidth],
  )

  const hasData = data.length > 0

  const legendItems = series.map((entry, index) => ({
    key: entry.key,
    label: entry.name,
    color: tokens.series[index % tokens.series.length],
  }))

  return (
    <div className={className}>
      <div ref={containerRef} className="relative w-full">
        {!hasData ? (
          <EmptyPlot height={height} />
        ) : (
          <>
            <svg width={width} height={height} role="img" aria-label="Bar chart" className="select-none">
              {ticks.map((tick) => {
                const y = geometry.baselineY - (tick / geometry.top) * geometry.innerHeight
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

              {labelIndexes.map((index) => (
                <text
                  key={index}
                  x={geometry.xFor(index) + geometry.groupWidth / 2}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill={tokens.textMuted}
                >
                  {data[index]?.label}
                </text>
              ))}

              {data.map((point, index) =>
                series.map((entry, seriesIndex) => {
                  const value = Number(point[entry.key] || 0)
                  const barHeight = geometry.heightFor(value)
                  const x = geometry.xFor(index) + seriesIndex * (geometry.barWidth + GAP)
                  const y = geometry.baselineY - barHeight
                  const color = tokens.series[seriesIndex % tokens.series.length]
                  const isHovered = tooltip?.index === index

                  return (
                    <g key={`${entry.key}-${index}`}>
                      {/* Hit target spans the full band height so short bars stay reachable. */}
                      <rect
                        x={x - GAP}
                        y={MARGIN.top}
                        width={geometry.barWidth + GAP * 2}
                        height={geometry.innerHeight}
                        fill="transparent"
                        tabIndex={0}
                        role="button"
                        aria-label={`${point.label}: ${entry.name} ${formatValue(value)}`}
                        onPointerEnter={() =>
                          show({
                            index,
                            x: x + geometry.barWidth / 2,
                            y: Math.max(MARGIN.top, y - 12),
                            title: point.label,
                            rows: series.map((row, rowIndex) => ({
                              key: row.key,
                              label: row.name,
                              color: tokens.series[rowIndex % tokens.series.length],
                              value: (row.format || formatValue)(point[row.key]),
                            })),
                          })
                        }
                        onFocus={() =>
                          show({
                            index,
                            x: x + geometry.barWidth / 2,
                            y: Math.max(MARGIN.top, y - 12),
                            title: point.label,
                            rows: series.map((row, rowIndex) => ({
                              key: row.key,
                              label: row.name,
                              color: tokens.series[rowIndex % tokens.series.length],
                              value: (row.format || formatValue)(point[row.key]),
                            })),
                          })
                        }
                        onPointerLeave={hide}
                        onBlur={hide}
                      />
                      {barHeight > 0 && (
                        <path
                          d={barPath(x, y, geometry.barWidth, barHeight, 4)}
                          fill={color}
                          opacity={tooltip && !isHovered ? 0.55 : 1}
                          className="pointer-events-none transition-opacity"
                        />
                      )}
                    </g>
                  )
                }),
              )}
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

      {series.length > 1 && <ChartLegend items={legendItems} className="mt-3" />}
    </div>
  )
}

export default BarChart
