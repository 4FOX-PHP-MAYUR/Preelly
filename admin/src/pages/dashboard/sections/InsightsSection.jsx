import React from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  CalendarClock,
  Eye,
  Gauge,
  MapPin,
  Percent,
  Search,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react'
import Panel from '../../../components/AdminUI/Panel'
import ChartCard from '../../../components/AdminUI/ChartCard'
import EmptyState from '../../../components/AdminUI/EmptyState'
import { SkeletonList } from '../../../components/AdminUI/Skeleton'
import { HorizontalBarChart, formatCurrency, formatNumber } from '../../../components/AdminUI/charts'
import { buildListingLink, formatDate } from '../dashboardConstants'

/**
 * Business insight panels — the "so what" layer above the raw counts.
 *
 * Metrics with no data source in this schema (offers, offer acceptance) are
 * rendered as explicitly unavailable rather than as a misleading zero.
 */
function InsightsSection({ insights, meta, loading, refreshing, error, onRetry, currency = 'AED' }) {
  const conversion = insights?.conversion
  const shared = { loading, refreshing, error, onRetry }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MiniStat
          icon={Percent}
          label="Conversion rate"
          value={`${formatNumber(conversion?.conversionRate, 2)}%`}
          hint="Registered → package buyers"
          loading={loading}
        />
        <MiniStat
          icon={Gauge}
          label="Products per seller"
          value={formatNumber(conversion?.averageProductsPerUser, 2)}
          hint="Average across active sellers"
          loading={loading}
        />
        <MiniStat
          icon={TrendingUp}
          label="Revenue per user"
          value={formatCurrency(conversion?.averageRevenuePerUser, currency)}
          hint="Total revenue ÷ registered users"
          loading={loading}
        />
        <MiniStat
          icon={Timer}
          label="Avg time to sell"
          value={
            insights?.timeToSell?.soldCount
              ? `${formatNumber(insights.timeToSell.averageDays, 1)} days`
              : '—'
          }
          hint={`${formatNumber(insights?.timeToSell?.soldCount)} sold in range`}
          loading={loading}
        />
        <MiniStat
          icon={Users}
          label="Repeat buyers"
          value={formatNumber(conversion?.repeatBuyers)}
          hint="More than one purchase"
          loading={loading}
        />
        <MiniStat
          icon={Users}
          label="Repeat sellers"
          value={formatNumber(conversion?.repeatSellers)}
          hint="More than one package"
          loading={loading}
        />
        <MiniStat
          icon={Users}
          label="New vs returning"
          value={`${formatNumber(insights?.newVsReturning?.newUsers)} / ${formatNumber(
            insights?.newVsReturning?.returningUsers,
          )}`}
          hint="Active users in range"
          loading={loading}
        />
        <MiniStat
          icon={Award}
          label="Best revenue month"
          value={insights?.highestRevenueMonth?.label || '—'}
          hint={
            insights?.highestRevenueMonth
              ? formatCurrency(insights.highestRevenueMonth.revenue, currency, true)
              : 'No successful payments yet'
          }
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
        <ChartCard
          title="Top Categories by Product Count"
          subtitle="Top 10 in the selected range"
          icon={TrendingUp}
          tableData={toTable(insights?.topCategories?.byProductCount, 'Category', 'Products', formatNumber)}
          {...shared}
        >
          <HorizontalBarChart data={insights?.topCategories?.byProductCount || []} />
        </ChartCard>

        <ChartCard
          title="Top Categories by Revenue"
          subtitle={`Top 10 in the selected range · ${currency}`}
          icon={TrendingUp}
          tableData={toTable(insights?.topCategories?.byRevenue, 'Category', `Revenue (${currency})`, (value) =>
            formatCurrency(value, currency),
          )}
          {...shared}
        >
          <HorizontalBarChart
            data={insights?.topCategories?.byRevenue || []}
            formatValue={(value) => formatCurrency(value, currency, true)}
          />
        </ChartCard>

        <ChartCard
          title="Top Performing Cities"
          subtitle="Listings per city"
          icon={MapPin}
          tableData={toTable(insights?.locations?.cities, 'City', 'Products', formatNumber)}
          {...shared}
        >
          <HorizontalBarChart data={insights?.locations?.cities || []} />
        </ChartCard>

        <ChartCard
          title="Top Performing Regions"
          subtitle="Listings per country / region"
          icon={MapPin}
          tableData={toTable(insights?.locations?.regions, 'Region', 'Products', formatNumber)}
          {...shared}
        >
          <HorizontalBarChart data={insights?.locations?.regions || []} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-3">
        <ListPanel
          title="Most Viewed Products"
          icon={Eye}
          loading={loading}
          items={insights?.mostViewedProducts}
          emptyText="No product views in range"
          renderItem={(item) => (
            <Link
              key={item.productId}
              to={`/products/${item.productId}`}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{item.title}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.category}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {formatNumber(item.views)}
              </span>
            </Link>
          )}
        />

        <ListPanel
          title="Popular Search Keywords"
          icon={Search}
          loading={loading}
          items={insights?.popularSearches?.items}
          emptyText="No searches recorded"
          footer={
            insights?.popularSearches?.source === 'all_time'
              ? 'No searches in this range — showing all-time analytics'
              : undefined
          }
          renderItem={(item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2"
            >
              <span className="truncate text-sm text-slate-700 dark:text-slate-300">{item.label}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {formatNumber(item.value)}
              </span>
            </div>
          )}
        />

        <Panel>
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
            </span>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
              Needs Attention
            </h3>
          </div>

          {loading ? (
            <SkeletonList rows={4} />
          ) : (
            <ul className="space-y-2 text-sm">
              <AttentionRow
                label="Products awaiting approval"
                value={insights?.pendingApprovals?.products}
                to={buildListingLink('/products/pending', meta)}
              />
              <AttentionRow
                label="Identity verifications pending"
                value={insights?.pendingApprovals?.identityVerifications}
                to="/identity-verification"
              />
              <AttentionRow
                label={`Packages expiring in ${insights?.expiringPackages?.days ?? 7} days`}
                value={insights?.expiringPackages?.total}
                to="/transactions"
              />
              <AttentionRow
                label={`Listings near expiry (${insights?.productsNearExpiry?.days ?? 7} days)`}
                value={insights?.productsNearExpiry?.items?.length}
                to={buildListingLink('/products/approved', meta)}
              />
              <AttentionRow label="Chats started" value={conversion?.totalChatsStarted} />
              <AttentionRow
                label="Offers made"
                value={conversion?.totalOffers}
                unavailable="Not tracked"
              />
              <AttentionRow
                label="Offer acceptance rate"
                value={conversion?.offerAcceptanceRate}
                unavailable="Not tracked"
              />
            </ul>
          )}
        </Panel>
      </div>

      {(insights?.expiringPackages?.items?.length > 0 ||
        insights?.productsNearExpiry?.items?.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
          <ListPanel
            title={`Users with Packages Expiring (${insights?.expiringPackages?.days ?? 7} days)`}
            icon={CalendarClock}
            loading={loading}
            items={insights?.expiringPackages?.items}
            emptyText="No packages expiring soon"
            renderItem={(item) => (
              <Link
                key={item.transactionId}
                to={`/users/${item.userId}`}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {item.userName}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {item.packageName} · {item.userEmail}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(item.expiresAt)}
                </span>
              </Link>
            )}
          />

          <ListPanel
            title={`Products Near Expiry (${insights?.productsNearExpiry?.days ?? 7} days)`}
            icon={CalendarClock}
            loading={loading}
            items={insights?.productsNearExpiry?.items}
            emptyText="No listings expiring soon"
            renderItem={(item) => (
              <Link
                key={item.productId}
                to={`/products/${item.productId}`}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{item.title}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.packageName}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(item.expiresAt)}
                </span>
              </Link>
            )}
          />
        </div>
      )}
    </div>
  )
}

