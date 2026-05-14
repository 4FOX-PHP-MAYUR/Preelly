import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  Bell,
  Heart,
  LayoutDashboard,
  List,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Settings,
  ShoppingBag,
  Sun,
  X,
} from 'lucide-react'
import { logout, selectUser } from '../../store/slices/authSlice'
import { applyTheme, getInitialTheme } from '../../utils/theme'
import { userService } from '../../services/api'
import { getMediaUrl } from '../../utils/helpers'

const navItems = [
  { to: '/dashboard', label: 'Profile Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/listings', label: 'My Listings', icon: List },
  { to: '/dashboard/orders', label: 'My Orders', icon: ShoppingBag },
  { to: '/dashboard/messages', label: 'Messages', icon: MessageCircle },
  { to: '/dashboard/wishlist', label: 'Saved / Wishlist', icon: Heart },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
]

function cx(...v) {
  return v.filter(Boolean).join(' ')
}

function DashboardLayout() {
  const user = useSelector(selectUser)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState(() => getInitialTheme())
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    let cancelled = false
    userService
      .getNotifications({ limit: 20 })
      .then((res) => {
        if (cancelled) return
        const items = res?.data?.items || []
        const unread = items.filter((n) => !n.isRead).length
        setNotifCount(unread)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const pageTitle = useMemo(() => {
    if (location.pathname.startsWith('/dashboard/listings')) return 'My Listings'
    if (location.pathname.startsWith('/dashboard/orders')) return 'My Orders'
    if (location.pathname.startsWith('/dashboard/messages')) return 'Messages'
    if (location.pathname.startsWith('/dashboard/wishlist')) return 'Wishlist'
    if (location.pathname.startsWith('/dashboard/settings')) return 'Settings'
    return 'Dashboard'
  }, [location.pathname])

  const onLogout = async () => {
    await dispatch(logout())
    navigate('/', { replace: true })
  }

  const themeBtn = (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900"
      title="Toggle theme"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  )

  const sidebar = (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-900">
      <div className="h-16 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-900">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary-600 text-white flex items-center justify-center font-bold">
            P
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Preelly</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">User Dashboard</div>
          </div>
        </Link>
        <button
          type="button"
          className="md:hidden p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-900"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5 text-gray-700 dark:text-gray-200" />
        </button>
      </div>

      <div className="p-3">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-900 p-3">
          <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-900 overflow-hidden flex items-center justify-center">
            {user?.avatar ? (
              <img src={getMediaUrl(user.avatar) || user.avatar} alt={user.name || 'User'} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-gray-500 dark:text-gray-400">User</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {user?.displayName || user?.name || 'User'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || ''}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 pb-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-gray-900 dark:text-primary-300'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900',
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          )
        })}
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </nav>
    </div>
  )

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-black">
      <div className="max-w-7xl mx-auto">
        <div className="md:grid md:grid-cols-[280px_1fr] md:gap-0">
          {/* Desktop sidebar */}
          <div className="hidden md:block md:sticky md:top-16 md:h-[calc(100vh-4rem)]">{sidebar}</div>

          {/* Mobile sidebar overlay */}
          {sidebarOpen ? (
            <Fragment>
              <div
                className="fixed inset-0 bg-black/40 z-40 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <div className="fixed inset-y-0 left-0 w-80 max-w-[85vw] z-50 md:hidden">
                {sidebar}
              </div>
            </Fragment>
          ) : null}

          {/* Main */}
          <div className="min-w-0">
            {/* Topbar */}
            <div className="sticky top-16 z-30 bg-gray-50/80 dark:bg-black/80 backdrop-blur border-b border-gray-200 dark:border-gray-900">
              <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    className="md:hidden p-2 rounded-lg border border-gray-200 dark:border-gray-800"
                    onClick={() => setSidebarOpen(true)}
                    aria-label="Open sidebar"
                  >
                    <Menu className="h-5 w-5 text-gray-700 dark:text-gray-200" />
                  </button>
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{pageTitle}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">Manage your marketplace account</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {themeBtn}
                  <Link
                    to="/dashboard/notifications"
                    className="relative inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 p-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900"
                    title="Notifications"
                  >
                    <Bell className="h-5 w-5" />
                    {notifCount > 0 ? (
                      <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-red-600 text-white text-[11px] flex items-center justify-center">
                        {notifCount > 99 ? '99+' : notifCount}
                      </span>
                    ) : null}
                  </Link>
                </div>
              </div>
            </div>

            <main className="px-4 sm:px-6 py-6">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardLayout

