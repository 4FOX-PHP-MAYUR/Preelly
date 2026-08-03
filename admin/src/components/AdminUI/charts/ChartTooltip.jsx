import React from 'react'

/**
 * Chart tooltip.
 *
 * Values lead, series names follow — the legend's hierarchy inverted, because
 * here the reader already knows the series and wants the number. Series are
 * keyed with a short stroke rather than a filled box: at tooltip density a box
 * is data-weight ink doing a label's job.
 *
 * Positioned absolutely inside a `relative` chart container; flips side near
 * the right edge so it never leaves the card.
 */
function ChartTooltip({ x, y, containerWidth, title, rows = [], footer }) {
  if (!rows.length && !title) return null

  const flip = x > containerWidth - 160
  const style = {
    left: flip ? undefined : Math.max(0, x + 12),
    right: flip ? Math.max(0, containerWidth - x + 12) : undefined,
    top: Math.max(0, y - 8),
  }

  return (
    <div
      role="tooltip"
      style={style}
      className="pointer-events-none absolute z-20 min-w-[9rem] max-w-[15rem] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95"
    >
      {title && (
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </p>
      )}
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.key || row.label} className="flex items-baseline gap-2">
            <span
              aria-hidden="true"
              className="mt-1 h-0.5 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
              {row.value}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-slate-500 dark:text-slate-400">
              {row.label}
            </span>
          </li>
        ))}
      </ul>
      {footer && (
        <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {footer}
        </p>
      )}
    </div>
  )
}

export default ChartTooltip
