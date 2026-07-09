import { useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

function Layout({ children }) {
  const location = useLocation()

  const isHomePage = location.pathname === '/'
  const isReelsPage = location.pathname === '/reels'
  const isCategoryBrowsePage = location.pathname.startsWith('/categories')
  const isUserProfilePage = /^\/user\/[^/]+$/.test(location.pathname)
  const isAuthRoute =
    location.pathname === '/login' ||
    location.pathname === '/signup' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/verify-email-otp' ||
    location.pathname === '/verify-phone-otp'
  const isPostAdFlow =
    location.pathname === '/post-ad' || location.pathname === '/post-ad-dynamic'

  return (
    <div className={`min-h-screen ${isReelsPage ? 'bg-black' : isHomePage ? 'bg-[#eef3fb]' : isCategoryBrowsePage || isUserProfilePage ? 'bg-[#f7f8fa]' : isAuthRoute ? 'bg-[#f6f7fb]' : isPostAdFlow ? 'bg-white' : 'bg-gray-50'}`}>
      <Header />
      <main className={isPostAdFlow ? 'overflow-x-hidden min-w-0' : 'min-w-0'}>{children}</main>
      <Footer />
    </div>
  )
}

export default Layout
