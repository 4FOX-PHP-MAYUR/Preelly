import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Geometry, scales and formatting shared by every chart primitive.
 * Pure functions plus one sizing hook — no rendering here.
 */

/** Width of an element, tracked so SVGs render at real pixel size (crisp text). */
export function useElementWidth(fallback = 640) {
  const ref = useRef(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined

    const measure = () => {
      const next = node.getBoundingClientRect().width
      if (next > 0) setWidth(next)
    }
    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}

/** Tooltip anchor state shared by the chart primitives. */
export function useTooltip() {
  const [tooltip, setTooltip] = useState(null)
  const show = useCallback((next) => setTooltip(next), [])
  const hide = useCallback(() => setTooltip(null), [])
  return { tooltip, show, hide }
}

// ---------------------------------------------------------------------------
// Scales & ticks
// ---------------------------------------------------------------------------

/** Round a value up to the nearest 1 / 2 / 2.5 / 5 × a power of ten. */
function niceStep(value) {
  const exponent = Math.floor(Math.log10(value))
  const magnitude = 10 ** exponent
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

/**
 * Axis scale for a 0-based chart.
 *
 * The *step* is rounded first and the top follows from it, so ticks always land
 * on clean numbers (0 / 20 / 40 / 60) instead of the fractions you get from
 * dividing a rounded maximum by a fixed tick count (0 / 1.3 / 2.5 / 3.8). It
 * also stops the plot wasting half its height when the data peaks just above a
 * power of ten.
 *
 * @returns {{ top: number, ticks: number[] }}
 */
export function buildScale(maxValue, count = 4) {
  const max = Number(maxValue)
  if (!Number.isFinite(max) || max <= 0) return { top: 1, ticks: [0, 1] }

  const step = niceStep(max / count)
  const ticks = []
  // Epsilon guards float drift so the top tick isn't dropped or duplicated.
  for (let value = 0; value <= max + step * 1e-9; value += step) {
    ticks.push(Number(value.toFixed(6)))
  }
  if (ticks[ticks.length - 1] < max) {
    ticks.push(Number((ticks[ticks.length - 1] + step).toFixed(6)))
  }
  return { top: ticks[ticks.length - 1], ticks }
}

/** "Nice" axis maximum — the top of `buildScale`. */
export function niceMax(value, count = 4) {
  return buildScale(value, count).top
}

/** Evenly spaced tick values from 0 to a nice maximum. */
export function buildTicks(maxValue, count = 4) {
  return buildScale(maxValue, count).ticks
}

/**
 * Thin an axis label list so labels never collide.
 * Always keeps the first and last entry.
 */
export function thinLabels(labels, maxLabels) {
  if (labels.length <= maxLabels) return labels.map((_, index) => index)
  const stride = Math.ceil(labels.length / maxLabels)
  const kept = []
  for (let index = 0; index < labels.length; index += stride) kept.push(index)
  const last = labels.length - 1
  if (kept[kept.length - 1] !== last) {
    // The last label always shows. Drop the one before it unless a full stride
    // separates them, otherwise the final two labels print on top of each other.
    if (last - kept[kept.length - 1] < stride) kept.pop()
    kept.push(last)
  }
  return kept
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Compact form for axis ticks and stat tiles: 1,284 → 1.3K. */
export function formatCompact(value) {
  const number = Number(value || 0)
  const abs = Math.abs(number)
  if (abs >= 1_000_000_000) return `${trim(number / 1_000_000_000)}B`
  if (abs >= 1_000_000) return `${trim(number / 1_000_000)}M`
  if (abs >= 1_000) return `${trim(number / 1_000)}K`
  return trim(number)
}

function trim(value) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** Full precision with thousands separators — used in tooltips and tables. */
export function formatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('en-AE', { maximumFractionDigits }).format(Number(value || 0))
}

export function formatCurrency(value, currency = 'AED', compact = false) {
  const number = Number(value || 0)
  if (compact) return `${currency} ${formatCompact(number)}`
  return `${currency} ${new Intl.NumberFormat('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number)}`
}

export function formatPercent(value, digits = 1) {
  const number = Number(value || 0)
  return `${number > 0 ? '+' : ''}${number.toFixed(digits)}%`
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Straight-segment polyline path (`M … L …`). */
export function linePath(points) {
  if (!points.length) return ''
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')
}

/** Closed area under a line, for the 10%-opacity wash. */
export function areaPath(points, baselineY) {
  if (!points.length) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return `${linePath(points)} L${last.x},${baselineY} L${first.x},${baselineY} Z`
}

/** A rectangle rounded on the data-end only, square at the baseline. */
export function barPath(x, y, width, height, radius = 4, orientation = 'vertical') {
  const r = Math.max(0, Math.min(radius, width / 2, height))
  if (height <= 0 || width <= 0) return ''

  if (orientation === 'horizontal') {
    // Grows left → right: round the right edge.
    const rr = Math.max(0, Math.min(radius, height / 2, width))
    return [
      `M${x},${y}`,
      `H${x + width - rr}`,
      `A${rr},${rr} 0 0 1 ${x + width},${y + rr}`,
      `V${y + height - rr}`,
      `A${rr},${rr} 0 0 1 ${x + width - rr},${y + height}`,
      `H${x}`,
      'Z',
    ].join(' ')
  }

  // Grows bottom → top: round the top edge.
  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    `H${x + width - r}`,
    `A${r},${r} 0 0 1 ${x + width},${y + r}`,
    `V${y + height}`,
    'Z',
  ].join(' ')
}

const FULL_CIRCLE = Math.PI * 2

/** Donut/pie arc path. `innerRadius` of 0 gives a full pie slice. */
export function arcPath(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
  // A single 100% slice has identical start and end points, which collapses an
  // SVG arc to nothing. Draw it as two half-arcs instead.
  if (endAngle - startAngle >= FULL_CIRCLE - 1e-6) {
    const mid = startAngle + Math.PI
    return [
      arcPath(cx, cy, outerRadius, innerRadius, startAngle, mid),
      arcPath(cx, cy, outerRadius, innerRadius, mid, endAngle - 1e-6),
    ].join(' ')
  }

  const large = endAngle - startAngle > Math.PI ? 1 : 0
  const p = (radius, angle) => ({
    x: cx + radius * Math.cos(angle - Math.PI / 2),
    y: cy + radius * Math.sin(angle - Math.PI / 2),
  })

  const outerStart = p(outerRadius, startAngle)
  const outerEnd = p(outerRadius, endAngle)

  if (innerRadius <= 0) {
    return [
      `M${cx},${cy}`,
      `L${outerStart.x},${outerStart.y}`,
      `A${outerRadius},${outerRadius} 0 ${large} 1 ${outerEnd.x},${outerEnd.y}`,
      'Z',
    ].join(' ')
  }

  const innerEnd = p(innerRadius, endAngle)
  const innerStart = p(innerRadius, startAngle)
  return [
    `M${outerStart.x},${outerStart.y}`,
    `A${outerRadius},${outerRadius} 0 ${large} 1 ${outerEnd.x},${outerEnd.y}`,
    `L${innerEnd.x},${innerEnd.y}`,
    `A${innerRadius},${innerRadius} 0 ${large} 0 ${innerStart.x},${innerStart.y}`,
    'Z',
  ].join(' ')
}

/**
 * Fold a long category list down to `max` slices plus an "Other" bucket, so a
 * pie never asks for a 9th hue.
 */
export function foldToOther(items, max = 6, valueKey = 'value') {
  if (items.length <= max) return items
  const head = items.slice(0, max - 1)
  const tail = items.slice(max - 1)
  const otherValue = tail.reduce((sum, item) => sum + Number(item[valueKey] || 0), 0)
  return [
    ...head,
    { key: '__other__', label: `Other (${tail.length})`, [valueKey]: otherValue, isOther: true },
  ]
}

export const EMPTY_SERIES_MESSAGE = 'No data for the selected range'
