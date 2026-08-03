import React from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bell, CreditCard, Layers, PackageCheck, UserPlus, Warehouse } from 'lucide-react'
import Panel from '../../../components/AdminUI/Panel'
import EmptyState from '../../../components/AdminUI/EmptyState'
import { SkeletonList } from '../../../components/AdminUI/Skeleton'
import { useDashboardTable } from '../useDashboard'
import { ACTIVITY_TONE, formatDate } from '../dashboardConstants'

const TYPE_ICONS = {
  user_registered: UserPlus,
  product_approval: PackageCheck,
  package_purchase: Layers,
  storage_booking: Warehouse,
  payment: CreditCard,
  system_error: AlertTriangle,
}

/**
 * Recent activity across the marketplace, assembled from the events the schema
 * already records: signups, approval requests, payments, package purchases and
 * storage bookings. There is no system-error log to read, so that category only
 * appears if one is added later.
 */
function NotificationsPanel({ filters }) {
  const { data, loading } = useDashboardTable('notifications', filters, { limit: 8 })
  const items = data?.items || []

  return (
    <Panel className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400">
          <Bell className="h-4 w-4" aria-hidden="true" />
        </span>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
          Recent Activity
        </h3>
      </div>

      {loading ? (
        <SkeletonList rows={5} />
      ) : !items.length ? (
        <EmptyState icon={Bell} title="Nothing new" description="No activity in the selected range." className="!py-8" />
      ) : (
        <ul className="-mx-2 flex-1 divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item) => {
            const Icon = TYPE_ICONS[item.type] || Bell
            return (
              <li key={item.id}>
                <Link
                  to={item.link || '#'}
                  className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      ACTIVITY_TONE[item.severity] || ACTIVITY_TONE.info
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {item.title}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {item.description}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400 dark:text-slate-500">
                    {formatDate(item.at, true)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

export default NotificationsPanel
