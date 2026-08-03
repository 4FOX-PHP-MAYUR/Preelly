import React, { useMemo } from 'react'
import { useAdminTheme } from '../AdminThemeContext'
import ChartTooltip from './ChartTooltip'
import { EmptyPlot } from './LineChart'
import { getChartTokens } from './chartTheme'
import { barPath, formatNumber, niceMax, useElementWidth, useTooltip } from './chartUtils'

const ROW_HEIGHT = 30
const BAR_HEIGHT = 16
const LABEL_WIDTH_RATIO = 0.34
const MAX_LABEL_WIDTH = 180
const VALUE_GUTTER = 64

/**
 * Ranked horizontal bars — the right form for long category names.
 *
 * One series → one colour (slot 1) for every bar: a value-ramp would
 * double-encode length as hue and burn the only free channel. The value rides
 * the bar tip, so the chart is readable without hovering.
 */
function HorizontalBarChart({
  data = [],
  height,
  color,
  formatValue = (value) => formatNumber(value),
  onRowClick,
  className = '',
}) {
  const { theme } = useAdminTheme()
  const tokens = getChartTokens(theme)
  const [containerRef, width] = useElementWidth()
  const { tooltip, show, hide } = useTooltip()

  const barColor = color || tokens.series[0]
  const chartHeight = height || Math.max(ROW_HEIGHT, data.length * ROW_HEIGHT + 8)

  const geometry = useMemo(() => {
    const labelWidth = Math.min(MAX_LABEL_WIDTH, Math.max(80, width * LABEL_WIDTH_RATIO))
    const trackWidth = Math.max(24, width - labelWidth - VALUE_GUTTER)
    const max = niceMax(data.reduce((best, row) => Math.max(best, Number(row.value || 0)), 0) || 1)
    return { labelWidth, trackWidth, max }
  }, [data, width])

  if (!data.length) return <EmptyPlot height={height || 160} />

  return (
    <div className={className}>
      <div ref={containerRef} className="relative w-full">
        <svg width={width} height={chartHeight} role="img" aria-label="Ranked bar chart" className="select-none">
          {data.map((row, index) => {
            const y = index * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2
            const barWidth = (Number(row.value || 0) / geometry.max) * geometry.trackWidth
            const isHovered = tooltip?.index === index
            const interactive = typeof onRowClick === 'function'

            return (
              <g
                key={row.key || row.label || index}
                tabIndex={0}
                role={interactive ? 'button' : undefined}
                aria-label={`${row.label}: ${formatValue(row.value)}`}
                className={interactive ? 'cursor-pointer focus:outline-none' : 'focus:outline-none'}
                onClick={interactive ? () => onRowClick(row) : undefined}
                onKeyDown={
                  interactive
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onRowClick(row)
                        }
                      }
                    : undefined
                }
                onPointerEnter={() =>
                  show({
                    index,
                    x: geometry.labelWidth + barWidth,
                    y,
                    title: row.label,
                    rows: [{ key: 'value', label: row.subLabel || 'Total', color: barColor, value: formatValue(row.value) }],
                  })
                }
                onFocus={() =>
                  show({
                    index,
                    x: geometry.labelWidth + barWidth,
                    y,
                    title: row.label,
                    rows: [{ key: 'value', label: row.subLabel || 'Total', color: barColor, value: formatValue(row.value) }],
                  })
                }
                onPointerLeave={hide}
                onBlur={hide}
              >
                <rect x="0" y={index * ROW_HEIGHT} width={width} height={ROW_HEIGHT} fill="transparent" />
                <text
                  x="0"
                  y={index * ROW_HEIGHT + ROW_HEIGHT / 2 + 3}
                  fontSize="11"
                  fill={tokens.textSecondary}
                >
                  {truncate(row.label, geometry.labelWidth)}
                </text>
                {/* Track keeps short bars anchored to a visible scale. */}
                <rect
                  x={geometry.labelWidth}
                  y={y}
                  width={geometry.trackWidth}
                  height={BAR_HEIGHT}
                  rx="4"
                  fill={tokens.grid}
                  opacity="0.5"
                />
                {barWidth > 0 && (
                  <path
                    d={barPath(geometry.labelWidth, y, Math.max(2, barWidth), BAR_HEIGHT, 4, 'horizontal')}
                    fill={barColor}
                    opacity={tooltip && !isHovered ? 0.6 : 1}
                    className="transition-opacity"
                  />
                )}
                <text
                  x={geometry.labelWidth + geometry.trackWidth + 8}
                  y={index * ROW_HEIGHT + ROW_HEIGHT / 2 + 3}
                  fontSize="11"
                  fontWeight="600"
                  fill={tokens.textPrimary}
                  className="tabular-nums"
                >
                  {formatValue(row.value)}
                </text>
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
      </div>
    </div>
  )
}

/** Rough character budget for the label column — avoids clipped text. */
function truncate(label, pixelWidth) {
  const maxChars = Math.max(6, Math.floor(pixelWidth / 6.2))
  const text = String(label ?? '')
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text
}

export default HorizontalBarChart
