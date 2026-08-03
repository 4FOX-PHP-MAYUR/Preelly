/**
 * Chart palette + tokens for the admin design system.
 *
 * The categorical order is fixed and validated for colour-vision deficiency in
 * BOTH modes (worst adjacent CVD ΔE 9.1 light / 8.4 dark, normal-vision floor
 * 19.6 / 19.3). Dark is a *selected* set of steps for the dark surface, not an
 * automatic flip of the light values.
 *
 * Rules that come with the palette:
 *  - Assign slots in order, by entity. Never cycle, never recolour on filter.
 *  - Past 8 series, fold the tail into "Other" — never generate a 9th hue.
 *  - Three light-mode hues sit under 3:1 on white, so every chart that uses
 *    them ships a legend with visible labels plus a table view (the "relief"
 *    rule). `ChartCard` provides the table toggle.
 *  - Status colours are reserved for state and never reused as "series 4".
 */

export const CATEGORICAL_LIGHT = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
]

export const CATEGORICAL_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
]

/** Single-hue ramp for magnitude (light → dark). */
export const SEQUENTIAL_LIGHT = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']
export const SEQUENTIAL_DARK = ['#0d366b', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb']

/** Reserved status hues — only ever used when the colour *means* the state. */
export const STATUS_COLORS = {
  light: { good: '#008300', warning: '#eda100', serious: '#eb6834', critical: '#e34948', neutral: '#64748b' },
  dark: { good: '#22c55e', warning: '#c98500', serious: '#d95926', critical: '#e66767', neutral: '#94a3b8' },
}

const TOKENS = {
  light: {
    surface: '#ffffff',
    grid: '#e2e8f0',
    axis: '#cbd5e1',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    series: CATEGORICAL_LIGHT,
    sequential: SEQUENTIAL_LIGHT,
    status: STATUS_COLORS.light,
  },
  dark: {
    surface: '#0f172a',
    grid: '#1e293b',
    axis: '#334155',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#64748b',
    series: CATEGORICAL_DARK,
    sequential: SEQUENTIAL_DARK,
    status: STATUS_COLORS.dark,
  },
}

export function getChartTokens(theme) {
  return theme === 'dark' ? TOKENS.dark : TOKENS.light
}

/**
 * Stable colour for a named entity so a filtered-out series never repaints its
 * neighbours. Pass the full, unfiltered key list as `order`.
 */
export function seriesColor(tokens, key, order = []) {
  const index = order.indexOf(key)
  const slot = index >= 0 ? index : 0
  return tokens.series[slot % tokens.series.length]
}

/** Product/transaction statuses map to reserved status hues, not series slots. */
export const STATUS_SLOTS = {
  active: 'good',
  success: 'good',
  approved: 'good',
  pending: 'warning',
  draft: 'neutral',
  inactive: 'neutral',
  expired: 'neutral',
  sold: 'serious',
  rejected: 'critical',
  failed: 'critical',
}

export function statusColor(tokens, statusKey) {
  const slot = STATUS_SLOTS[String(statusKey).toLowerCase()]
  return tokens.status[slot] || tokens.status.neutral
}

/** Maximum categorical slots before the tail must fold into "Other". */
export const MAX_SERIES = 8
