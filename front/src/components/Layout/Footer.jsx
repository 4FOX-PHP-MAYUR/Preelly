import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectIsAuthenticated } from '@shared/store/slices/authSlice'
import BrandLogo from '@shared/components/BrandLogo'
import { chatService } from '@shared/services/api'

/**
 * Site-wide footer. Self-contained and hidden on pages that use a full-viewport
 * app-style layout (home, reels, category browse, dashboard, auth, post-ad).
 */
function Footer() {
  const location = useLocation()
  const navigate = useNavigate()
  const isAuthenticated = useSelector(selectIsAuthenticated)

  const isHomePage = location.pathname === '/'
  const isReelsPage = location.pathname === '/reels'
  const isCategoryBrowsePage = location.pathname.startsWith('/categories')
  const isUserProfilePage = /^\/user\/[^/]+$/.test(location.pathname)
  const isDashboardRoute = location.pathname.startsWith('/dashboard')
  const isAuthRoute =
    location.pathname === '/login' ||
    location.pathname === '/signup' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/verify-email-otp' ||
    location.pathname === '/verify-phone-otp'
  const isPostAdFlow =
    location.pathname === '/post-ad' || location.pathname === '/post-ad-dynamic'

  const hideFooter =
    isHomePage || isReelsPage || isCategoryBrowsePage || isUserProfilePage || isAuthRoute || isDashboardRoute || isPostAdFlow

  if (hideFooter) return null

  return (
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
  )
}

export default Footer
