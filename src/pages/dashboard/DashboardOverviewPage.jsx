import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { BarChart3, BadgeCheck, MapPin, Pencil, Phone, ShoppingBag, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { userService } from '../../services/api'
import { refreshUser } from '../../store/slices/authSlice'
import { getMediaUrl } from '../../utils/helpers'

function StatCard({ label, value, icon: Icon, hint }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</div>
          {hint ? <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</div> : null}
        </div>
        <div className="h-10 w-10 rounded-lg bg-primary-50 dark:bg-gray-900 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary-700 dark:text-primary-300" />
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return <div className="rounded-xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-4 animate-pulse h-24" />
}

export default function DashboardOverviewPage() {
  const dispatch = useDispatch()
  const user = useSelector((s) => s.auth.user)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    userService
      .getDashboard()
      .then((res) => {
        if (cancelled) return
        setData(res.data)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e?.response?.data?.message || 'Failed to load dashboard')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // keep local user in sync (e.g. after profile setup)
    dispatch(refreshUser()).catch(() => {})
  }, [dispatch])

  const stats = useMemo(() => {
    const s = data?.stats || {}
    return {
      total: Number(s.totalProducts || 0),
      active: Number(s.activeProducts || 0),
      sold: Number(s.soldProducts || 0),
      purchases: Number(s.purchaseCount || 0),
    }
  }, [data])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-5">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-900 overflow-hidden flex items-center justify-center">
              {user?.avatar ? (
                <img src={getMediaUrl(user.avatar) || user.avatar} alt={user.name || 'User'} className="h-full w-full object-cover" />
              ) : (
                <User className="h-7 w-7 text-gray-500 dark:text-gray-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">{user?.displayName || user?.name || 'User'}</h2>
                {user?.isVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded-full">
                    <BadgeCheck className="h-4 w-4" /> Verified
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-300 truncate">{user?.email || ''}</div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-4 w-4" /> {user?.phone || 'Phone not added'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> {user?.location?.city || 'Location not set'}
                </span>
                {user?.address?.line1 ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {user?.address?.line1}
                  </span>
                ) : null}
                {user?.dob ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {new Date(user.dob).toLocaleDateString()}
                  </span>
                ) : null}
                {user?.gender ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {user?.gender.replaceAll('_', ' ')}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/settings"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 text-sm font-medium"
            >
              <Pencil className="h-4 w-4" />
              Edit Profile
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard label="Total listings" value={stats.total} icon={BarChart3} hint="All statuses" />
            <StatCard label="Active listings" value={stats.active} icon={ShoppingBag} hint="Visible to buyers" />
            <StatCard label="Sold items" value={stats.sold} icon={ShoppingBag} hint="Completed sales" />
            <StatCard label="Purchase count" value={stats.purchases} icon={ShoppingBag} hint="Buyer orders" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quick actions</div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              to="/post-ad"
              className="rounded-lg border border-gray-200 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900 p-4"
            >
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Post a new listing</div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Create a new product ad</div>
            </Link>
            <Link
              to="/dashboard/listings"
              className="rounded-lg border border-gray-200 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900 p-4"
            >
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Manage listings</div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Edit, delete, mark sold</div>
            </Link>
            <Link
              to="/dashboard/messages"
              className="rounded-lg border border-gray-200 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900 p-4"
            >
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Messages</div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">View your conversations</div>
            </Link>
            <Link
              to="/dashboard/wishlist"
              className="rounded-lg border border-gray-200 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900 p-4"
            >
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Wishlist</div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Saved products</div>
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Getting started</div>
          </div>
          <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-200">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <div className="font-medium">Complete your profile</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Add phone and location to build trust.</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <div className="font-medium">Post your first listing</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Upload images and set a great price.</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <div className="font-medium">Respond quickly to messages</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Fast replies close deals faster.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toast('Tip: Use filters in Listings to find items fast.')}
              className="mt-2 inline-flex items-center gap-2 text-primary-700 dark:text-primary-300 text-sm font-medium"
            >
              <User className="h-4 w-4" /> Learn more
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

