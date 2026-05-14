import { Suspense, lazy, useMemo } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useEffect } from 'react'
import Layout from './components/Layout/Layout'
import { initializeAuth, selectAuthHydrating, selectIsAuthenticated, selectIsAdmin, selectUser } from './store/slices/authSlice'

const CategoriesPage = lazy(() => import('./pages/CategoriesPage'))
const SubcategoriesPage = lazy(() => import('./pages/SubcategoriesPage'))
const ReelsFeedPage = lazy(() => import('./pages/ReelsFeedPage'))
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'))
const PostAdPage = lazy(() => import('./pages/PostAdPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const DashboardLayout = lazy(() => import('./components/Dashboard/DashboardLayout'))
const DashboardOverviewPage = lazy(() => import('./pages/dashboard/DashboardOverviewPage'))
const DashboardListingsPage = lazy(() => import('./pages/dashboard/DashboardListingsPage'))
const DashboardOrdersPage = lazy(() => import('./pages/dashboard/DashboardOrdersPage'))
const DashboardWishlistPage = lazy(() => import('./pages/dashboard/DashboardWishlistPage'))
const DashboardMessagesPage = lazy(() => import('./pages/dashboard/DashboardMessagesPage'))
const DashboardNotificationsPage = lazy(() => import('./pages/dashboard/DashboardNotificationsPage'))
const DashboardSettingsPage = lazy(() => import('./pages/dashboard/DashboardSettingsPage'))
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'))
const FollowersFollowingPage = lazy(() => import('./pages/FollowersFollowingPage'))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'))
const AdminCategoriesPage = lazy(() => import('./pages/AdminCategoriesPage'))
const AdminFiltersPage = lazy(() => import('./pages/AdminFiltersPage'))
const AdminDealersPage = lazy(() => import('./pages/AdminDealersPage'))
const AdminRolesPage = lazy(() => import('./pages/AdminRolesPage'))
const AdminRolePermissionsPage = lazy(() => import('./pages/AdminRolePermissionsPage'))
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'))
const CategoryProductsPage = lazy(() => import('./pages/CategoryProductsPage'))
const ChatInboxPage = lazy(() => import('./pages/ChatInboxPage'))
const ChatThreadPage = lazy(() => import('./pages/ChatThreadPage'))
const PostAdDynamicFormPage = lazy(() => import('./pages/PostAdDynamicFormPage'))
const VerifyEmailOtpPage = lazy(() => import('./pages/VerifyEmailOtpPage'))
const ProfileSetupPage = lazy(() => import('./pages/ProfileSetupPage'))
const OAuthSuccessPage = lazy(() => import('./pages/OAuthSuccessPage'))
const WelcomePage = lazy(() => import('./pages/WelcomePage'))

function PrivateRoute({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const hydrating = useSelector(selectAuthHydrating)
  const location = useLocation()
  if (hydrating) return null
  const isSellerIntent =
    location.pathname === '/post-ad' || location.pathname === '/post-ad-dynamic'
  const target = isSellerIntent ? 'seller' : 'buyer'

  return isAuthenticated ? children : <Navigate to={`/login?target=${target}`} />
}

function AdminRoute({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const isAdmin = useSelector(selectIsAdmin)
  const hydrating = useSelector(selectAuthHydrating)
  if (hydrating) return null
  if (!isAuthenticated) return <Navigate to="/admin/login" />
  if (!isAdmin) return <Navigate to="/" />
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

  // Hydrate auth state from cookie/JWT so protected routes work after OAuth login.
  useEffect(() => {
    dispatch(initializeAuth())
  }, [dispatch])

  // If profile is incomplete, force profile setup (covers public routes + OAuth redirect paths).
  useEffect(() => {
    if (hydrating) return
    if (!isAuthenticated) return
    if (!user || user.role === 'admin') return
    if (user.isProfileComplete) return
    if (location.pathname === '/profile-setup') return
    navigate(`/profile-setup?target=${inferredTarget}`, { replace: true })
  }, [hydrating, isAuthenticated, user, location.pathname, navigate, inferredTarget])

  return (
    <Layout>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<ReelsFeedPage />} />
          <Route path="/reels" element={<ReelsFeedPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/categories/:categoryId" element={<SubcategoriesPage />} />
          <Route path="/categories/:categoryId/subcategory/:subcategoryId" element={<CategoryProductsPage />} />
          <Route path="/categories/:categoryId/products" element={<CategoryProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route
            path="/admin/products/:id"
            element={
              <AdminRoute>
                <ProductDetailPage />
              </AdminRoute>
            }
          />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email-otp" element={<VerifyEmailOtpPage />} />
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
                <ChatThreadPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/chat/:threadId"
            element={
              <AdminRoute>
                <ChatThreadPage />
              </AdminRoute>
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
            <Route path="settings" element={<DashboardSettingsPage />} />
          </Route>
          <Route path="/user/:id/:type" element={<FollowersFollowingPage />} />
          <Route path="/user/:id" element={<UserProfilePage />} />
          <Route
            path="/admin/users/:id"
            element={
              <AdminRoute>
                <UserProfilePage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboardPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/categories"
            element={
              <AdminRoute>
                <AdminCategoriesPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/filters"
            element={
              <AdminRoute>
                <AdminFiltersPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/dealers"
            element={
              <AdminRoute>
                <AdminDealersPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <AdminRoute>
                <AdminRolesPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/roles/:id/permissions"
            element={
              <AdminRoute>
                <AdminRolePermissionsPage />
              </AdminRoute>
            }
          />
        </Routes>
      </Suspense>
    </Layout>
  )
}

export default App

