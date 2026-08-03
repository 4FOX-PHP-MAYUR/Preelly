import React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  CheckSquare,
  FileText,
  Layers,
  Package as PackageIcon,
  Users,
  Warehouse,
} from 'lucide-react'
import Panel from '../../../components/AdminUI/Panel'
import { usePermission } from '../../../hooks/usePermission'

/**
 * Shortcuts to the tasks admins start from the dashboard.
 *
 * Each action is gated by the same module permission its destination page uses,
 * so an admin never sees a button that lands them on the Forbidden page.
 */
function QuickActions() {
  const categories = usePermission('Categories')
  const packages = usePermission('Packages')
  const listings = usePermission('Listings')
  const transactions = usePermission('Transactions')
  const users = usePermission('Users')
  const reports = usePermission('Reports')
  const storage = usePermission('Storage Facilities')

  const actions = [
    { label: 'Add Category', to: '/categories/new', icon: Layers, allowed: categories.canCreate },
    { label: 'Add Package', to: '/packages/new', icon: PackageIcon, allowed: packages.canCreate },
    { label: 'Approve Products', to: '/products/pending', icon: CheckSquare, allowed: listings.canView },
    { label: 'View Transactions', to: '/transactions', icon: ArrowLeftRight, allowed: transactions.canView },
    { label: 'View Users', to: '/users', icon: Users, allowed: users.canView },
    { label: 'View Reports', to: '/reports', icon: FileText, allowed: reports.canView },
    {
      label: 'Add Storage Facility',
      to: '/storage-facilities/new',
      icon: Warehouse,
      allowed: storage.canCreate,
    },
  ].filter((action) => action.allowed)

  if (!actions.length) return null

  return (
    <Panel>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {actions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-3 text-center transition-colors hover:border-primary-300 hover:bg-primary-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 dark:border-slate-800 dark:hover:border-primary-800 dark:hover:bg-primary-950/30"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-transform group-hover:scale-105 dark:bg-primary-950/40 dark:text-primary-400">
              <action.icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-xs font-medium leading-tight text-slate-700 dark:text-slate-300">
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </Panel>
  )
}

export default QuickActions
