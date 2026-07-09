import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { selectIsAuthenticated, selectUser, selectIsAdmin, logout } from '@shared/store/slices/authSlice'
import { Bell, CheckCircle2, ChevronDown, LayoutDashboard, LogOut, Menu, Settings, Shield, SlidersHorizontal, User, X } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { chatService } from '@shared/services/api'
import { getSocket } from '@shared/services/socket'
import BrandLogo from '@shared/components/BrandLogo'
import SearchBar from '../Search/SearchBar'
import { getMediaUrl, isUserVerified } from '@shared/utils/helpers'
import { ADMIN_PANEL_URL } from '@shared/utils/constants'

/**
 * Site-wide header. Self-contained (owns its own auth/menu state) so it can be
 * dropped into any layout without prop wiring. Renders nothing on the home page
 * (HomeTopBar covers that) and on auth routes.
 */
function Header() {
  const location = useLocation()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const isAdmin = useSelector(selectIsAdmin)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileCloseTimer = useRef(null)

  const profileEnter = () => {
    if (profileCloseTimer.current) clearTimeout(profileCloseTimer.current)
    setProfileOpen(true)
  }
  const profileLeave = () => {
    profileCloseTimer.current = setTimeout(() => setProfileOpen(false), 200)
  }
  const feedUnreadCount = useSelector((state) => state.feed?.unreadCount || 0)
  const [chatUnreadCount, setChatUnreadCount] = useState(feedUnreadCount)

  useEffect(() => {
    setChatUnreadCount(feedUnreadCount)
  }, [feedUnreadCount])

  // Lightweight unread count fetch (refetch after client-side navigation; survives route abort scope).
  useEffect(() => {
    if (!isAuthenticated) {
      setChatUnreadCount(0)
      return undefined
    }
    const controller = new AbortController()
    chatService
      .getUnreadCount({ signal: controller.signal })
      .then((res) => {
        const n = res?.data?.unread ?? res?.data?.unreadCount
        if (typeof n === 'number') setChatUnreadCount(n)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [isAuthenticated, location.pathname])

  useEffect(() => {
    if (!isAuthenticated) return
    const socket = getSocket()
    const onNewMessage = (data) => {
      if (data.isOwnMessage) return
      if (data.unreadTotal != null && typeof data.unreadTotal === 'number') {
        setChatUnreadCount(data.unreadTotal)
      }
    }
    const onUnreadUpdated = (data) => {
      if (data.unreadTotal != null && typeof data.unreadTotal === 'number') {
        setChatUnreadCount(data.unreadTotal)
      }
    }
    socket.on('new-message', onNewMessage)
    socket.on('unread-updated', onUnreadUpdated)
    return () => {
      socket.off('new-message', onNewMessage)
      socket.off('unread-updated', onUnreadUpdated)
    }
  }, [isAuthenticated])

  const isHomePage = location.pathname === '/'
  const isReelsPage = location.pathname === '/reels'
  const isAuthRoute =
    location.pathname === '/login' ||
    location.pathname === '/signup' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/verify-email-otp' ||
    location.pathname === '/verify-phone-otp'

  const isPostAdFlow =
    location.pathname === '/post-ad' || location.pathname === '/post-ad-dynamic'

  const handleLogout = () => {
    dispatch(logout('user-click'))
    navigate('/')
  }

  const avatarSrc = user?.avatar ? getMediaUrl(user.avatar) || user.avatar : null
  const displayName = user?.displayName || user?.name || 'Explore Preelly'
  const userSubcopy = isAuthenticated
    ? isUserVerified(user) ? 'Verified account' : 'Marketplace member'
    : 'Buy. Sell. Watch.'

  return (
    <>
      {isAuthRoute || isHomePage ? null : isPostAdFlow ? (
        <header className="bg-white sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
            <Link to="/" className="flex flex-col items-start flex-shrink-0">
              <BrandLogo variant="light" className="h-9 w-auto" />
              
            </Link>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <div
                  className="relative flex-shrink-0"
                  onMouseEnter={profileEnter}
                  onMouseLeave={profileLeave}
                >
                  <button
                    type="button"
                    onClick={() => setProfileOpen((o) => !o)}
                    className="flex items-center gap-2 rounded-xl px-1 py-1 hover:bg-slate-50 transition-all"
                  >
                    {avatarSrc ? (
                      <img src={avatarSrc} alt={displayName} className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700 flex-shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 text-left hidden sm:block">
                      <div className="flex items-center gap-1">
                        <span className="block truncate text-sm font-semibold text-slate-800 max-w-[140px]">{displayName}</span>
                        {isUserVerified(user) && <CheckCircle2 className="h-3.5 w-3.5 text-primary-600 flex-shrink-0" />}
                      </div>
                      <span className="block text-xs text-slate-500">5.0k Followers</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-400 flex-shrink-0 hidden sm:block transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {profileOpen && (
                    <div className="absolute right-0 top-full pt-1 z-[9999]" onMouseEnter={profileEnter} onMouseLeave={profileLeave}>
                      <div className="w-56 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
                        <nav className="py-1">
                          <Link to="/dashboard" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-primary-50">Profile</Link>
                          <Link to="/dashboard/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-primary-50">Settings</Link>
                        </nav>
                        <div className="border-t border-slate-100">
                          <button type="button" onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50">
                            <LogOut className="h-4 w-4" /> Logout
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-primary-700">Login</Link>
              )}
              <Link
                to={isAuthenticated ? '/dashboard/notifications' : '/login'}
                className="relative rounded-full p-2 text-slate-600 hover:text-primary-700 transition flex-shrink-0"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </header>
      ) : (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Desktop header */}
            <div className="hidden md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-6 md:h-16">
              {/* Left: Logo + tagline */}
              <Link to="/" className="flex flex-col items-start flex-shrink-0">
                <BrandLogo variant="light" className="h-9 w-auto" />
                <span className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">Buy. Sell. Watch.</span>
              </Link>

              {/* Center: Search */}
              <div className="relative flex items-center gap-2">
                <SearchBar
                  variant="home"
                  placeholder="Search for cars, properties, electronics..."
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => navigate('/search')}
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 h-11 text-sm font-medium text-slate-600 hover:border-primary-300 hover:text-primary-700 transition flex-shrink-0"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </button>
              </div>

              {/* Right: User info + Bell */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {isAuthenticated ? (
                  <div
                    className="relative flex-shrink-0"
                    onMouseEnter={profileEnter}
                    onMouseLeave={profileLeave}
                  >
                    {/* Trigger button */}
                    <button
                      type="button"
                      onClick={() => setProfileOpen((o) => !o)}
                      className="flex items-center gap-2 rounded-xl px-2 py-1.5 border border-transparent hover:bg-slate-50 hover:border-slate-200 transition-all"
                    >
                      {avatarSrc ? (
                        <img src={avatarSrc} alt={displayName} className="h-9 w-9 rounded-full object-cover ring-2 ring-primary-100 flex-shrink-0" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700 flex-shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-1">
                          <span className="block truncate text-sm font-semibold text-slate-800 max-w-[110px]">{displayName}</span>
                          {isUserVerified(user) && <CheckCircle2 className="h-3.5 w-3.5 text-primary-600 flex-shrink-0" />}
                        </div>
                        <span className="block text-xs text-slate-400">{userSubcopy}</span>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown — keep mouse-enter on panel to cancel the close timer */}
                    {profileOpen && (
                      <div
                        className="absolute right-0 top-full pt-1 z-[9999]"
                        onMouseEnter={profileEnter}
                        onMouseLeave={profileLeave}
                      >
                        <div className="w-56 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
                          {/* User header */}
                          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
                            {avatarSrc ? (
                              <img src={avatarSrc} alt={displayName} className="h-9 w-9 rounded-full object-cover ring-2 ring-primary-100 flex-shrink-0" />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700 flex-shrink-0">
                                <User className="h-4 w-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                              <p className="text-xs text-slate-500 truncate">{user?.email || userSubcopy}</p>
                            </div>
                          </div>

                          {/* Nav items */}
                          <nav className="py-1">
                            <Link to="/dashboard" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors">
                              <LayoutDashboard className="h-4 w-4 text-slate-400" />
                              Profile Overview
                            </Link>
                            <Link to="/dashboard/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors">
                              <Settings className="h-4 w-4 text-slate-400" />
                              Settings
                            </Link>
                            {isAdmin && (
                              <a href={ADMIN_PANEL_URL} className="flex items-center gap-3 px-4 py-2.5 text-sm text-purple-600 hover:bg-purple-50 transition-colors">
                                <Shield className="h-4 w-4" />
                                Admin Panel
                              </a>
                            )}
                          </nav>

                          {/* Logout */}
                          <div className="border-t border-slate-100">
                            <button
                              type="button"
                              onClick={handleLogout}
                              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
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
                  <div className="flex items-center gap-3">
                    <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-primary-700 transition">Login</Link>
                    <Link to="/signup" className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition">Sign Up</Link>
                  </div>
                )}
                <Link
                  to={isAuthenticated ? '/dashboard/notifications' : '/login'}
                  className="relative rounded-full border border-slate-200 p-2.5 text-slate-600 hover:border-primary-200 hover:text-primary-700 transition flex-shrink-0"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {chatUnreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
                      {Math.min(chatUnreadCount, 99)}
                    </span>
                  )}
                </Link>
              </div>
            </div>

            {/* Mobile header */}
            <div className="md:hidden flex items-center justify-between h-14 gap-3">
              <Link to="/" className="flex-shrink-0">
                <BrandLogo variant="light" className="h-8 w-auto" />
              </Link>
              <SearchBar
                variant="home"
                placeholder="Search..."
                className="flex-1"
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  to={isAuthenticated ? '/dashboard/notifications' : '/login'}
                  className="relative p-1.5 text-slate-600"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {chatUnreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-600 px-1 text-[9px] font-bold text-white">
                      {Math.min(chatUnreadCount, 99)}
                    </span>
                  )}
                </Link>
                <button className="p-1.5" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                  {mobileMenuOpen ? <X className="h-5 w-5 text-slate-700" /> : <Menu className="h-5 w-5 text-slate-700" />}
                </button>
              </div>
            </div>

            {/* Mobile dropdown menu */}
            {mobileMenuOpen && (
              <nav className="md:hidden pb-4 pt-2 space-y-1 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-2 px-3 pb-2">
                  <Link to="/" className="rounded-xl border border-slate-200 px-3 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setMobileMenuOpen(false)}>Home</Link>
                  <Link to="/reels" className="rounded-xl border border-slate-200 px-3 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setMobileMenuOpen(false)}>Reels</Link>
                  <Link to="/categories" className="rounded-xl border border-slate-200 px-3 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setMobileMenuOpen(false)}>Categories</Link>
                  <Link to="/post-ad" className="rounded-xl bg-primary-600 px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-primary-700" onClick={() => setMobileMenuOpen(false)}>Post Ad</Link>
                </div>
                {isAuthenticated ? (
                  <>
                    <Link to="/bookmarks" className="flex items-center gap-3 px-3 py-2.5 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>My Bookmarks</Link>
                    <Link to="/chat" className="flex items-center gap-3 px-3 py-2.5 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>Messages</Link>
                    <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2.5 text-slate-700 hover:bg-slate-50 rounded-xl" onClick={() => setMobileMenuOpen(false)}>
                      {avatarSrc ? (
                        <img src={avatarSrc} alt={displayName} className="h-8 w-8 rounded-full object-cover ring-2 ring-primary-100" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                        <p className="text-xs text-slate-500">{userSubcopy}</p>
                      </div>
                    </Link>
                    {isAdmin && (
                      <a href={ADMIN_PANEL_URL} className="block px-3 py-2.5 text-purple-600 hover:bg-slate-50 rounded-xl text-sm font-medium">
                        Admin Panel
                      </a>
                    )}
                    <button onClick={() => { handleLogout(); setMobileMenuOpen(false) }} className="flex items-center gap-2 w-full px-3 py-2.5 text-slate-700 hover:bg-red-50 hover:text-red-600 rounded-xl text-sm font-medium">
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-2">
                    <Link to="/login" className="flex-1 text-center py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-primary-300 hover:text-primary-700 transition" onClick={() => setMobileMenuOpen(false)}>Login</Link>
                    <Link to="/signup" className="flex-1 text-center py-2 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
                  </div>
                )}
              </nav>
            )}
          </div>
        </header>
      )}

      {/* Mobile header + menu for Reels page */}
      {isReelsPage && (
        <header className="md:hidden bg-black/60 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <BrandLogo variant="dark" className="h-8 w-auto" />
            </Link>
            <button className="p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Open menu">
              {mobileMenuOpen ? <X className="h-6 w-6 text-white" /> : <Menu className="h-6 w-6 text-white" />}
            </button>
          </div>

          {mobileMenuOpen && (
            <nav className="px-4 pb-4 space-y-2 bg-black/70">
              <div className="mb-3">
                <SearchBar
                  placeholder="Search products..."
                  className="w-full"
                />
              </div>
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard" className="block px-4 py-2 text-white hover:bg-gray-800 rounded" onClick={() => setMobileMenuOpen(false)}>
                    Profile
                  </Link>
                  {isAdmin && (
                    <a href={ADMIN_PANEL_URL} className="block px-4 py-2 text-purple-400 hover:bg-gray-800 rounded">
                      Admin
                    </a>
                  )}
                  <button onClick={() => { handleLogout(); setMobileMenuOpen(false) }} className="block w-full text-left px-4 py-2 text-white hover:bg-gray-800 rounded">
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="block px-4 py-2 text-white hover:bg-gray-800 rounded" onClick={() => setMobileMenuOpen(false)}>Login</Link>
                  <Link to="/signup" className="block px-4 py-2 text-primary-400 hover:bg-gray-800 rounded" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
                </>
              )}
              <Link to="/post-ad" className="block px-4 py-2 text-white hover:bg-gray-800 rounded" onClick={() => setMobileMenuOpen(false)}>Post Ad</Link>
              <Link to="/categories" className="block px-4 py-2 text-white hover:bg-gray-800 rounded" onClick={() => setMobileMenuOpen(false)}>Categories</Link>
              <Link to="/chat" className="block px-4 py-2 text-white hover:bg-gray-800 rounded" onClick={() => setMobileMenuOpen(false)}>Chat</Link>
            </nav>
          )}
        </header>
      )}
    </>
  )
}

export default Header
