import { Suspense, lazy, useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import AdminLayout from './components/Layout/AdminLayout'
import {
  initializeAuth,
  selectAuthHydrating,
  selectIsAuthenticated,
  selectIsAdmin,
} from '@shared/store/slices/authSlice'
import AdminUserIdentityPanel from './components/AdminUI/AdminUserIdentityPanel'

const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'))
const AdminCategoriesRoutes = lazy(() => import('./pages/categories'))
const AdminFiltersRoutes = lazy(() => import('./pages/filters'))
const AdminDealersRoutes = lazy(() => import('./pages/dealers'))
const AdminEmiratesRoutes = lazy(() => import('./pages/emirates'))
const AdminPackagesRoutes = lazy(() => import('./pages/packages'))
const AdminStorageFacilitiesRoutes = lazy(() => import('./pages/storage-facilities'))
const AdminCheckoutServicesRoutes = lazy(() => import('./pages/checkout-services'))
const AdminCouponsRoutes = lazy(() => import('./pages/coupons'))
const AdminBuyersCouponsRoutes = lazy(() => import('./pages/buyers-coupons'))
const AdminRolesRoutes = lazy(() => import('./pages/roles'))
const AdminIdentityVerificationPage = lazy(() => import('./pages/AdminIdentityVerificationPage'))
const AdminFieldTypesRoutes = lazy(() => import('./pages/field-types'))
const AdminFormFieldsRoutes = lazy(() => import('./pages/form-fields'))
const ProductDetailPage = lazy(() => import('@shared/pages/ProductDetailPage'))
const UserProfilePage = lazy(() => import('@shared/pages/UserProfilePage'))
const ChatThreadPage = lazy(() => import('@shared/pages/ChatThreadPage'))

function AdminRoute({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const isAdmin = useSelector(selectIsAdmin)
  const hydrating = useSelector(selectAuthHydrating)
  if (hydrating) return null
  if (!isAuthenticated) return <Navigate to="/admin/login" />
  if (!isAdmin) return <Navigate to="/admin/login" />
  return children
}

function AdminUserProfilePage() {
  return (
    <UserProfilePage
      adminMode
      renderAdminPanel={(props) => <AdminUserIdentityPanel {...props} />}
    />
  )
}

function App() {
  const dispatch = useDispatch()
  const authBootstrappedRef = useRef(false)

  useEffect(() => {
    if (authBootstrappedRef.current) return
    authBootstrappedRef.current = true
    dispatch(initializeAuth())
  }, [dispatch])

  return (
    <AdminLayout>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin/products/:id"
            element={
              <AdminRoute>
                <ProductDetailPage />
              </AdminRoute>
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
            path="/admin/users/:id"
            element={
              <AdminRoute>
                <AdminUserProfilePage />
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
            path="/admin/categories/*"
            element={
              <AdminRoute>
                <AdminCategoriesRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/filters/*"
            element={
              <AdminRoute>
                <AdminFiltersRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/dealers/*"
            element={
              <AdminRoute>
                <AdminDealersRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/emirates/*"
            element={
              <AdminRoute>
                <AdminEmiratesRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/packages/*"
            element={
              <AdminRoute>
                <AdminPackagesRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/storage-facilities/*"
            element={
              <AdminRoute>
                <AdminStorageFacilitiesRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/checkout-services/*"
            element={
              <AdminRoute>
                <AdminCheckoutServicesRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/coupons/*"
            element={
              <AdminRoute>
                <AdminCouponsRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/buyers-coupons/*"
            element={
              <AdminRoute>
                <AdminBuyersCouponsRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/roles/*"
            element={
              <AdminRoute>
                <AdminRolesRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/identity-verification"
            element={
              <AdminRoute>
                <AdminIdentityVerificationPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/field-types/*"
            element={
              <AdminRoute>
                <AdminFieldTypesRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/form-fields/*"
            element={
              <AdminRoute>
                <AdminFormFieldsRoutes />
              </AdminRoute>
            }
          />
        </Routes>
      </Suspense>
    </AdminLayout>
  )
}

export default App
