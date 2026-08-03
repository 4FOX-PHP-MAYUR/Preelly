import React, { useState } from 'react'
import { BarChart3, Table2 } from 'lucide-react'
import Panel from './Panel'
import { SkeletonChart } from './Skeleton'

/**
 * Card chrome for a chart: title, optional controls, loading skeleton, and a
 * chart/table toggle.
 *
 * The table view is not a nicety — it is how a chart stays readable for hues
 * that sit below 3:1 contrast on the light surface, for screen readers, and in
 * print. Every chart that ships here gets one.
 *
 * While new data loads for an already-rendered chart, the previous render is
 * held at reduced opacity (`refreshing`) rather than replaced by a skeleton, so
 * the layout never jumps between filter changes.
 */
function ChartCard({
  title,
  subtitle,
  icon: Icon,
  actions,
  loading = false,
  refreshing = false,
  error = null,
  onRetry,
  /** `{ columns: [{key,title,align?}], rows: [...] }` — enables the table toggle. */
  tableData,
  height = 240,
  children,
  className = '',
  bodyClassName = '',
}) {
  const [view, setView] = useState('chart')
  const canToggle = Boolean(tableData?.rows?.length)
  const activeView = canToggle ? view : 'chart'

  return (
    <Panel className={`flex flex-col ${className}`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon && (
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          {canToggle && (
            <div
              role="group"
              aria-label="Chart view"
              className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700"
            >
              <ToggleButton
                active={activeView === 'chart'}
                onClick={() => setView('chart')}
                icon={BarChart3}
                label="Chart view"
              />
              <ToggleButton
                active={activeView === 'table'}
                onClick={() => setView('table')}
                icon={Table2}
                label="Table view"
              />
            </div>
          )}
        </div>
      </div>

      <div className={`min-w-0 flex-1 ${bodyClassName}`} aria-busy={loading || refreshing}>
        {error ? (
          <div
            style={{ minHeight: height }}
            className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-red-200 px-4 text-center dark:border-red-900/60"
          >
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Retry
              </button>
            )}
          </div>
        ) : loading ? (
          <SkeletonChart height={height} />
        ) : activeView === 'table' ? (
          <ChartDataTable {...tableData} />
        ) : (
          <div className={refreshing ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            {children}
          </div>
        )}
      </div>
    </Panel>
  )
}

function ToggleButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={`rounded-md p-1.5 transition-colors ${
        active
          ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  )
}

/** Accessible fallback for every chart — the same numbers, as text. */
export function ChartDataTable({ columns = [], rows = [] }) {
  return (
    <div className="max-h-[260px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white dark:bg-slate-900">
          <tr className="border-b border-slate-200 dark:border-slate-800">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`whitespace-nowrap py-2 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
                  column.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key || index} className="border-b border-slate-100 last:border-0 dark:border-slate-800/70">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`py-2 pr-3 text-slate-700 dark:text-slate-300 ${
                    column.align === 'right' ? 'text-right tabular-nums' : 'text-left'
                  }`}
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ChartCard
