import React, { useMemo, useState } from 'react'
import { useAdminTheme } from '../AdminThemeContext'
import ChartLegend from './ChartLegend'
import ChartTooltip from './ChartTooltip'
import { EmptyPlot } from './LineChart'
import { getChartTokens, statusColor } from './chartTheme'
import { arcPath, foldToOther, formatNumber, useElementWidth, useTooltip } from './chartUtils'

const SIZE = 180
const GAP_PX = 2 // surface gap between touching slices

/**
 * Pie / donut for part-to-whole at a glance.
 *
 * Capped at 6 slices — the tail folds into "Other" rather than reaching for a
 * 7th hue. The legend is always present with values beside it, which also
 * satisfies the light-mode contrast relief rule for the lighter hues.
 *
 * @param {boolean} donut       render a ring with a centre total
 * @param {boolean} useStatusColors  colour slices by reserved status hues
 *                                   (only when the colour *means* the state)
 */
function PieChart({
  data = [],
  donut = false,
  useStatusColors = false,
  centerLabel = 'Total',
  formatValue = (value) => formatNumber(value),
  maxSlices = 6,
  className = '',
}) {
  const { theme } = useAdminTheme()
  const tokens = getChartTokens(theme)
  const [containerRef, width] = useElementWidth(320)
  const { tooltip, show, hide } = useTooltip()
  const [hidden, setHidden] = useState([])

  const slices = useMemo(() => {
    const cleaned = data
      .map((row, index) => ({
        key: row.key || row.label || String(index),
        label: row.label,
        value: Number(row.value || 0),
      }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
    return foldToOther(cleaned, maxSlices)
  }, [data, maxSlices])

  const visible = slices.filter((slice) => !hidden.includes(slice.key))
  const total = visible.reduce((sum, slice) => sum + slice.value, 0)

  const colorFor = (slice, index) => {
    if (slice.isOther) return tokens.textMuted
    if (useStatusColors) return statusColor(tokens, slice.key)
    // Colour follows the entity's slot in the full list, so hiding a slice
    // never repaints the survivors.
    const slot = slices.findIndex((row) => row.key === slice.key)
    return tokens.series[(slot >= 0 ? slot : index) % tokens.series.length]
  }

  const arcs = useMemo(() => {
    if (!total) return []
    const outer = SIZE / 2 - 4
    const inner = donut ? outer * 0.62 : 0
    // Convert the 2px surface gap into an angular pad at the outer edge.
    const pad = visible.length > 1 ? GAP_PX / outer : 0

    let angle = 0
    return visible.map((slice, index) => {
      const sweep = (slice.value / total) * Math.PI * 2
      const start = angle + pad / 2
      const end = angle + sweep - pad / 2
      angle += sweep
      const mid = (start + end) / 2
      return {
        slice,
        color: colorFor(slice, index),
        d: arcPath(SIZE / 2, SIZE / 2, outer, inner, start, Math.max(start + 0.001, end)),
        mid,
        percent: (slice.value / total) * 100,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, total, donut, theme, useStatusColors])

  if (!slices.length) return <EmptyPlot height={220} />

  const legendItems = slices.map((slice, index) => ({
    key: slice.key,
    label: slice.label,
    color: colorFor(slice, index),
    value: formatValue(slice.value),
  }))

  const toggle = (key) =>
    setHidden((prev) => {
      const next = prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]
      // Never let the reader hide every slice.
      return next.length >= slices.length ? prev : next
    })

  return (
    <div ref={containerRef} className={`relative flex flex-col items-center gap-4 sm:flex-row sm:items-center ${className}`}>
      <div className="relative shrink-0">
        <svg width={SIZE} height={SIZE} role="img" aria-label="Proportion chart" className="select-none">
          {arcs.map((arc) => (
            <path
              key={arc.slice.key}
              d={arc.d}
              fill={arc.color}
              tabIndex={0}
              role="button"
              aria-label={`${arc.slice.label}: ${formatValue(arc.slice.value)} (${arc.percent.toFixed(1)}%)`}
              opacity={tooltip && tooltip.key !== arc.slice.key ? 0.6 : 1}
              className="cursor-default outline-none transition-opacity"
              onPointerEnter={(event) => {
                const bounds = event.currentTarget.ownerSVGElement.getBoundingClientRect()
                show({
                  key: arc.slice.key,
                  x: bounds.width / 2 + Math.cos(arc.mid - Math.PI / 2) * (SIZE / 3),
                  y: bounds.height / 2 + Math.sin(arc.mid - Math.PI / 2) * (SIZE / 3),
                  title: arc.slice.label,
                  rows: [
                    {
                      key: arc.slice.key,
                      label: `${arc.percent.toFixed(1)}% of total`,
                      color: arc.color,
                      value: formatValue(arc.slice.value),
                    },
                  ],
                })
              }}
              onFocus={() =>
                show({
                  key: arc.slice.key,
                  x: SIZE / 2,
                  y: SIZE / 2,
                  title: arc.slice.label,
                  rows: [
                    {
                      key: arc.slice.key,
                      label: `${arc.percent.toFixed(1)}% of total`,
                      color: arc.color,
                      value: formatValue(arc.slice.value),
                    },
                  ],
                })
              }
              onPointerLeave={hide}
              onBlur={hide}
            />
          ))}
        </svg>

        {donut && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {formatValue(total)}
            </span>
            <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {centerLabel}
            </span>
          </div>
        )}

        {tooltip && (
          <ChartTooltip
            x={tooltip.x}
            y={tooltip.y}
            containerWidth={SIZE}
            title={tooltip.title}
            rows={tooltip.rows}
          />
        )}
      </div>

      <ChartLegend
        items={legendItems}
        className="min-w-0 flex-1 !flex-col !items-start !gap-1.5"
        onToggle={toggle}
        hidden={hidden}
      />
    </div>
  )
}

export default PieChart
