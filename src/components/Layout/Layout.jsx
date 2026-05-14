import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { selectIsAuthenticated, selectUser, selectIsAdmin, logout } from '../../store/slices/authSlice'
import { ShoppingBag, Plus, User, LogOut, Menu, X, Shield, MessageCircle, ExternalLink } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import SearchBar from '../Search/SearchBar'
import { chatService } from '../../services/api'
import { getSocket } from '../../services/socket'
import Sidebar from '../AdminUI/Sidebar'
import TopNav from '../AdminUI/TopNav'

function Layout({ children }) {
  const location = useLocation()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const isAdmin = useSelector(selectIsAdmin)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const feedUnreadCount = useSelector((state) => state.feed?.unreadCount || 0)
  const [chatUnreadCount, setChatUnreadCount] = useState(feedUnreadCount)

  useEffect(() => {
    setChatUnreadCount(feedUnreadCount)
  }, [feedUnreadCount])

  // Lightweight unread count fetch (avoids heavy feed-data fanout on non-chat pages)
  useEffect(() => {
    if (!isAuthenticated) {
      setChatUnreadCount(0)
      return
    }
    let cancelled = false
    chatService
      .getUnreadCount()
      .then((res) => {
        if (cancelled) return
        const n = res?.data?.unreadCount
        if (typeof n === 'number') setChatUnreadCount(n)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

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

  // Previously header was hidden on reels pages; keep header visible so users can access categories/menu.
  const isReelsPage = location.pathname === '/' ||
    location.pathname === '/reels' ||
    (location.pathname.includes('/categories/') && (
      location.pathname.endsWith('/products') ||
      location.pathname.includes('/subcategory/')
    ))

  // Admin routes (admin login + admin panel)
  const isAdminRoute = location.pathname.startsWith('/admin')

  const handleLogout = () => {
    dispatch(logout())
    navigate('/')
  }
 
  // Header nav class - on reels page show compact absolute nav on top-right
  const headerNavClass = isReelsPage
    ? 'absolute right-4 top-3 flex items-center space-x-3'
    : 'hidden md:flex items-center space-x-6 flex-shrink-0'
  const getAppClass = 'hidden md:flex items-center mr-3'

  return (
    <div className={`min-h-screen ${isReelsPage ? 'bg-black' : 'bg-gray-50'}`}>
      {/* Header */}
      <>
        {isAdminRoute ? (
            <div className="min-h-screen bg-gray-100">
              <div className="flex">
                <Sidebar />
                <div className="flex-1 min-h-screen">
                  <TopNav />
                  <main className="p-6">
                    {children}
                  </main>
                </div>
              </div>
            </div>
          ) : (
            <header className={`bg-transparent backdrop-blur-md bg-black/40 sticky top-0 z-50 ${isReelsPage ? 'hidden' : ''}`}>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16 gap-4">
                  {/* Logo (hidden on Reels page; moved into left sidebar there) */}
                  {!isReelsPage && (
                    <Link to="/" className="flex items-center space-x-2 flex-shrink-0">
                      <ShoppingBag className="h-8 w-8 text-primary-600" />
                      <span className="text-2xl font-bold text-primary-600">Preelly</span>
                    </Link>
                  )}

                  {/* Desktop: empty space (search moved to sidebar) */}
                  <div className="hidden md:flex flex-1 max-w-4xl mx-4" />

                  {/* Desktop Navigation - simplified */}
                  <nav className={headerNavClass}>
                    {isAuthenticated ? (
                      <>
                        <Link
                          to="/dashboard"
                          className="flex items-center space-x-1 text-gray-700 hover:text-primary-600 font-medium"
                        >
                          <User className="h-4 w-4" />
                          <span>{user?.displayName || user?.name || 'Profile'}</span>
                        </Link>
                        {isAdmin && (
                          <Link
                            to="/admin"
                            className="flex items-center space-x-1 text-purple-600 hover:text-purple-700 font-medium"
                          >
                            <Shield className="h-4 w-4" />
                            <span>Admin</span>
                          </Link>
                        )}
                        <button
                          onClick={handleLogout}
                          className="flex items-center space-x-1 text-gray-700 hover:text-red-600 font-medium"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Logout</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <Link to="/login" className="text-gray-700 hover:text-primary-600 font-medium">
                          Login
                        </Link>
                        <Link to="/signup" className="btn-primary">
                          Sign Up
                        </Link>
                      </>
                    )}
                  </nav>

                  {/* "Get App" link */}
                  <div className={getAppClass}>
                    <a href="#" target="_blank" rel="noreferrer" className="text-gray-200 hover:text-white flex items-center gap-2 px-3 py-1 rounded-md">
                      <ExternalLink className="h-4 w-4" />
                      <span className="text-sm">Get App</span>
                    </a>
                  </div>

                  {/* Mobile Menu Button */}
                  <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                    {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                  </button>
                </div>

                {/* Mobile Navigation - simplified */}
                {mobileMenuOpen && (
                  <nav className="md:hidden pb-4 space-y-2">
                    <div className="px-4 mb-4">
                      <SearchBar placeholder="Search products..." />
                    </div>
                    {isAuthenticated ? (
                      <>
                        <Link to="/dashboard" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded" onClick={() => setMobileMenuOpen(false)}>
                          Profile
                        </Link>
                        {isAdmin && (
                          <Link to="/admin" className="block px-4 py-2 text-purple-600 hover:bg-gray-100 rounded" onClick={() => setMobileMenuOpen(false)}>
                            Admin
                          </Link>
                        )}
                        <button onClick={() => { handleLogout(); setMobileMenuOpen(false) }} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
                          Logout
                        </button>
                      </>
                    ) : (
                      <>
                        <Link to="/login" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded" onClick={() => setMobileMenuOpen(false)}>Login</Link>
                        <Link to="/signup" className="block px-4 py-2 text-primary-600 hover:bg-gray-100 rounded" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
                      </>
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
            <Link to="/" className="flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary-600" />
              <span className="text-primary-600 font-semibold">Preelly</span>
            </Link>

            <div className="flex items-center gap-2">
              <a href="#" target="_blank" rel="noreferrer" className="text-gray-200 hover:text-white p-2 rounded-md hidden sm:inline-flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                <span className="text-sm">Get App</span>
              </a>
              <button className="p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Open menu">
                {mobileMenuOpen ? <X className="h-6 w-6 text-white" /> : <Menu className="h-6 w-6 text-white" />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <nav className="px-4 pb-4 space-y-2 bg-black/70">
              <div className="mb-3">
                <SearchBar placeholder="Search products..." />
              </div>
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard" className="block px-4 py-2 text-white hover:bg-gray-800 rounded" onClick={() => setMobileMenuOpen(false)}>
                    Profile
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" className="block px-4 py-2 text-purple-600 hover:bg-gray-800 rounded" onClick={() => setMobileMenuOpen(false)}>
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
                  <Link to="/signup" className="block px-4 py-2 text-primary-600 hover:bg-gray-800 rounded" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
                </>
              )}
              <Link to="/post-ad" className="block px-4 py-2 text-white hover:bg-gray-800 rounded" onClick={() => setMobileMenuOpen(false)}>Post Ad</Link>
              <Link to="/categories" className="block px-4 py-2 text-white hover:bg-gray-800 rounded" onClick={() => setMobileMenuOpen(false)}>Categories</Link>
              <Link to="/chat" className="block px-4 py-2 text-white hover:bg-gray-800 rounded" onClick={() => setMobileMenuOpen(false)}>Chat</Link>
              <a href="#" target="_blank" rel="noreferrer" className="block px-4 py-2 text-white hover:bg-gray-800 rounded">Get App</a>
            </nav>
          )}
        </header>
      )}
      {/* Main Content (non-admin) */}
      {!isAdminRoute && <main>{children}</main>}

      {/* Footer - Hidden on reels page */}
      {!isReelsPage && !isAdminRoute && (
      <footer className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4">Preelly</h3>
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

