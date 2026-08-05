import { useSelector } from 'react-redux'
import { selectAdminPermissions } from '../store/adminAuthSlice'

/**
 * Hook for checking admin module permissions.
 * When permissions is null (admin without assigned role), all checks pass
 * for backward compatibility.
 */
export function usePermission(moduleName) {
  const permissions = useSelector(selectAdminPermissions)

  const has = (action) => {
    if (!permissions) return true
    if (!moduleName) return true
    const mod = permissions[moduleName]
    if (!mod) return false
    const field = action.startsWith('can_') ? action : `can_${action}`
    return !!mod[field]
  }

  return {
    permissions,
    /** Full access when no role is assigned */
    isUnrestricted: permissions == null,
    canView: has('view'),
    canCreate: has('create'),
    canEdit: has('edit'),
    canDelete: has('delete'),
    hasPermission: has,
  }
}

export default usePermission
