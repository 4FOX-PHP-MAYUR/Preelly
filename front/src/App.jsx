import { Suspense, lazy, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Layout from './components/Layout/Layout'
import { useSyncRouteApiScope } from '@shared/hooks/useSyncRouteApiScope'
import {
  initializeAuth,
  selectAuthHydrating,
  selectIsAuthenticated,
  selectUser,
} from '@shared/store/slices/authSlice'

const CategoriesPage = lazy(() => import('./pages/CategoriesPage'))
const SubcategoriesPage = lazy(() => import('./pages/SubcategoriesPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const ReelsFeedPage = lazy(() => import('./pages/ReelsFeedPage'))
const ProductDetailPage = lazy(() => import('@shared/pages/ProductDetailPage'))
const PostAdPage = lazy(() => import('./pages/PostAdPage'))
const SelectPackagePage = lazy(() => import('./pages/SelectPackagePage'))
const StorageCheckoutPage = lazy(() => import('./pages/StorageCheckoutPage'))
const CartCheckoutPage = lazy(() => import('./pages/CartCheckoutPage'))
const PaymentResultPage = lazy(() => import('./pages/PaymentResultPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardLayout = lazy(() => import('./components/Dashboard/DashboardLayout'))
const DashboardOverviewPage = lazy(() => import('./pages/dashboard/DashboardOverviewPage'))
const DashboardListingsPage = lazy(() => import('./pages/dashboard/DashboardListingsPage'))
const DashboardOrdersPage = lazy(() => import('./pages/dashboard/DashboardOrdersPage'))
const DashboardWishlistPage = lazy(() => import('./pages/dashboard/DashboardWishlistPage'))
const DashboardMessagesPage = lazy(() => import('./pages/dashboard/DashboardMessagesPage'))
const DashboardNotificationsPage = lazy(() => import('./pages/dashboard/DashboardNotificationsPage'))
const DashboardFollowRequestsPage = lazy(() => import('./pages/dashboard/DashboardFollowRequestsPage'))
const DashboardSettingsPage = lazy(() => import('./pages/dashboard/DashboardSettingsPage'))
const DashboardProfilePage = lazy(() => import('./pages/dashboard/DashboardProfilePage'))
const DashboardBlockedUsersPage = lazy(() => import('./pages/dashboard/DashboardBlockedUsersPage'))
const DashboardInfoPage = lazy(() => import('./pages/dashboard/DashboardInfoPage'))
const DashboardDraftsPage = lazy(() => import('./pages/dashboard/DashboardDraftsPage'))
const DashboardMySearchPage = lazy(() => import('./pages/dashboard/DashboardMySearchPage'))
const DashboardArchivesPage = lazy(() => import('./pages/dashboard/DashboardArchivesPage'))
const UserProfilePage = lazy(() => import('@shared/pages/UserProfilePage'))
const FollowersFollowingPage = lazy(() => import('./pages/FollowersFollowingPage'))
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'))
const CategorySearchPage = lazy(() => import('./pages/CategorySearchPage'))
const CategoryProductsPage = lazy(() => import('./pages/CategoryProductsPage'))
const ChatInboxPage = lazy(() => import('./pages/ChatInboxPage'))
const VerifyEmailOtpPage = lazy(() => import('./pages/VerifyEmailOtpPage'))
const VerifyPhoneOtpPage = lazy(() => import('./pages/VerifyPhoneOtpPage'))
const CompleteMobilePage = lazy(() => import('./pages/CompleteMobilePage'))
const CompleteEmailPage = lazy(() => import('./pages/CompleteEmailPage'))
const OAuthSuccessPage = lazy(() => import('./pages/OAuthSuccessPage'))
const WelcomePage = lazy(() => import('./pages/WelcomePage'))
const BookmarkPage = lazy(() => import('./pages/BookmarkPage'))

function readCachedUserFlag() {
  try {
    return Boolean(localStorage.getItem('user'))
  } catch {
    return false
  }
}

function PrivateRoute({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const hydrating = useSelector(selectAuthHydrating)
  const location = useLocation()
  const isSellerIntent =
    location.pathname === '/post-ad'
  const hasOptimisticSession = Boolean(user) || readCachedUserFlag()
  const hasSession = hydrating ? hasOptimisticSession || isAuthenticated : isAuthenticated

  if (hydrating && !hasOptimisticSession && !isAuthenticated) return null
  // Buyers land on a clean /login; only the seller intent carries ?target=seller.
  if (!hasSession) return <Navigate to={isSellerIntent ? '/login?target=seller' : '/login'} replace />

  return children
}

/**
 * /search serves two flows: the keyword/category results view (reached from the
 * search bar, saved searches, …) and — with no query at all — the hierarchical
 * category search builder.
 */
function SearchRoute() {
  const [searchParams] = useSearchParams()
  const hasResultsQuery =
    Boolean((searchParams.get('q') || '').trim()) || Boolean(searchParams.get('category'))
  return hasResultsQuery ? <SearchResultsPage /> : <CategorySearchPage />
}

// /signup has been removed — send visitors to /login, preserving any query (e.g. ?target=seller).
function SignupRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/login${search}`} replace />
}

function App() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useSelector(selectUser)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const hydrating = useSelector(selectAuthHydrating)

  useSyncRouteApiScope()

  const authBootstrappedRef = useRef(false)

  useEffect(() => {
    if (authBootstrappedRef.current) return
    authBootstrappedRef.current = true
    dispatch(initializeAuth())
  }, [dispatch])

  return (
    <Layout>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/reels" element={<ReelsFeedPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/categories/:categoryId" element={<SubcategoriesPage />} />
          <Route path="/categories/:categoryId/subcategory/:subcategoryId" element={<CategoryProductsPage />} />
          <Route path="/categories/:categoryId/products" element={<CategoryProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/search" element={<SearchRoute />} />
          <Route path="/login" element={<LoginPage />} />
          {/* Signup is unified into /login (auto-detects new vs. existing users). */}
          <Route path="/signup" element={<SignupRedirect />} />
          <Route path="/verify-email-otp" element={<VerifyEmailOtpPage />} />
          <Route path="/verify-phone-otp" element={<VerifyPhoneOtpPage />} />
          <Route path="/complete-mobile" element={<CompleteMobilePage />} />
          <Route path="/complete-email" element={<CompleteEmailPage />} />
          <Route path="/oauth-success" element={<OAuthSuccessPage />} />
          <Route
            path="/welcome"
            element={
              <PrivateRoute>
                <WelcomePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/bookmarks"
            element={
              <PrivateRoute>
                <BookmarkPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <PrivateRoute>
                <ChatInboxPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/chat/:threadId"
            element={
              <PrivateRoute>
                <ChatInboxPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/cart"
            element={
              <PrivateRoute>
                <CartCheckoutPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/cart/payment/success"
            element={
              <PrivateRoute>
                <PaymentResultPage variant="success" />
              </PrivateRoute>
            }
          />
          <Route
            path="/cart/payment/failure"
            element={
              <PrivateRoute>
                <PaymentResultPage variant="failure" />
              </PrivateRoute>
            }
          />
          <Route
            path="/post-ad"
            element={
              <PrivateRoute>
                <PostAdPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/post-ad/select-package"
            element={
              <PrivateRoute>
                <SelectPackagePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/post-ad/storage"
            element={
              <PrivateRoute>
                <StorageCheckoutPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/post-ad/payment/success"
            element={
              <PrivateRoute>
                <PaymentResultPage variant="success" />
              </PrivateRoute>
            }
          />
          <Route
            path="/post-ad/payment/failure"
            element={
              <PrivateRoute>
                <PaymentResultPage variant="failure" />
              </PrivateRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <DashboardLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/my-profile" replace />} />
            <Route path="listings" element={<DashboardListingsPage />} />
            <Route path="wishlist" element={<DashboardWishlistPage />} />
            <Route path="messages" element={<DashboardMessagesPage />} />
            <Route path="notifications" element={<DashboardNotificationsPage />} />
            <Route path="notifications/follow-requests" element={<DashboardFollowRequestsPage />} />
          </Route>
          {/* Profile/Settings use their own home-style shell, outside DashboardLayout. */}
          <Route
            path="/dashboard/profile"
            element={
              <PrivateRoute>
                <DashboardProfilePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/dashboard/drafts"
            element={
              <PrivateRoute>
                <DashboardDraftsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/dashboard/orders"
            element={
              <PrivateRoute>
                <DashboardOrdersPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/dashboard/archives"
            element={
              <PrivateRoute>
                <DashboardArchivesPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/dashboard/my-search"
            element={
              <PrivateRoute>
                <DashboardMySearchPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/dashboard/blocked-users"
            element={
              <PrivateRoute>
                <DashboardBlockedUsersPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/dashboard/support"
            element={
              <PrivateRoute>
                <DashboardInfoPage pageKey="support" />
              </PrivateRoute>
            }
          />
          <Route
            path="/dashboard/faq"
            element={
              <PrivateRoute>
                <DashboardInfoPage pageKey="faq" />
              </PrivateRoute>
            }
          />
          <Route
            path="/dashboard/contact"
            element={
              <PrivateRoute>
                <DashboardInfoPage pageKey="contact" />
              </PrivateRoute>
            }
          />
          <Route
            path="/dashboard/settings"
            element={
              <PrivateRoute>
                <DashboardSettingsPage />
              </PrivateRoute>
            }
          />
          {/* The signed-in user's own profile — same page as /user/:id, self-resolved. */}
          <Route
            path="/my-profile"
            element={
              <PrivateRoute>
                <UserProfilePage selfMode />
              </PrivateRoute>
            }
          />
          <Route path="/user/:id/:type" element={<FollowersFollowingPage />} />
          <Route path="/user/:id" element={<UserProfilePage />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

export default App