function toTable(rows, labelTitle, valueTitle, format) {
  return {
    columns: [
      { key: 'label', title: labelTitle },
      { key: 'value', title: valueTitle, align: 'right' },
    ],
    rows: (rows || []).map((row) => ({
      key: row.key || row.label,
      label: row.label,
      value: format(row.value),
    })),
  }
}

function MiniStat({ icon: Icon, label, value, hint, loading }) {
  return (
    <Panel className="!p-3.5 sm:!p-4">
      {loading ? (
        <div className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800" />
          <div className="h-6 w-16 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          </div>
          <p className="mt-1.5 truncate text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
            {value}
          </p>
          {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
        </>
      )}
    </Panel>
  )
}

function AttentionRow({ label, value, to, unavailable }) {
  const isUnavailable = value === null || value === undefined
  const content = (
    <>
      <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">{label}</span>
      <span
        className={`shrink-0 font-semibold tabular-nums ${
          isUnavailable ? 'text-xs font-normal text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'
        }`}
      >
        {isUnavailable ? unavailable || '—' : formatNumber(value)}
      </span>
    </>
  )

  return (
    <li>
      {to && !isUnavailable ? (
        <Link
          to={to}
          className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
        >
          {content}
        </Link>
      ) : (
        <div className="flex items-center justify-between gap-3 px-2 py-1.5">{content}</div>
      )}
    </li>
  )
}

function ListPanel({ title, icon: Icon, items, loading, emptyText, renderItem, footer }) {
  return (
    <Panel>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h3 className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
          {title}
        </h3>
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : !items?.length ? (
        <EmptyState title={emptyText} className="!py-6" />
      ) : (
        <div className="-mx-2 divide-y divide-slate-100 dark:divide-slate-800">
          {items.map(renderItem)}
        </div>
      )}

      {footer && (
        <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
          {footer}
        </p>
      )}
    </Panel>
  )
}

export default InsightsSection
