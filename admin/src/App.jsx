import { Suspense, lazy, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import AdminLayout from './components/Layout/AdminLayout'
import {
  initializeAuth,
  selectAuthHydrating,
  selectIsAuthenticated,
  selectIsAdmin,
  selectPermissions,
} from '@shared/store/slices/authSlice'
import PermissionRoute from './components/PermissionRoute'
import ForbiddenPage from './pages/ForbiddenPage'

const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'))
const AdminCategoriesRoutes = lazy(() => import('./pages/categories'))
const AdminFiltersRoutes = lazy(() => import('./pages/filters'))
const AdminDealersRoutes = lazy(() => import('./pages/dealers'))
const AdminUsersRoutes = lazy(() => import('./pages/users'))
const AdminEmiratesRoutes = lazy(() => import('./pages/emirates'))
const AdminPackagesRoutes = lazy(() => import('./pages/packages'))
const AdminStorageFacilitiesRoutes = lazy(() => import('./pages/storage-facilities'))
const AdminCheckoutServicesRoutes = lazy(() => import('./pages/checkout-services'))
const AdminTestimonialsRoutes = lazy(() => import('./pages/testimonials'))
const AdminCouponsRoutes = lazy(() => import('./pages/coupons'))
const AdminBuyersCouponsRoutes = lazy(() => import('./pages/buyers-coupons'))
const AdminTransactionsRoutes = lazy(() => import('./pages/transactions'))
const AdminReportsRoutes = lazy(() => import('./pages/reports'))
const AdminRolesRoutes = lazy(() => import('./pages/roles'))
const AdminIdentityVerificationPage = lazy(() => import('./pages/AdminIdentityVerificationPage'))
const AdminFieldTypesRoutes = lazy(() => import('./pages/field-types'))
const AdminFormFieldsRoutes = lazy(() => import('./pages/form-fields'))
const ProductDetailPage = lazy(() => import('@shared/pages/ProductDetailPage'))
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

/** Infers view/create/edit from the current path under a module. */
function ModulePermissionRoute({ module, children }) {
  const location = useLocation()
  let action = 'can_view'
  if (/\/new\/?$/.test(location.pathname)) action = 'can_create'
  else if (/\/[^/]+\/edit\/?$/.test(location.pathname)) action = 'can_edit'
  return (
    <PermissionRoute module={module} action={action}>
      {children}
    </PermissionRoute>
  )
}

/** Dashboard tabs map to modules; block direct ?tab= access without View. */
function DashboardPermissionGate({ children }) {
  const location = useLocation()
  const permissions = useSelector(selectPermissions)
  const hydrating = useSelector(selectAuthHydrating)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const isAdmin = useSelector(selectIsAdmin)

  if (hydrating) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/login" replace />

  if (permissions) {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab') || 'dashboard'
    const tabModule = {
      dashboard: 'Dashboard',
      products: 'Listings',
      sold: 'Listings',
      contacts: 'Contacts',
      comments: 'Reports',
    }[tab]

    if (location.pathname === '/products' || location.pathname.startsWith('/products/')) {
      const mod = permissions.Listings
      if (!mod?.can_view) return <ForbiddenPage moduleName="Listings" />
    } else if (tabModule) {
      const mod = permissions[tabModule]
      if (!mod?.can_view) return <ForbiddenPage moduleName={tabModule} />
    }
  }

  return children
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
            path="/products"
            element={
              <DashboardPermissionGate>
                <AdminDashboardPage />
              </DashboardPermissionGate>
            }
          />
          <Route
            path="/products/pending"
            element={
              <DashboardPermissionGate>
                <AdminDashboardPage />
              </DashboardPermissionGate>
            }
          />
          <Route
            path="/products/approved"
            element={
              <DashboardPermissionGate>
                <AdminDashboardPage />
              </DashboardPermissionGate>
            }
          />
          <Route
            path="/products/sold"
            element={
              <DashboardPermissionGate>
                <AdminDashboardPage />
              </DashboardPermissionGate>
            }
          />
          <Route
            path="/products/:id"
            element={
              <PermissionRoute module="Listings" action="can_view">
                <ProductDetailPage adminMode />
              </PermissionRoute>
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
            path="/users/*"
            element={
              <ModulePermissionRoute module="Users">
                <AdminUsersRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route
            path="/"
            element={
              <DashboardPermissionGate>
                <AdminDashboardPage />
              </DashboardPermissionGate>
            }
          />
          <Route
            path="/categories/*"
            element={
              <ModulePermissionRoute module="Categories">
                <AdminCategoriesRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route
            path="/filters/*"
            element={
              <ModulePermissionRoute module="Filters">
                <AdminFiltersRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route
            path="/dealers/*"
            element={
              <ModulePermissionRoute module="Dealers">
                <AdminDealersRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route
            path="/emirates/*"
            element={
              <ModulePermissionRoute module="Emirates">
                <AdminEmiratesRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route
            path="/packages/*"
            element={
              <ModulePermissionRoute module="Packages">
                <AdminPackagesRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route
            path="/storage-facilities/*"
            element={
              <ModulePermissionRoute module="Storage Facilities">
                <AdminStorageFacilitiesRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route
            path="/checkout-services/*"
            element={
              <ModulePermissionRoute module="Checkout Services">
                <AdminCheckoutServicesRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route
            path="/testimonials/*"
            element={
              <ModulePermissionRoute module="Testimonials">
                <AdminTestimonialsRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route
            path="/coupons/*"
            element={
              <ModulePermissionRoute module="Coupons">
                <AdminCouponsRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route
            path="/buyers-coupons/*"
            element={
              <ModulePermissionRoute module="Buyer Coupons">
                <AdminBuyersCouponsRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route
            path="/transactions/*"
            element={
              <ModulePermissionRoute module="Transactions">
                <AdminTransactionsRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route
            path="/reports/*"
            element={
              <ModulePermissionRoute module="Reports">
                <AdminReportsRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route
            path="/roles/*"
            element={
              <ModulePermissionRoute module="Settings">
                <AdminRolesRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route
            path="/identity-verification"
            element={
              <PermissionRoute module="Users" action="can_view">
                <AdminIdentityVerificationPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/field-types/*"
            element={
              <ModulePermissionRoute module="Field Types">
                <AdminFieldTypesRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route
            path="/form-fields/*"
            element={
              <ModulePermissionRoute module="Form Fields">
                <AdminFormFieldsRoutes />
              </ModulePermissionRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AdminLayout>
  )
}

export default App
