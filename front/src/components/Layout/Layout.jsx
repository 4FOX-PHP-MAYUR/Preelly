import { useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

function Layout({ children }) {
  const location = useLocation()

  const isHomePage = location.pathname === '/'
  const isReelsPage = location.pathname === '/reels'
  const isChatPage = location.pathname.startsWith('/chat')
  const isProductDetailPage = /^\/products\/[^/]+$/.test(location.pathname)
  const isSearchPage = location.pathname.startsWith('/search')
  const isCategoryProductsPage =
    /^\/categories\/[^/]+\/products/.test(location.pathname) ||
    /^\/categories\/[^/]+\/subcategory\/[^/]+/.test(location.pathname)
  const isCategoryBrowsePage = location.pathname.startsWith('/categories')
  const isUserProfilePage = /^\/user\/[^/]+$/.test(location.pathname)
  const isAuthRoute =
    location.pathname === '/login' ||
    location.pathname === '/signup' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/verify-email-otp' ||
    location.pathname === '/verify-phone-otp'
  const isPostAdFlow =
    location.pathname === '/post-ad' ||
    location.pathname === '/post-ad-dynamic' ||
    location.pathname === '/post-ad/select-package' ||
    location.pathname === '/post-ad/storage' ||
    location.pathname.startsWith('/post-ad/payment')

  return (
    <div className={`min-h-screen ${isReelsPage ? 'bg-black' : isHomePage || isChatPage || isProductDetailPage || isSearchPage || isCategoryProductsPage ? 'bg-white' : isCategoryBrowsePage || isUserProfilePage ? 'bg-[#f7f8fa]' : isAuthRoute ? 'bg-[#f6f7fb]' : isPostAdFlow ? 'bg-white' : 'bg-gray-50'}`}>
      <Header />
      <main className={isPostAdFlow || isSearchPage || isCategoryProductsPage ? 'overflow-x-hidden min-w-0' : 'min-w-0'}>{children}</main>
      {!isSearchPage && !isCategoryProductsPage ? <Footer /> : null}
    </div>
  )
}

export default Layout
