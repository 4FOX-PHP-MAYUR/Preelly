import React from 'react'

/**
 * Chart legend — always present for two or more series, so identity never
 * depends on colour alone. The key mirrors the mark: a line stroke for line
 * charts, a filled swatch for bars/areas/slices.
 *
 * Legend text uses text tokens, never the series colour: the coloured key
 * beside the label carries identity.
 */
function ChartLegend({ items = [], variant = 'swatch', className = '', onToggle, hidden = [] }) {
  if (!items.length) return null

  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
      {items.map((item) => {
        const isHidden = hidden.includes(item.key)
        const content = (
          <>
            {variant === 'line' ? (
              <span
                aria-hidden="true"
                className="h-0.5 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: item.color, opacity: isHidden ? 0.35 : 1 }}
              />
            ) : (
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: item.color, opacity: isHidden ? 0.35 : 1 }}
              />
            )}
            <span
              className={`truncate text-xs ${
                isHidden
                  ? 'text-slate-400 line-through dark:text-slate-600'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {item.label}
            </span>
            {item.value !== undefined && (
              <span className="text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                {item.value}
              </span>
            )}
          </>
        )

        return (
          <li key={item.key} className="min-w-0">
            {onToggle ? (
              <button
                type="button"
                onClick={() => onToggle(item.key)}
                aria-pressed={!isHidden}
                className="flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {content}
              </button>
            ) : (
              <span className="flex min-w-0 items-center gap-1.5">{content}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default ChartLegend
