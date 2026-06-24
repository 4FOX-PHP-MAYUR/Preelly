import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  Bookmark,
  Bell,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  User,
  X,
} from 'lucide-react'
import { logout, selectUser } from '@shared/store/slices/authSlice'
import { applyTheme, getInitialTheme } from '@shared/utils/theme'
import { userService, chatService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'

const primaryNav = [
  { to: '/dashboard', label: 'My Profile', icon: User, end: true },
  { to: '/dashboard/settings', label: 'Privacy and Security', icon: ShieldCheck },
]

const quickLinks = [
  { to: '/dashboard/wishlist', label: 'My Bookmark', icon: Bookmark },
  { to: '/dashboard/messages', label: 'Messages', icon: MessageCircle },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
]

const popularCategories = [
  'Luxury Cars',
  'Sports Cars',
  'SUVs',
  'Classic Cars',
  'Electric Vehicles',
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
  const [notifCount, setNotifCount] = useState(0)   // bell: all unread notifications
  const [chatUnread, setChatUnread] = useState(0)    // messages link: chat unread count

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Bell badge — all unread notification count
  useEffect(() => {
    let cancelled = false
    userService
      .getNotifications({ limit: 50 })
      .then((res) => {
        if (cancelled) return
        const items = res?.data?.items || []
        setNotifCount(items.filter((n) => !n.isRead).length)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Messages badge — chat unread count only
  useEffect(() => {
    let cancelled = false
    chatService
      .getUnreadCount()
      .then((res) => {
        if (cancelled) return
        const n = res?.data?.unread ?? res?.data?.unreadCount
        if (typeof n === 'number') setChatUnread(n)
      })
      .catch(() => {})
    return () => { cancelled = true }
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
    await dispatch(logout('user-click'))
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
      {/* Mobile-only close button row */}
      <div className="md:hidden h-12 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-900">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Menu</span>
        <button
          type="button"
          className="p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-900"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5 text-gray-700 dark:text-gray-200" />
        </button>
      </div>

      <nav className="flex-1 px-4 py-5 overflow-y-auto space-y-6">
        {/* Primary nav */}
        <div className="space-y-1">
          {primaryNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            )
          })}
        </div>

        {/* Quick links */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 mb-2">Quick Links</p>
          <div className="space-y-1">
            {quickLinks.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900 transition-colors"
                >
                  <Icon className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="truncate flex-1">{item.label}</span>
                  {item.label === 'Messages' && chatUnread > 0 && (
                    <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                      {chatUnread > 99 ? '99+' : chatUnread}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        </div>

        {/* Popular categories */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 mb-2">Popular Categories</p>
          <div className="space-y-1">
            {popularCategories.map((cat) => (
              <NavLink
                key={cat}
                to={`/search?q=${encodeURIComponent(cat)}`}
                className="block px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900 transition-colors"
              >
                {cat}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )

  return (
    <div className="viewport-below-header bg-gray-50 dark:bg-black">
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

