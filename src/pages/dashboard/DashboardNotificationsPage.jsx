import { useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { userService } from '../../services/api'

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ''
  }
}

export default function DashboardNotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    userService
      .getNotifications({ limit: 30 })
      .then((res) => {
        if (cancelled) return
        setItems(res.data.items || [])
      })
      .catch((e) => {
        if (cancelled) return
        setError(e?.response?.data?.message || 'Failed to load notifications')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Activity</div>
        <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">Notifications</div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-4 animate-pulse h-64" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-8 text-center">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">No notifications</div>
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">When things happen (orders/messages), they’ll appear here.</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-900">
            {items.map((n) => (
              <div key={n._id} className="p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary-50 dark:bg-gray-900 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-primary-700 dark:text-primary-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{n.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{fmt(n.createdAt)}</div>
                  </div>
                  {n.body ? <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{n.body}</div> : null}
                  {!n.isRead ? (
                    <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                      <Check className="h-3.5 w-3.5" /> Unread
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

