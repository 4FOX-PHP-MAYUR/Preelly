/**
 * Frontend mirror of admin module permission names.
 * Keep in sync with api/config/adminPermissions.js MODULE_MAP / AVAILABLE_MODULES.
 */
export const ADMIN_PERMISSION_MODULES = [
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
]

/** Route path prefix → module display name for frontend guards */
export const ROUTE_PERMISSION_MAP = {
  '/': 'Dashboard',
  '/categories': 'Categories',
  '/filters': 'Filters',
  '/field-types': 'Field Types',
  '/form-fields': 'Form Fields',
  '/dealers': 'Dealers',
  '/emirates': 'Emirates',
  '/packages': 'Packages',
  '/storage-facilities': 'Storage Facilities',
  '/checkout-services': 'Checkout Services',
  '/testimonials': 'Testimonials',
  '/coupons': 'Coupons',
  '/buyers-coupons': 'Buyer Coupons',
  '/transactions': 'Transactions',
  '/products': 'Listings',
  '/users': 'Users',
  '/roles': 'Settings',
  '/identity-verification': 'Users',
  '/reports': 'Reports',
}

export function emptyPermissionMatrix(modules = ADMIN_PERMISSION_MODULES) {
  return modules.map((module_name) => ({
    module_name,
    can_view: false,
    can_create: false,
    can_edit: false,
    can_delete: false,
  }))
}

export function hasAnyPermissionSelected(permissions) {
  if (!Array.isArray(permissions) || permissions.length === 0) return false
  return permissions.some((p) => p.can_view || p.can_create || p.can_edit || p.can_delete)
}
