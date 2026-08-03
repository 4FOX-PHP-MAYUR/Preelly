import React from 'react'
import { Activity, AlertOctagon, Gauge, Server, Timer } from 'lucide-react'
import Panel from '../../../components/AdminUI/Panel'
import ChartCard from '../../../components/AdminUI/ChartCard'
import { LineChart, formatNumber } from '../../../components/AdminUI/charts'

/**
 * API + process health.
 *
 * Counters live in the API process and reset on restart, so `since` is shown
 * alongside them — a low request count right after a deploy is expected, not a
 * traffic drop. These figures are process-wide and deliberately not scoped by
 * the dashboard's date filter.
 */
function PerformanceMetrics({ performance, loading, error, onRetry }) {
  const hourly = (performance?.hourly || []).map((point) => ({
    label: point.label,
    requests: point.requests,
    failed: point.failed,
  }))

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Tile
          icon={Activity}
          label="Total API requests"
          value={formatNumber(performance?.totalRequests)}
          hint={performance?.since ? `since ${new Date(performance.since).toLocaleString('en-GB')}` : undefined}
          loading={loading}
        />
        <Tile
          icon={Timer}
          label="Avg response time"
          value={`${formatNumber(performance?.averageResponseMs, 1)} ms`}
          hint={`peak ${formatNumber(performance?.maxResponseMs, 0)} ms`}
          loading={loading}
        />
        <Tile
          icon={AlertOctagon}
          label="Failed requests"
          value={formatNumber(performance?.failedRequests)}
          hint={`${formatNumber(performance?.errorRate, 2)}% error rate`}
          loading={loading}
          tone={performance?.errorRate > 5 ? 'danger' : 'default'}
        />
        <Tile
          icon={Server}
          label="Server uptime"
          value={formatUptime(performance?.uptimeSeconds)}
          hint="Current API process"
          loading={loading}
        />
        <Tile
          icon={Gauge}
          label="Heap in use"
          value={`${formatNumber(performance?.memory?.heapUsedMb, 1)} MB`}
          hint={`RSS ${formatNumber(performance?.memory?.rssMb, 1)} MB`}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
        <ChartCard
          title="Requests — last 24 hours"
          subtitle="Hourly request volume and failures"
          icon={Activity}
          loading={loading}
          error={error}
          onRetry={onRetry}
          tableData={{
            columns: [
              { key: 'label', title: 'Hour' },
              { key: 'requests', title: 'Requests', align: 'right' },
              { key: 'failed', title: 'Failed', align: 'right' },
            ],
            rows: hourly.map((point) => ({
              key: point.label,
              label: point.label,
              requests: formatNumber(point.requests),
              failed: formatNumber(point.failed),
            })),
          }}
        >
          <LineChart
            data={hourly}
            series={[
              { key: 'requests', name: 'Requests' },
              { key: 'failed', name: 'Failed' },
            ]}
          />
        </ChartCard>

        <Panel>
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
            Slowest Endpoints
          </h3>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-6 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800" />
              ))}
            </div>
          ) : !performance?.slowestRoutes?.length ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              No requests recorded yet.
            </p>
          ) : (
            <div className="max-h-[280px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-900">
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Endpoint
                    </th>
                    <th className="py-2 pr-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Calls
                    </th>
                    <th className="py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Avg ms
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {performance.slowestRoutes.map((route) => (
                    <tr
                      key={route.route}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800/70"
                    >
                      <td className="max-w-[220px] truncate py-2 pr-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {route.route}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                        {formatNumber(route.requests)}
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums text-slate-900 dark:text-white">
                        {formatNumber(route.averageResponseMs, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Tile({ icon: Icon, label, value, hint, loading, tone = 'default' }) {
  return (
    <Panel className="!p-3.5 sm:!p-4">
      {loading ? (
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800" />
          <div className="h-6 w-16 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          </div>
          <p
            className={`mt-1.5 truncate text-lg font-bold sm:text-xl ${
              tone === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
            }`}
          >
            {value}
          </p>
          {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
        </>
      )}
    </Panel>
  )
}

function formatUptime(seconds) {
  const total = Number(seconds || 0)
  if (!total) return '—'
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (days) return `${days}d ${hours}h`
  if (hours) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default PerformanceMetrics
