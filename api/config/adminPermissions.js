/**
 * Central registry of admin modules and their actions.
 * Add a new module here to make it available in the permission matrix,
 * seed data, and path-based access control.
 *
 * Actions map to AdminRolePermission boolean fields:
 *   view → can_view | create → can_create | edit → can_edit | delete → can_delete
 */

const ACTIONS = ['view', 'create', 'edit', 'delete']

const ACTION_TO_FIELD = {
  view: 'can_view',
  create: 'can_create',
  edit: 'can_edit',
  delete: 'can_delete',
}

/**
 * Display names used as `module_name` in AdminRolePermission documents.
 * Keep these stable — renaming breaks existing role_permissions rows.
 */
const AVAILABLE_MODULES = [
  'Dashboard',
  'Categories',
  'Filters',
  'Filter Assignments',
  'Field Types',
  'Form Fields',
  'Dealers',
  'Emirates',
  'Packages',
  'Storage Facilities',
  'Checkout Services',
  'Testimonials',
  'Coupons',
  'Buyer Coupons',
  'Transactions',
  'Listings',
  'Users',
  'Contacts',
  'Reports',
  'Settings',
  'Admin Users',
]

/** URL-segment / menu-key → module display name */
const MODULE_MAP = {
  dashboard: 'Dashboard',
  categories: 'Categories',
  filters: 'Filters',
  'category-filters': 'Filter Assignments',
  'field-types': 'Field Types',
  'form-fields': 'Form Fields',
  dealers: 'Dealers',
  emirates: 'Emirates',
  packages: 'Packages',
  'storage-facilities': 'Storage Facilities',
  'checkout-services': 'Checkout Services',
  testimonials: 'Testimonials',
  coupons: 'Coupons',
  'buyers-coupons': 'Buyer Coupons',
  'buyer-coupon': 'Buyer Coupons',
  coupon: 'Coupons',
  transactions: 'Transactions',
  products: 'Listings',
  listings: 'Listings',
  sold: 'Listings',
  users: 'Users',
  'identity-verification': 'Users',
  'identity-verifications': 'Users',
  contacts: 'Contacts',
  comments: 'Reports',
  'reported-comments': 'Reports',
  reports: 'Reports',
  'user-reports': 'Reports',
  roles: 'Settings',
  modules: 'Settings',
  'role-assignments': 'Settings',
  'admin-users': 'Admin Users',
  stats: 'Dashboard',
  'support-unread-count': 'Contacts',
}

const SUPER_ADMIN_ROLE_NAME = 'Super Admin'

/**
 * Path-based permission rules for /api/admin/* routes.
 * First matching rule wins. Unmatched routes still require admin auth
 * but skip fine-grained checks (backward compatible).
 */
