import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Layers,
  ShoppingBag,
  Users as UsersIcon,
} from 'lucide-react'
import ChartCard from '../../../components/AdminUI/ChartCard'
import {
  BarChart,
  HorizontalBarChart,
  LineChart,
  PieChart,
  formatCompact,
  formatCurrency,
  formatNumber,
} from '../../../components/AdminUI/charts'
import { buildListingLink } from '../dashboardConstants'

/**
 * The chart grid.
 *
 * Each card owns exactly one measure on one axis — a second scale would invent
 * a correlation that isn't in the data. Every card ships a table view so the
 * numbers are reachable without hovering.
 */
function ChartsSection({ charts, meta, loading, refreshing, error, onRetry, currency = 'AED' }) {
  const navigate = useNavigate()

  const money = (value) => formatCurrency(value, currency)
  const moneyAxis = (value) => formatCompact(value)

  const tableFor = (series, valueLabel, format = formatNumber) => ({
    columns: [
      { key: 'label', title: 'Period' },
      { key: 'value', title: valueLabel, align: 'right' },
    ],
    rows: (series || []).map((point) => ({
      key: point.bucket,
      label: point.label,
      value: format(point.value),
    })),
  })

  const categoryRows = useMemo(
    () =>
      (charts?.categoryProducts || []).map((row) => ({
        key: row.key,
        label: row.label,
        value: row.value,
        subLabel: 'Products',
      })),
    [charts?.categoryProducts],
  )

  const shared = { loading, refreshing, error, onRetry }

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
      <ChartCard
        title="User Registration Trend"
        subtitle={`New sign-ups per ${charts?.granularity || 'day'}`}
        icon={UsersIcon}
        tableData={tableFor(charts?.userRegistrations, 'New users')}
        {...shared}
      >
        <LineChart
          data={charts?.userRegistrations || []}
          series={[{ key: 'value', name: 'New users' }]}
        />
      </ChartCard>

      <ChartCard
        title="Revenue Analytics"
        subtitle={`Successful payments per ${charts?.granularity || 'day'} · ${currency}`}
        icon={BarChart3}
        tableData={{
          columns: [
            { key: 'label', title: 'Period' },
            { key: 'value', title: `Revenue (${currency})`, align: 'right' },
            { key: 'transactions', title: 'Transactions', align: 'right' },
          ],
          rows: (charts?.revenue || []).map((point) => ({
            key: point.bucket,
            label: point.label,
            value: money(point.value),
            transactions: formatNumber(point.transactions),
          })),
        }}
        {...shared}
      >
        <BarChart
          data={charts?.revenue || []}
          series={[{ key: 'value', name: `Revenue (${currency})` }]}
          formatValue={money}
          formatAxis={moneyAxis}
        />
      </ChartCard>

      <ChartCard
        title="Product Posting Trend"
        subtitle={`Listings posted per ${charts?.granularity || 'day'}`}
        icon={LineIcon}
        tableData={tableFor(charts?.productPostings, 'Products')}
        {...shared}
      >
        <LineChart
          data={charts?.productPostings || []}
          series={[{ key: 'value', name: 'Products posted' }]}
        />
      </ChartCard>

      <ChartCard
        title="Package Purchase Trend"
        subtitle={`Package sales per ${charts?.granularity || 'day'}`}
        icon={Layers}
        tableData={{
          columns: [
            { key: 'label', title: 'Period' },
            { key: 'value', title: 'Purchases', align: 'right' },
            { key: 'revenue', title: `Revenue (${currency})`, align: 'right' },
          ],
          rows: (charts?.packagePurchases || []).map((point) => ({
            key: point.bucket,
            label: point.label,
            value: formatNumber(point.value),
            revenue: money(point.revenue),
          })),
        }}
        {...shared}
      >
        <BarChart
          data={charts?.packagePurchases || []}
          series={[{ key: 'value', name: 'Purchases' }]}
        />
      </ChartCard>

      <ChartCard
        title="Package Sales by Type"
        subtitle="Share of purchases per package"
        icon={PieIcon}
        height={220}
        tableData={{
          columns: [
            { key: 'label', title: 'Package' },
            { key: 'value', title: 'Purchases', align: 'right' },
            { key: 'revenue', title: `Revenue (${currency})`, align: 'right' },
          ],
          rows: (charts?.packageSales || []).map((row) => ({
            key: row.key,
            label: row.label,
            value: formatNumber(row.value),
            revenue: money(row.revenue),
          })),
        }}
        {...shared}
      >
        <PieChart data={charts?.packageSales || []} />
      </ChartCard>

      <ChartCard
        title="Product Status Distribution"
        subtitle="Where listings currently sit"
        icon={ShoppingBag}
        height={220}
        tableData={{
          columns: [
            { key: 'label', title: 'Status' },
            { key: 'value', title: 'Products', align: 'right' },
          ],
          rows: (charts?.productStatus || []).map((row) => ({
            key: row.key,
            label: row.label,
            value: formatNumber(row.value),
          })),
        }}
        {...shared}
      >
        {/* Status is state, so it wears the reserved status hues, not series slots. */}
        <PieChart
          data={charts?.productStatus || []}
          donut
          useStatusColors
          centerLabel="Products"
          maxSlices={7}
        />
      </ChartCard>

      <ChartCard
        title="Category-wise Products"
        subtitle="Listings per top-level category"
        icon={BarChart3}
        className="xl:col-span-2"
        tableData={{
          columns: [
            { key: 'label', title: 'Category' },
            { key: 'value', title: 'Products', align: 'right' },
          ],
          rows: categoryRows.map((row) => ({
            key: row.key,
            label: row.label,
            value: formatNumber(row.value),
          })),
        }}
        {...shared}
      >
        <HorizontalBarChart
          data={categoryRows}
          onRowClick={(row) => navigate(buildListingLink('/products', meta, { category: row.key }))}
        />
      </ChartCard>

      <ChartCard
        title="User Activity"
        subtitle="Distinct users viewing listings — this schema has no login audit trail, so views stand in for sessions"
        icon={Activity}
        className="xl:col-span-2"
        tableData={{
          columns: [
            { key: 'label', title: 'Period' },
            { key: 'active', title: 'Active users', align: 'right' },
            { key: 'registered', title: 'New registrations', align: 'right' },
          ],
          rows: (charts?.userActivity || []).map((point, index) => ({
            key: point.bucket,
            label: point.label,
            active: formatNumber(point.value),
            registered: formatNumber(charts?.userRegistrations?.[index]?.value),
          })),
        }}
        {...shared}
      >
        <LineChart
          data={(charts?.userActivity || []).map((point, index) => ({
            label: point.label,
            active: point.value,
            registered: charts?.userRegistrations?.[index]?.value ?? 0,
          }))}
          series={[
            { key: 'active', name: 'Active users' },
            { key: 'registered', name: 'New registrations' },
          ]}
        />
      </ChartCard>
    </div>
  )
}

export default ChartsSection
