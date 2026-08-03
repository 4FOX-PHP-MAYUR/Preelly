import React, { Suspense, lazy, useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminPage from '../../components/AdminUI/AdminPage'
import PageHeader from '../../components/AdminUI/PageHeader'
import Alert from '../../components/AdminUI/Alert'
import { SkeletonChart } from '../../components/AdminUI/Skeleton'
import { usePermission } from '../../hooks/usePermission'
import DashboardFilters from './sections/DashboardFilters'
import SummaryCards from './sections/SummaryCards'
import QuickActions from './sections/QuickActions'
import NotificationsPanel from './sections/NotificationsPanel'
import { DEFAULT_RANGE, EMPTY_FILTERS } from './dashboardConstants'
import {
  useDashboardCharts,
  useDashboardFilterOptions,
  useDashboardInsights,
  useDashboardPerformance,
  useDashboardSummary,
  useLazySection,
} from './useDashboard'

// Heavy sections are split out of the initial bundle — the KPI grid paints first.
const ChartsSection = lazy(() => import('./sections/ChartsSection'))
const InsightsSection = lazy(() => import('./sections/InsightsSection'))
const ReportsSection = lazy(() => import('./sections/ReportsSection'))
const PerformanceMetrics = lazy(() => import('./sections/PerformanceMetrics'))
const DashboardTables = lazy(() => import('./sections/DashboardTablesGroup'))

/**
 * Admin Dashboard.
 *
 * Layout order follows how the numbers are read: filters → KPI cards → quick
 * actions + activity → charts → insights → tables → reports → performance.
 *
 * Everything below the filter bar re-renders against the same window. Sections
 * past the fold are both code-split and viewport-gated, so a first paint costs
 * one `/summary` request rather than a dozen aggregations.
 */
function DashboardPage() {
  const { canView } = usePermission('Dashboard')
  const [searchParams, setSearchParams] = useSearchParams()

  // The range survives a refresh / shared link via ?range= (+ custom dates).
  const [filters, setFiltersState] = useState(() => ({
    ...EMPTY_FILTERS,
    range: searchParams.get('range') || DEFAULT_RANGE,
    fromDate: searchParams.get('fromDate') || '',
    toDate: searchParams.get('toDate') || '',
  }))

  const setFilters = useCallback(
    (next) => {
      setFiltersState(next)
      const params = new URLSearchParams()
      if (next.range && next.range !== DEFAULT_RANGE) params.set('range', next.range)
      if (next.range === 'custom') {
        if (next.fromDate) params.set('fromDate', next.fromDate)
        if (next.toDate) params.set('toDate', next.toDate)
      }
      setSearchParams(params, { replace: true })
    },
    [setSearchParams],
  )

  const options = useDashboardFilterOptions()
  const summary = useDashboardSummary(filters)

  const [chartsRef, chartsVisible] = useLazySection()
  const [insightsRef, insightsVisible] = useLazySection()
  const [tablesRef, tablesVisible] = useLazySection()
  const [perfRef, perfVisible] = useLazySection()

  const charts = useDashboardCharts(filters, { enabled: chartsVisible })
  const insights = useDashboardInsights(filters, { enabled: insightsVisible })
  const performance = useDashboardPerformance({ enabled: perfVisible })

  const meta = summary.data?.meta
  const currency = summary.data?.transactions?.currency || 'AED'

  const refreshAll = useCallback(() => {
    summary.reload()
    if (chartsVisible) charts.reload()
    if (insightsVisible) insights.reload()
    if (perfVisible) performance.reload()
  }, [summary, charts, insights, performance, chartsVisible, insightsVisible, perfVisible])

  if (!canView) return null

  return (
    <AdminPage>
      <PageHeader
        title="Dashboard"
        subtitle="Marketplace performance at a glance — users, listings, revenue and packages"
        className="mb-5 sm:mb-6"
      />

      <DashboardFilters
        filters={filters}
        onChange={setFilters}
        onRefresh={refreshAll}
        refreshing={summary.refreshing}
        options={options}
        meta={meta}
      />

      {summary.error && (
        <Alert variant="error" className="mb-5">
          {summary.error}
        </Alert>
      )}

      <div className="space-y-5 sm:space-y-6">
        <SummaryCards
          summary={summary.data}
          meta={meta}
          loading={summary.loading}
          currency={currency}
        />

        <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <QuickActions />
          </div>
          <NotificationsPanel filters={filters} />
        </div>

        <LazySection innerRef={chartsRef} visible={chartsVisible} label="Charts">
          <ChartsSection
            charts={charts.data?.charts}
            meta={charts.data?.meta || meta}
            loading={charts.loading}
            refreshing={charts.refreshing}
            error={charts.error}
            onRetry={charts.reload}
            currency={currency}
          />
        </LazySection>

        <LazySection innerRef={insightsRef} visible={insightsVisible} label="Insights">
          <InsightsSection
            insights={insights.data?.insights}
            meta={insights.data?.meta || meta}
            loading={insights.loading}
            refreshing={insights.refreshing}
            error={insights.error}
            onRetry={insights.reload}
            currency={currency}
          />
        </LazySection>

        <LazySection innerRef={tablesRef} visible={tablesVisible} label="Tables">
          <DashboardTables filters={filters} currency={currency} />
        </LazySection>

        <Suspense fallback={null}>
          <ReportsSection filters={filters} meta={meta} />
        </Suspense>

        <LazySection innerRef={perfRef} visible={perfVisible} label="Performance">
          <section aria-label="Performance metrics" className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Performance Metrics
            </h2>
            <PerformanceMetrics
              performance={performance.data}
              loading={performance.loading}
              error={performance.error}
              onRetry={performance.reload}
            />
          </section>
        </LazySection>
      </div>
    </AdminPage>
  )
}

/** Renders a skeleton placeholder until the section scrolls into view. */
function LazySection({ innerRef, visible, label, children }) {
  return (
    <div ref={innerRef} aria-label={label}>
      {visible ? (
        <Suspense fallback={<SectionFallback />}>{children}</Suspense>
      ) : (
        <SectionFallback />
      )}
    </div>
  )
}

function SectionFallback() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
      <div className="admin-panel rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <SkeletonChart />
      </div>
      <div className="admin-panel rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <SkeletonChart />
      </div>
    </div>
  )
}

export default DashboardPage
