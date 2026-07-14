import { useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Search as SearchIcon,
  Settings,
  Shield,
  User,
} from 'lucide-react'
import BrandLogo from '@shared/components/BrandLogo'
import { ChatIcon, MySearchIcon, MyAdsIcon, NotificationIcon } from './headerNavIcons'
import SearchBar from '../Search/SearchBar'
import { MARKETPLACE_TOPBAR_DESKTOP } from './marketplaceLayoutStyles'
import {
  logout,
  selectIsAdmin,
  selectIsAuthenticated,
  selectUser,
} from '@shared/store/slices/authSlice'
import { getMediaUrl, isUserVerified } from '@shared/utils/helpers'
import { ADMIN_PANEL_URL } from '@shared/utils/constants'

function TopBarIcon({ to, label, Icon, badge }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-brand"
    >
      <span className="relative">
        <Icon className="h-5 w-5" />
        {badge ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
            {Math.min(badge, 99)}
          </span>
        ) : null}
      </span>
      <span className="text-[11px] font-medium leading-none">{label}</span>
    </Link>
  )
}

/**
 * Shared marketplace top bar (search + quick-access icons + profile).
 * Used on the home page and browse/detail shells that mirror the home layout.
 */
function MarketplaceTopBar({ className = '', onToggleMobileMenu, topBarColSpan = 'lg:col-span-2' }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const searchDefaultQuery = location.pathname.startsWith('/search')
    ? new URLSearchParams(location.search).get('q') || ''
    : ''
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const isAdmin = useSelector(selectIsAdmin)
  const user = useSelector(selectUser)
  const unreadChatCount = useSelector((state) => (isAuthenticated ? state.feed?.unreadCount || 0 : 0))

  const [profileOpen, setProfileOpen] = useState(false)
  const profileCloseTimer = useRef(null)

  const profileEnter = () => {
    if (profileCloseTimer.current) clearTimeout(profileCloseTimer.current)
    setProfileOpen(true)
  }
  const profileLeave = () => {
    profileCloseTimer.current = setTimeout(() => setProfileOpen(false), 200)
  }

  const handleLogout = () => {
    dispatch(logout('user-click'))
    navigate('/')
  }

  const avatarSrc = user?.avatar ? getMediaUrl(user.avatar) || user.avatar : null
  const displayName = user?.displayName || user?.name || 'Explore Preelly'
  const userSubcopy = isAuthenticated
    ? isUserVerified(user)
      ? 'Verified account'
      : 'Marketplace member'
    : 'Buy. Sell. Watch.'

  return (
    <div className={`bg-white ${topBarColSpan} ${className}`}>
      <div className="border-b border-slate-200 p-3 sm:p-5 lg:hidden">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link to="/" className="inline-flex shrink-0 items-center">
            <BrandLogo className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            {!isAuthenticated && (
              <Link
                to="/login"
                className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white sm:hidden"
              >
                Login
              </Link>
            )}
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link
              to={isAuthenticated ? '/dashboard/notifications' : '/login'}
              className="relative rounded-full border border-slate-200 p-2 text-slate-600"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadChatCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                  {Math.min(unreadChatCount, 99)}
                </span>
              )}
            </Link>
          </div>
        </div>

        <SearchBar
          variant="home"
          placeholder="Search for cars, properties, electronics..."
          className="w-full"
          defaultQuery={searchDefaultQuery}
        />

        <div className="mt-3 flex items-center gap-1 sm:gap-2">
          <TopBarIcon to={isAuthenticated ? '/chat' : '/login'} label="Chat" Icon={ChatIcon} badge={unreadChatCount} />
          <TopBarIcon to="/search" label="My Search" Icon={MySearchIcon} />
          <TopBarIcon to={isAuthenticated ? '/dashboard/listings' : '/login'} label="My Ads" Icon={MyAdsIcon} />
          <TopBarIcon to={isAuthenticated ? '/dashboard/notifications' : '/login'} label="Notification" Icon={NotificationIcon} />
        </div>
      </div>

      <div className={MARKETPLACE_TOPBAR_DESKTOP}>
        <SearchBar
          variant="marketplace"
          placeholder="Search for cars, properties, electronics..."
          className="w-full min-w-0"
          defaultQuery={searchDefaultQuery}
        />

        <div className="flex items-end gap-1 sm:gap-2">
          <TopBarIcon to={isAuthenticated ? '/chat' : '/login'} label="Chat" Icon={ChatIcon} badge={unreadChatCount} />
          <TopBarIcon to="/search" label="My Search" Icon={MySearchIcon} />
          <TopBarIcon to={isAuthenticated ? '/dashboard/listings' : '/login'} label="My Ads" Icon={MyAdsIcon} />
          <TopBarIcon to={isAuthenticated ? '/dashboard/notifications' : '/login'} label="Notification" Icon={NotificationIcon} />

          <div className="mb-2 ml-1 hidden h-8 w-px bg-slate-200 lg:block" />

        {isAuthenticated ? (
          <div
            className="relative flex-shrink-0"
            onMouseEnter={profileEnter}
            onMouseLeave={profileLeave}
          >
            <button
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 transition-all hover:border-slate-200 hover:bg-slate-50"
            >
              <span className="relative flex-shrink-0">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={displayName} className="h-9 w-9 rounded-full object-cover ring-2 ring-brand-100" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand">
                    <User className="h-5 w-5" />
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                {isUserVerified(user) && (
                  <img
                    src="/images/isverified.svg"
                    alt="Verified"
                    className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white"
                  />
                )}
              </span>
              <ChevronDown className={`hidden h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 lg:block ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div
                className="absolute right-0 top-full z-[9999] pt-1"
                onMouseEnter={profileEnter}
                onMouseLeave={profileLeave}
              >
                <div className="w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt={displayName} className="h-9 w-9 flex-shrink-0 rounded-full object-cover ring-2 ring-brand-100" />
                    ) : (
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                      <p className="truncate text-xs text-slate-500">{user?.email || userSubcopy}</p>
                    </div>
                  </div>
                  <nav className="py-1">
                    <Link to="/dashboard" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand">
                      <LayoutDashboard className="h-4 w-4 text-slate-400" />
                      Profile Overview
                    </Link>
                    <Link to="/dashboard/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand">
                      <Settings className="h-4 w-4 text-slate-400" />
                      Settings
                    </Link>
                    {isAdmin && (
                      <a href={ADMIN_PANEL_URL} onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-purple-600 transition-colors hover:bg-purple-50">
                        <Shield className="h-4 w-4" />
                        Admin Panel
                      </a>
                    )}
                  </nav>
                  <div className="border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="hidden items-center gap-3 md:flex">
            <Link to="/login" className="text-sm font-medium text-slate-600 transition hover:text-brand">
              Login
            </Link>
            <Link to="/signup" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
              Sign Up
            </Link>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

export default MarketplaceTopBar
