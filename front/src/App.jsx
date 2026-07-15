import { Suspense, lazy, useMemo, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
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
const PaymentResultPage = lazy(() => import('./pages/PaymentResultPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const DashboardLayout = lazy(() => import('./components/Dashboard/DashboardLayout'))
const DashboardOverviewPage = lazy(() => import('./pages/dashboard/DashboardOverviewPage'))
const DashboardListingsPage = lazy(() => import('./pages/dashboard/DashboardListingsPage'))
const DashboardOrdersPage = lazy(() => import('./pages/dashboard/DashboardOrdersPage'))
const DashboardWishlistPage = lazy(() => import('./pages/dashboard/DashboardWishlistPage'))
const DashboardMessagesPage = lazy(() => import('./pages/dashboard/DashboardMessagesPage'))
const DashboardNotificationsPage = lazy(() => import('./pages/dashboard/DashboardNotificationsPage'))
const DashboardFollowRequestsPage = lazy(() => import('./pages/dashboard/DashboardFollowRequestsPage'))
const DashboardSettingsPage = lazy(() => import('./pages/dashboard/DashboardSettingsPage'))
const UserProfilePage = lazy(() => import('@shared/pages/UserProfilePage'))
const FollowersFollowingPage = lazy(() => import('./pages/FollowersFollowingPage'))
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'))
const CategoryProductsPage = lazy(() => import('./pages/CategoryProductsPage'))
const ChatInboxPage = lazy(() => import('./pages/ChatInboxPage'))
const PostAdDynamicFormPage = lazy(() => import('./pages/PostAdDynamicFormPage'))
const VerifyEmailOtpPage = lazy(() => import('./pages/VerifyEmailOtpPage'))
const VerifyPhoneOtpPage = lazy(() => import('./pages/VerifyPhoneOtpPage'))
const ProfileSetupPage = lazy(() => import('./pages/ProfileSetupPage'))
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
    location.pathname === '/post-ad' || location.pathname === '/post-ad-dynamic'
  const target = isSellerIntent ? 'seller' : 'buyer'
  const hasOptimisticSession = Boolean(user) || readCachedUserFlag()
  const hasSession = hydrating ? hasOptimisticSession || isAuthenticated : isAuthenticated

  if (hydrating && !hasOptimisticSession && !isAuthenticated) return null
  if (!hasSession) return <Navigate to={`/login?target=${target}`} replace />

  return children
}

function App() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useSelector(selectUser)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const hydrating = useSelector(selectAuthHydrating)

  const inferredTarget = useMemo(() => {
    const isSellerIntent =
      location.pathname === '/post-ad' || location.pathname === '/post-ad-dynamic'
    return isSellerIntent ? 'seller' : 'buyer'
  }, [location.pathname])

  useSyncRouteApiScope()

  const authBootstrappedRef = useRef(false)

  useEffect(() => {
    if (authBootstrappedRef.current) return
    authBootstrappedRef.current = true
    dispatch(initializeAuth())
  }, [dispatch])

  useEffect(() => {
    if (hydrating) return
    if (!isAuthenticated) return
    if (!user || user.role === 'admin') return
    if (user.isProfileComplete) return
    if (location.pathname === '/profile-setup') return
    if (location.pathname === '/post-ad' || location.pathname === '/post-ad-dynamic') return
    navigate(`/profile-setup?target=${inferredTarget}`, { replace: true })
  }, [hydrating, isAuthenticated, user, location.pathname, navigate, inferredTarget])

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
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email-otp" element={<VerifyEmailOtpPage />} />
          <Route path="/verify-phone-otp" element={<VerifyPhoneOtpPage />} />
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
            path="/profile-setup"
            element={
              <PrivateRoute>
                <ProfileSetupPage />
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
            path="/post-ad-dynamic"
            element={
              <PrivateRoute>
                <PostAdDynamicFormPage />
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
            <Route index element={<DashboardOverviewPage />} />
            <Route path="listings" element={<DashboardListingsPage />} />
            <Route path="orders" element={<DashboardOrdersPage />} />
            <Route path="wishlist" element={<DashboardWishlistPage />} />
            <Route path="messages" element={<DashboardMessagesPage />} />
            <Route path="notifications" element={<DashboardNotificationsPage />} />
            <Route path="notifications/follow-requests" element={<DashboardFollowRequestsPage />} />
            <Route path="settings" element={<DashboardSettingsPage />} />
          </Route>
          <Route path="/user/:id/:type" element={<FollowersFollowingPage />} />
          <Route path="/user/:id" element={<UserProfilePage />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

export default App
