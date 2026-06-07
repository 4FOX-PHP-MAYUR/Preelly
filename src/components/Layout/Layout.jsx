import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { selectIsAuthenticated, selectUser, selectIsAdmin, logout } from '../../store/slices/authSlice'
import { Bell, CheckCircle2, ChevronDown, LayoutDashboard, LogOut, Menu, Search, Settings, Shield, SlidersHorizontal, User, X } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { chatService } from '../../services/api'
import { getSocket } from '../../services/socket'
import Sidebar from '../AdminUI/Sidebar'
import TopNav from '../AdminUI/TopNav'
import BrandLogo from '../BrandLogo'
import { getMediaUrl, isUserVerified } from '../../utils/helpers'

function Layout({ children }) {
  const location = useLocation()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const isAdmin = useSelector(selectIsAdmin)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileAdminOpen, setMobileAdminOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileCloseTimer = useRef(null)

  const profileEnter = () => {
    if (profileCloseTimer.current) clearTimeout(profileCloseTimer.current)
    setProfileOpen(true)
  }
  const profileLeave = () => {
    profileCloseTimer.current = setTimeout(() => setProfileOpen(false), 200)
  }
  const [searchQuery, setSearchQuery] = useState('')
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

  // header is transparent on reels and other pages when requested

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

  const isCategoryBrowsePage = location.pathname.startsWith('/categories')
  const isUserProfilePage = /^\/user\/[^/]+$/.test(location.pathname)
  const isReelsPage = location.pathname === '/reels'

  // Admin routes (admin login + admin panel)
  const isAdminRoute = location.pathname.startsWith('/admin')
  const isDashboardRoute = location.pathname.startsWith('/dashboard')
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

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    const q = searchQuery.trim()
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  }

  const avatarSrc = user?.avatar ? getMediaUrl(user.avatar) || user.avatar : null
  const displayName = user?.displayName || user?.name || 'Explore Preelly'
  const userSubcopy = isAuthenticated
    ? isUserVerified(user) ? 'Verified account' : 'Marketplace member'
    : 'Buy. Sell. Watch.'

  return (
    <div className={`min-h-screen ${isReelsPage ? 'bg-black' : isHomePage ? 'bg-[#eef3fb]' : isCategoryBrowsePage || isUserProfilePage ? 'bg-[#f7f8fa]' : isAuthRoute ? 'bg-[#f6f7fb]' : isPostAdFlow ? 'bg-white' : 'bg-gray-50'}`}>
      {/* Header */}
      <>
        {isAdminRoute ? (
            <div className="min-h-screen bg-gray-100">
              <div className="flex">
                {/* Desktop sidebar */}
                <div className="hidden md:block md:flex-shrink-0">
                  <Sidebar
                    mobileOpen={false}
                    onMobileClose={() => {}}
                  />
                </div>
                {/* Mobile sidebar overlay */}
                <div className="md:hidden">
                  <Sidebar
                    mobileOpen={mobileAdminOpen}
                    onMobileClose={() => setMobileAdminOpen(false)}
                  />
                </div>
                <div className="flex-1 min-w-0 min-h-screen overflow-x-hidden">
                  <TopNav onMenuClick={() => setMobileAdminOpen(v => !v)} />
                  <main className="p-4 sm:p-6">
                    {children}
                  </main>
                </div>
              </div>
            </div>
          ) : isAuthRoute || isHomePage ? null : isPostAdFlow ? (
            <header className="bg-white sticky top-0 z-50">
              <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
                <Link to="/" className="flex flex-col items-start flex-shrink-0">
                  <BrandLogo variant="light" className="h-9 w-auto" />
                  <span className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">Buy. Sell. Watch.</span>
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
                  <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for cars, properties, electronics..."
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/search')}
                      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 h-11 text-sm font-medium text-slate-600 hover:border-primary-300 hover:text-primary-700 transition flex-shrink-0"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Filters
                    </button>
                  </form>

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
                                  <Link to="/admin" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-purple-600 hover:bg-purple-50 transition-colors">
                                    <Shield className="h-4 w-4" />
                                    Admin Panel
                                  </Link>
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
                  <form onSubmit={handleSearchSubmit} className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-primary-400 focus:bg-white"
                    />
                  </form>
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
                          <Link to="/admin" className="block px-3 py-2.5 text-purple-600 hover:bg-slate-50 rounded-xl text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                            Admin Panel
                          </Link>
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
      </>
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
              <form onSubmit={handleSearchSubmit} className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="h-9 w-full rounded-xl border border-white/20 bg-white/10 pl-9 pr-3 text-sm text-white placeholder-slate-400 outline-none focus:border-primary-400"
                />
              </form>
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard" className="block px-4 py-2 text-white hover:bg-gray-800 rounded" onClick={() => setMobileMenuOpen(false)}>
                    Profile
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" className="block px-4 py-2 text-purple-400 hover:bg-gray-800 rounded" onClick={() => setMobileMenuOpen(false)}>
                      Admin
                    </Link>
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
      {/* Main Content (non-admin) */}
      {!isAdminRoute && (
        <main className={isPostAdFlow ? 'overflow-x-hidden min-w-0' : 'min-w-0'}>{children}</main>
      )}

      {/* Footer - Hidden on reels page */}
      {!isHomePage && !isReelsPage && !isCategoryBrowsePage && !isUserProfilePage && !isAdminRoute && !isAuthRoute && !isDashboardRoute && !isPostAdFlow && (
      <footer className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <BrandLogo variant="dark" className="mb-4 h-10 w-auto" />
              <p className="text-gray-400">
                Buy and sell with video. The modern marketplace experience.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link to="/categories" className="hover:text-white">
                    Browse Categories
                  </Link>
                </li>
                <li>
                  <Link to="/post-ad" className="hover:text-white">
                    Post an Ad
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white">
                    Help Center
                  </a>
                </li>
                <li>
                  {isAuthenticated ? (
                    <button
                      type="button"
                      className="hover:text-white text-left"
                      onClick={async () => {
                        try {
                          const res = await chatService.createSupportChat()
                          const chatId = res?.data?.chat?._id
                          if (chatId) navigate(`/chat/${chatId}`)
                        } catch {
                          navigate('/chat')
                        }
                      }}
                    >
                      Chat With Us
                    </button>
                  ) : (
                    <Link to="/login" className="hover:text-white">
                      Chat With Us
                    </Link>
                  )}
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-700 text-center text-gray-400">
            <p>&copy; 2024 Preelly. All rights reserved.</p>
          </div>
        </div>
      </footer>
      )}
    </div>
  )
}

export default Layout

