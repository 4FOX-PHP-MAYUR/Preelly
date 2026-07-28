import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  selectAuthHydrating,
  selectIsAuthenticated,
  selectIsAdmin,
  selectPermissions,
} from '@shared/store/slices/authSlice'
import { ROUTE_PERMISSION_MAP } from '../utils/adminPermissions'
import ForbiddenPage from '../pages/ForbiddenPage'

/**
 * Requires admin auth + optional module View permission.
 * Direct URL access without permission shows 403.
 */
function PermissionRoute({ module: moduleName, action = 'can_view', children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const isAdmin = useSelector(selectIsAdmin)
  const hydrating = useSelector(selectAuthHydrating)
  const permissions = useSelector(selectPermissions)

  if (hydrating) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/login" replace />

  // null permissions = unrestricted (legacy admins without a role)
  if (permissions && moduleName) {
    const mod = permissions[moduleName]
    const field = action.startsWith('can_') ? action : `can_${action}`
    if (!mod || !mod[field]) {
      return <ForbiddenPage moduleName={moduleName} />
    }
  }

  return children
}

/**
 * Resolve module name from a path prefix (e.g. /categories → Categories).
 */
export function moduleForPath(pathname) {
  if (!pathname) return null
  if (pathname === '/') return ROUTE_PERMISSION_MAP['/']
  const match = Object.keys(ROUTE_PERMISSION_MAP)
    .filter((p) => p !== '/')
    .sort((a, b) => b.length - a.length)
    .find((p) => pathname === p || pathname.startsWith(`${p}/`))
  return match ? ROUTE_PERMISSION_MAP[match] : null
}

export default PermissionRoute