const ROUTE_PERMISSION_RULES = [
  // Dashboard / stats
  { pattern: /^\/stats/, GET: ['Dashboard', 'can_view'] },

  // Products / listings
  { pattern: /^\/products/, GET: ['Listings', 'can_view'], PUT: ['Listings', 'can_edit'], PATCH: ['Listings', 'can_edit'], POST: ['Listings', 'can_create'], DELETE: ['Listings', 'can_delete'] },

  // Categories
  { pattern: /^\/categories/, GET: ['Categories', 'can_view'], POST: ['Categories', 'can_create'], PATCH: ['Categories', 'can_edit'], PUT: ['Categories', 'can_edit'], DELETE: ['Categories', 'can_delete'] },

  // Filters
  { pattern: /^\/filters/, GET: ['Filters', 'can_view'], POST: ['Filters', 'can_create'], PATCH: ['Filters', 'can_edit'], PUT: ['Filters', 'can_edit'], DELETE: ['Filters', 'can_delete'] },
  { pattern: /^\/category-filters/, GET: ['Filter Assignments', 'can_view'], POST: ['Filter Assignments', 'can_create'], PATCH: ['Filter Assignments', 'can_edit'], PUT: ['Filter Assignments', 'can_edit'], DELETE: ['Filter Assignments', 'can_delete'] },

  // Field types & form fields
  { pattern: /^\/field-types/, GET: ['Field Types', 'can_view'], POST: ['Field Types', 'can_create'], PATCH: ['Field Types', 'can_edit'], PUT: ['Field Types', 'can_edit'], DELETE: ['Field Types', 'can_delete'] },
  { pattern: /^\/form-fields/, GET: ['Form Fields', 'can_view'], POST: ['Form Fields', 'can_create'], PATCH: ['Form Fields', 'can_edit'], PUT: ['Form Fields', 'can_edit'], DELETE: ['Form Fields', 'can_delete'] },

  // Marketplace entities
  { pattern: /^\/dealers/, GET: ['Dealers', 'can_view'], POST: ['Dealers', 'can_create'], PATCH: ['Dealers', 'can_edit'], PUT: ['Dealers', 'can_edit'], DELETE: ['Dealers', 'can_delete'] },
  { pattern: /^\/emirates/, GET: ['Emirates', 'can_view'], POST: ['Emirates', 'can_create'], PATCH: ['Emirates', 'can_edit'], PUT: ['Emirates', 'can_edit'], DELETE: ['Emirates', 'can_delete'] },
  { pattern: /^\/packages/, GET: ['Packages', 'can_view'], POST: ['Packages', 'can_create'], PATCH: ['Packages', 'can_edit'], PUT: ['Packages', 'can_edit'], DELETE: ['Packages', 'can_delete'] },
  { pattern: /^\/storage-facilities/, GET: ['Storage Facilities', 'can_view'], POST: ['Storage Facilities', 'can_create'], PATCH: ['Storage Facilities', 'can_edit'], PUT: ['Storage Facilities', 'can_edit'], DELETE: ['Storage Facilities', 'can_delete'] },
  { pattern: /^\/checkout-services/, GET: ['Checkout Services', 'can_view'], POST: ['Checkout Services', 'can_create'], PATCH: ['Checkout Services', 'can_edit'], PUT: ['Checkout Services', 'can_edit'], DELETE: ['Checkout Services', 'can_delete'] },
  { pattern: /^\/testimonials/, GET: ['Testimonials', 'can_view'], POST: ['Testimonials', 'can_create'], PATCH: ['Testimonials', 'can_edit'], PUT: ['Testimonials', 'can_edit'], DELETE: ['Testimonials', 'can_delete'] },

  // Coupons (admin routes under /api/admin if any; also used for consistency)
  { pattern: /^\/coupons/, GET: ['Coupons', 'can_view'], POST: ['Coupons', 'can_create'], PATCH: ['Coupons', 'can_edit'], PUT: ['Coupons', 'can_edit'], DELETE: ['Coupons', 'can_delete'] },
  { pattern: /^\/transactions/, GET: ['Transactions', 'can_view'], POST: ['Transactions', 'can_create'], PATCH: ['Transactions', 'can_edit'], PUT: ['Transactions', 'can_edit'], DELETE: ['Transactions', 'can_delete'] },

  // Users & verification
  { pattern: /^\/users/, GET: ['Users', 'can_view'], POST: ['Users', 'can_create'], PUT: ['Users', 'can_edit'], PATCH: ['Users', 'can_edit'], DELETE: ['Users', 'can_delete'] },
  { pattern: /^\/identity-verifications/, GET: ['Users', 'can_view'], PUT: ['Users', 'can_edit'], PATCH: ['Users', 'can_edit'] },

  // Contacts / support
  { pattern: /^\/contacts/, GET: ['Contacts', 'can_view'] },
  { pattern: /^\/support-unread-count/, GET: ['Contacts', 'can_view'] },

  // Reports
  { pattern: /^\/comments/, GET: ['Reports', 'can_view'], PUT: ['Reports', 'can_edit'], PATCH: ['Reports', 'can_edit'] },
  { pattern: /^\/reported-comments/, GET: ['Reports', 'can_view'], PUT: ['Reports', 'can_edit'], PATCH: ['Reports', 'can_edit'] },
  { pattern: /^\/user-reports/, GET: ['Reports', 'can_view'], PUT: ['Reports', 'can_edit'], PATCH: ['Reports', 'can_edit'] },

  // Roles & permissions (Settings)
  { pattern: /^\/roles/, GET: ['Settings', 'can_view'], POST: ['Settings', 'can_create'], PATCH: ['Settings', 'can_edit'], PUT: ['Settings', 'can_edit'], DELETE: ['Settings', 'can_delete'] },
  { pattern: /^\/modules/, GET: ['Settings', 'can_view'] },
  // Assign Users — mapping layer between admin users and admin roles (Settings)
  { pattern: /^\/role-assignments/, GET: ['Settings', 'can_view'], POST: ['Settings', 'can_create'], PATCH: ['Settings', 'can_edit'], PUT: ['Settings', 'can_edit'], DELETE: ['Settings', 'can_delete'] },

  // Admin Users — separate module for managing admin accounts (own permission bucket)
  { pattern: /^\/admin-users/, GET: ['Admin Users', 'can_view'], POST: ['Admin Users', 'can_create'], PATCH: ['Admin Users', 'can_edit'], PUT: ['Admin Users', 'can_edit'], DELETE: ['Admin Users', 'can_delete'] },
]

function resolveModuleName(keyOrName) {
  if (!keyOrName) return null
  if (AVAILABLE_MODULES.includes(keyOrName)) return keyOrName
  return MODULE_MAP[keyOrName] || keyOrName
}

function actionToField(action) {
  if (!action) return null
  if (action.startsWith('can_')) return action
  return ACTION_TO_FIELD[action] || null
}

function isSuperAdminRole(role) {
  if (!role) return false
  if (role.is_system === true) return true
  const name = String(role.role_name || '').trim().toLowerCase().replace(/\s+/g, '')
  // Match "Super Admin", "SuperAdmin", "super_admin", etc.
  return name === 'superadmin'
}

function buildFullPermissionSet() {
  return AVAILABLE_MODULES.map((module_name) => ({
    module_name,
    can_view: true,
    can_create: true,
    can_edit: true,
    can_delete: true,
  }))
}

function hasAnyPermissionSelected(permissions) {
  if (!Array.isArray(permissions) || permissions.length === 0) return false
  return permissions.some(
    (p) => p.can_view || p.can_create || p.can_edit || p.can_delete
  )
}

module.exports = {
  ACTIONS,
  ACTION_TO_FIELD,
  AVAILABLE_MODULES,
  MODULE_MAP,
  SUPER_ADMIN_ROLE_NAME,
  ROUTE_PERMISSION_RULES,
  resolveModuleName,
  actionToField,
  isSuperAdminRole,
  buildFullPermissionSet,
  hasAnyPermissionSelected,
}
