import React from 'react'
import { RefreshCw, X } from 'lucide-react'
import Panel from '../../../components/AdminUI/Panel'
import Select from '../../../components/AdminUI/Select'
import Input from '../../../components/AdminUI/Input'
import Button from '../../../components/AdminUI/Button'
import { EMPTY_FILTERS, RANGE_OPTIONS } from '../dashboardConstants'

/**
 * Global dashboard filters — one row above everything they scope.
 *
 * Date range comes first (presets before the custom range) because it is the
 * control every reader reaches for. Every card, chart and table below re-renders
 * against the same slice, so the numbers always agree.
 */
function DashboardFilters({ filters, onChange, onRefresh, refreshing, options, meta }) {
  const set = (key, value) => onChange({ ...filters, [key]: value })

  const setRange = (value) => {
    onChange({
      ...filters,
      range: value,
      // Clear a stale custom window when switching back to a preset.
      ...(value === 'custom' ? {} : { fromDate: '', toDate: '' }),
    })
  }

  const isDirty = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  return (
    <Panel className="mb-5 sm:mb-6">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Date Range"
            value={filters.range}
            onChange={(event) => setRange(event.target.value)}
            options={RANGE_OPTIONS}
          />

          {filters.range === 'custom' ? (
            <>
              <Input
                label="From Date"
                type="date"
                value={filters.fromDate}
                max={filters.toDate || undefined}
                onChange={(event) => set('fromDate', event.target.value)}
              />
              <Input
                label="To Date"
                type="date"
                value={filters.toDate}
                min={filters.fromDate || undefined}
                onChange={(event) => set('toDate', event.target.value)}
              />
            </>
          ) : null}

          <Select
            label="Category"
            value={filters.category}
            onChange={(event) => set('category', event.target.value)}
            options={[{ value: '', label: 'All Categories' }, ...(options?.categories || [])]}
          />

          <Select
            label="Package"
            value={filters.packageId}
            onChange={(event) => set('packageId', event.target.value)}
            options={[{ value: '', label: 'All Packages' }, ...(options?.packages || [])]}
          />

          <Select
            label="Payment Status"
            value={filters.paymentStatus}
            onChange={(event) => set('paymentStatus', event.target.value)}
            options={[{ value: 'all', label: 'All Payment Statuses' }, ...(options?.paymentStatuses || [])]}
          />

          <Select
            label="Product Status"
            value={filters.productStatus}
            onChange={(event) => set('productStatus', event.target.value)}
            options={[{ value: 'all', label: 'All Product Statuses' }, ...(options?.productStatuses || [])]}
          />

          <Select
            label="User Type"
            value={filters.userType}
            onChange={(event) => set('userType', event.target.value)}
            options={[{ value: 'all', label: 'All User Types' }, ...(options?.userTypes || [])]}
          />

          <Select
            label="Platform"
            value={filters.platform}
            onChange={(event) => set('platform', event.target.value)}
            options={[{ value: 'all', label: 'All Platforms' }, ...(options?.platforms || [])]}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filters.range === 'custom' && !(filters.fromDate && filters.toDate) ? (
              <span className="text-amber-600 dark:text-amber-400">
                Pick both dates to apply the custom range.
              </span>
            ) : meta ? (
              <>
                Showing <span className="font-medium text-slate-700 dark:text-slate-300">{meta.rangeLabel}</span>
                {meta.fromDate ? ` · ${meta.fromDate} → ${meta.toDate}` : ''}
                {meta.timezone ? ` · ${meta.timezone}` : ''}
              </>
            ) : null}
          </p>

          <div className="flex flex-wrap gap-2">
            {isDirty && (
              <Button variant="secondary" size="sm" icon={X} onClick={() => onChange(EMPTY_FILTERS)}>
                Reset
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={onRefresh}
              loading={refreshing}
              aria-label="Refresh dashboard"
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  )
}

export default DashboardFilters
