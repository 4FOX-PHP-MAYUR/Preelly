import React from 'react'
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  ShieldCheck,
  Ban,
  Package as PackageIcon,
  CheckCircle2,
  Clock3,
  XCircle,
  Tag,
  CalendarX2,
  FileEdit,
  PlusCircle,
  Banknote,
  Wallet,
  TrendingUp,
  Receipt,
  AlertTriangle,
  Hourglass,
  Sigma,
  Layers,
  Repeat,
  Warehouse,
  CalendarCheck,
  CalendarClock,
} from 'lucide-react'
import Card from '../../../components/AdminUI/Card'
import { SkeletonStatCard } from '../../../components/AdminUI/Skeleton'
import { formatCompact, formatCurrency, formatNumber } from '../../../components/AdminUI/charts'
import { buildListingLink } from '../dashboardConstants'

/**
 * The KPI grid — five groups of cards.
 *
 * Every card that has a matching listing page is a link, carrying the
 * dashboard's resolved window plus that card's own filter, so clicking
 * "Pending Approval" lands on the pending products list for the same dates.
 */
function SummaryCards({ summary, meta, loading, currency = 'AED' }) {
  const users = summary?.users
  const products = summary?.products
  const transactions = summary?.transactions
  const packages = summary?.packages
  const storage = summary?.storage
  const growth = summary?.growth

  const link = (path, extra) => buildListingLink(path, meta, extra)

  return (
    <div className="space-y-6">
      <Group
        title="Users"
        subtitle={users ? `${formatNumber(users.newUsers)} new in ${meta?.rangeLabel || 'range'}` : undefined}
        loading={loading}
        cards={[
          {
            title: 'Total Registered',
            value: formatNumber(users?.totalRegistered),
            icon: Users,
            accent: 'default',
            to: '/users',
            trend: growth?.users?.changePercent,
            trendLabel: 'vs previous period',
          },
          {
            title: 'Active Users',
            value: formatNumber(users?.activeUsers),
            icon: UserCheck,
            accent: 'green',
            to: link('/users', { status: 'active' }),
          },
          {
            title: 'Inactive Users',
            value: formatNumber(users?.inactiveUsers),
            icon: UserX,
            accent: 'slate',
            to: link('/users', { status: 'inactive' }),
          },
          {
            title: 'New Users Today',
            value: formatNumber(users?.newUsersToday),
            icon: UserPlus,
            accent: 'purple',
            to: '/users?range=today',
          },
          {
            title: 'New This Month',
            value: formatNumber(users?.newUsersThisMonth),
            icon: UserPlus,
            accent: 'default',
            to: '/users?range=this_month',
          },
          {
            title: 'Verified Users',
            value: formatNumber(users?.verifiedUsers),
            icon: ShieldCheck,
            accent: 'green',
            to: link('/users', { isVerified: 'true' }),
          },
          {
            title: 'Blocked Users',
            value: formatNumber(users?.blockedUsers),
            icon: Ban,
            accent: 'red',
            to: link('/users', { status: 'inactive' }),
            hint: 'Blocking sets a user inactive',
          },
        ]}
      />

      <Group
        title="Products"
        subtitle={products ? `${formatNumber(products.totalInRange)} posted in ${meta?.rangeLabel || 'range'}` : undefined}
        loading={loading}
        cards={[
          {
            title: 'Total Products',
            value: formatNumber(products?.total),
            icon: PackageIcon,
            accent: 'default',
            to: '/products',
            trend: growth?.products?.changePercent,
            trendLabel: 'vs previous period',
          },
          {
            title: 'Active Products',
            value: formatNumber(products?.active),
            icon: CheckCircle2,
            accent: 'green',
            to: link('/products/approved', {}),
          },
          {
            title: 'Pending Approval',
            value: formatNumber(products?.pending),
            icon: Clock3,
            accent: 'yellow',
            to: link('/products/pending', {}),
          },
          {
            title: 'Rejected Products',
            value: formatNumber(products?.rejected),
            icon: XCircle,
            accent: 'red',
            to: link('/products', { status: 'rejected' }),
          },
          {
            title: 'Sold Products',
            value: formatNumber(products?.sold),
            icon: Tag,
            accent: 'purple',
            to: link('/products/sold', {}),
          },
          {
            title: 'Expired Products',
            value: formatNumber(products?.expired),
            icon: CalendarX2,
            accent: 'slate',
            hint: 'Package expired',
          },
          {
            title: 'Draft Products',
            value: formatNumber(products?.drafts),
            icon: FileEdit,
            accent: 'slate',
            hint: 'Unpublished drafts',
          },
          {
            title: 'Added Today',
            value: formatNumber(products?.addedToday),
            icon: PlusCircle,
            accent: 'default',
            to: '/products',
          },
        ]}
      />

      <Group
        title="Transactions"
        subtitle={`Money totals count successful payments only`}
        loading={loading}
        cards={[
          {
            title: 'Total Revenue',
            value: formatCurrency(transactions?.revenue, currency, true),
            icon: Banknote,
            accent: 'green',
            to: link('/transactions', { paymentStatus: 'Success' }),
            trend: growth?.revenue?.changePercent,
            trendLabel: 'vs previous period',
          },
          {
            title: "Today's Revenue",
            value: formatCurrency(transactions?.todayRevenue, currency, true),
            icon: Wallet,
            accent: 'default',
            to: '/transactions',
          },
          {
            title: 'Monthly Revenue',
            value: formatCurrency(transactions?.monthlyRevenue, currency, true),
            icon: TrendingUp,
            accent: 'purple',
            to: '/transactions',
          },
          {
            title: 'Successful',
            value: formatNumber(transactions?.successfulTransactions),
            icon: Receipt,
            accent: 'green',
            to: link('/transactions', { paymentStatus: 'Success' }),
          },
          {
            title: 'Failed',
            value: formatNumber(transactions?.failedTransactions),
            icon: AlertTriangle,
            accent: 'red',
            to: link('/transactions', { paymentStatus: 'Failed' }),
          },
          {
            title: 'Pending',
            value: formatNumber(transactions?.pendingTransactions),
            icon: Hourglass,
            accent: 'yellow',
            to: link('/transactions', { paymentStatus: 'Pending' }),
          },
          {
            title: 'Avg Transaction',
            value: formatCurrency(transactions?.averageTransactionValue, currency, true),
            icon: Sigma,
            accent: 'default',
          },
        ]}
      />

      <Group
        title="Packages"
        subtitle={packages?.mostPurchased ? `Most purchased: ${packages.mostPurchased.name}` : undefined}
        loading={loading}
        cards={[
          {
            title: 'Package Purchases',
            value: formatNumber(packages?.totalPurchases),
            icon: Layers,
            accent: 'default',
            to: '/packages',
          },
          {
            title: 'Active Subscriptions',
            value: formatNumber(packages?.activeSubscriptions),
            icon: CheckCircle2,
            accent: 'green',
          },
          {
            title: 'Expired Packages',
            value: formatNumber(packages?.expiredSubscriptions),
            icon: CalendarX2,
            accent: 'slate',
          },
          {
            title: 'Package Revenue',
            value: formatCurrency(packages?.revenue, currency, true),
            icon: Banknote,
            accent: 'purple',
            to: '/transactions',
          },
          {
            title: 'Most Purchased',
            value: packages?.mostPurchased?.name || '—',
            icon: Repeat,
            accent: 'yellow',
            hint: packages?.mostPurchased
              ? `${formatCompact(packages.mostPurchased.purchases)} purchases`
              : 'No purchases in range',
            to: '/packages',
          },
        ]}
      />

      <Group
        title="Storage Facility"
        loading={loading}
        cards={[
          {
            title: 'Total Bookings',
            value: formatNumber(storage?.totalBookings),
            icon: Warehouse,
            accent: 'default',
            to: '/storage-facilities',
          },
          {
            title: 'Active Bookings',
            value: formatNumber(storage?.activeBookings),
            icon: CalendarClock,
            accent: 'green',
          },
          {
            title: 'Completed Bookings',
            value: formatNumber(storage?.completedBookings),
            icon: CalendarCheck,
            accent: 'slate',
          },
          {
            title: 'Storage Revenue',
            value: formatCurrency(storage?.revenue, currency, true),
            icon: Banknote,
            accent: 'purple',
            to: '/transactions',
          },
        ]}
      />
    </div>
  )
}

function Group({ title, subtitle, cards, loading }) {
  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </h3>
        {subtitle && (
          <p className="truncate text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>
        )}
      </div>
      {/* auto-fill so a 4-card group and a 7-card group both fill the row
          instead of leaving one squeezed to an eighth of the width. The track
          minimum is responsive because auto-fill never shrinks below it — a
          fixed 12.5rem overflows a 390px phone. */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr))] sm:gap-4 sm:[grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr))]">
        {loading
          ? cards.map((card) => <SkeletonStatCard key={card.title} />)
          : cards.map((card) => (
              <Card
                key={card.title}
                title={card.title}
                value={card.value}
                icon={card.icon}
                accent={card.accent}
                to={card.to}
                hint={card.hint}
                trend={card.trend}
                trendLabel={card.trendLabel}
              />
            ))}
      </div>
    </section>
  )
}

export default SummaryCards
