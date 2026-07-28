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
const AdminTransactionsRoutes = lazy(() => import('./pages/transactions'))
const AdminReportsRoutes = lazy(() => import('./pages/reports'))
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
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/login" replace />
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
          <Route path="/login" element={<AdminLoginPage />} />
          <Route
            path="/products/:id"
            element={
              <AdminRoute>
                <ProductDetailPage adminMode />
              </AdminRoute>
            }
          />
          <Route
            path="/chat/:threadId"
            element={
              <AdminRoute>
                <ChatThreadPage />
              </AdminRoute>
            }
          />
          <Route
            path="/users/:id"
            element={
              <AdminRoute>
                <AdminUserProfilePage />
              </AdminRoute>
            }
          />
          <Route
            path="/"
            element={
              <AdminRoute>
                <AdminDashboardPage />
              </AdminRoute>
            }
          />
          <Route
            path="/categories/*"
            element={
              <AdminRoute>
                <AdminCategoriesRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/filters/*"
            element={
              <AdminRoute>
                <AdminFiltersRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/dealers/*"
            element={
              <AdminRoute>
                <AdminDealersRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/emirates/*"
            element={
              <AdminRoute>
                <AdminEmiratesRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/packages/*"
            element={
              <AdminRoute>
                <AdminPackagesRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/storage-facilities/*"
            element={
              <AdminRoute>
                <AdminStorageFacilitiesRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/checkout-services/*"
            element={
              <AdminRoute>
                <AdminCheckoutServicesRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/coupons/*"
            element={
              <AdminRoute>
                <AdminCouponsRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/buyers-coupons/*"
            element={
              <AdminRoute>
                <AdminBuyersCouponsRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/transactions/*"
            element={
              <AdminRoute>
                <AdminTransactionsRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/reports/*"
            element={
              <AdminRoute>
                <AdminReportsRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/roles/*"
            element={
              <AdminRoute>
                <AdminRolesRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/identity-verification"
            element={
              <AdminRoute>
                <AdminIdentityVerificationPage />
              </AdminRoute>
            }
          />
          <Route
            path="/field-types/*"
            element={
              <AdminRoute>
                <AdminFieldTypesRoutes />
              </AdminRoute>
            }
          />
          <Route
            path="/form-fields/*"
            element={
              <AdminRoute>
                <AdminFormFieldsRoutes />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AdminLayout>
  )
}

export default App
