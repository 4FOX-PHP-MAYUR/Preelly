const AdminRolePermission = require('../models/AdminRolePermission')

const MODULE_MAP = {
  dashboard: 'Dashboard',
  categories: 'Categories',
  filters: 'Filters',
  'category-filters': 'Filter Assignments',
  dealers: 'Dealers',
  emirates: 'Emirates',
  'form-fields': 'Form Fields',
  users: 'Users',
  products: 'Listings',
  listings: 'Listings',
}

/**
 * Middleware factory that checks if the admin has a specific permission
 * for a given module.
 *
 * @param {string} moduleName - key from MODULE_MAP or the module display name
 * @param {'can_view'|'can_create'|'can_edit'|'can_delete'} action
 */
const checkPermission = (moduleName, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' })
      }

      if (!req.user.adminRole) {
        return next()
      }

      const resolvedModule = MODULE_MAP[moduleName] || moduleName

      const perm = await AdminRolePermission.findOne({
        role_id: req.user.adminRole,
        module_name: resolvedModule,
      }).lean()

      if (!perm || !perm[action]) {
        return res.status(403).json({
          message: `Access denied. You do not have ${action.replace('can_', '')} permission for ${resolvedModule}.`,
        })
      }

      next()
    } catch (error) {
      console.error('Permission check error:', error)
      res.status(500).json({ message: 'Error checking permissions' })
    }
  }
}

/**
 * Load all permissions for the current admin user and attach to req.permissions
 */
const loadPermissions = async (req, res, next) => {
  try {
    if (!req.user || !req.user.adminRole) {
      req.permissions = null
      return next()
    }

    const perms = await AdminRolePermission.find({ role_id: req.user.adminRole }).lean()
    const permMap = {}
    perms.forEach((p) => {
      permMap[p.module_name] = {
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      }
    })
    req.permissions = permMap
    next()
  } catch (error) {
    console.error('Error loading permissions:', error)
    req.permissions = null
    next()
  }
}

module.exports = { checkPermission, loadPermissions, MODULE_MAP }
