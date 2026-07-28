import {
  Home,
  Layers,
  Filter,
  Store,
  MapPin,
  Box,
  TrendingUp,
  MessageCircle,
  Users,
  ShieldCheck,
  FileText,
  Tag,
  LayoutList,
  Settings,
  Shield,
  Package,
  Warehouse,
  Ticket,
  CreditCard,
  BadgePercent,
} from 'lucide-react'

// App routes are root-relative. Nginx + Vite base=/admin/ mount the app under /admin.
export const ADMIN_MENU_GROUPS = [
  {
    key: 'overview',
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', to: '/', icon: Home },
    ],
  },
  {
    key: 'catalog',
    label: 'Catalog',
    items: [
      { key: 'categories', label: 'Categories', to: '/categories', icon: Layers },
      { key: 'filters', label: 'Filters', to: '/filters', icon: Filter },
      { key: 'field-types', label: 'Field Types', to: '/field-types', icon: Tag },
      { key: 'form-fields', label: 'Form Fields', to: '/form-fields', icon: LayoutList },
    ],
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    items: [
      { key: 'dealers', label: 'Dealers', to: '/dealers', icon: Store },
      { key: 'emirates', label: 'Emirates', to: '/emirates', icon: MapPin },
      { key: 'packages', label: 'Packages', to: '/packages', icon: Package },
      { key: 'storage-facilities', label: 'Storage Facilities', to: '/storage-facilities', icon: Warehouse },
      { key: 'checkout-services', label: 'Checkout Services', to: '/checkout-services', icon: CreditCard },
      { key: 'coupons', label: 'Coupons', to: '/coupons', icon: Ticket },
      { key: 'buyers-coupons', label: 'Buyer Coupons', to: '/buyers-coupons', icon: BadgePercent },
      { key: 'products', label: 'Products', to: '/?tab=products', icon: Box },
      { key: 'sold', label: 'Sold', to: '/?tab=sold', icon: TrendingUp },
    ],
  },
  {
    key: 'users',
    label: 'Users & Support',
    items: [
      { key: 'users', label: 'Users', to: '/?tab=users', icon: Users },
      { key: 'identity-verification', label: 'Verification', to: '/identity-verification', icon: ShieldCheck },
      { key: 'contacts', label: 'Contacts', to: '/?tab=contacts', icon: MessageCircle },
      { key: 'reports', label: 'Reports', to: '/?tab=comments', icon: FileText },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    items: [
      { key: 'admin-roles', label: 'Admin Roles', to: '/roles', icon: Shield },
    ],
  },
]

export const MENU_PERMISSION_MAP = {
  dashboard: 'Dashboard',
  categories: 'Categories',
  filters: 'Filters',
  dealers: 'Dealers',
  emirates: 'Emirates',
  packages: 'Packages',
  'storage-facilities': 'Storage Facilities',
  'checkout-services': 'Checkout Services',
  coupons: 'Coupons',
  'buyers-coupons': 'Buyer Coupons',
  products: 'Listings',
  sold: 'Listings',
  users: 'Users',
  'identity-verification': 'Users',
}

export const ADMIN_ROUTE_META = {
  '/': { title: 'Dashboard', breadcrumbs: [{ label: 'Dashboard' }] },
  '/categories': { title: 'Categories', breadcrumbs: [{ label: 'Catalog', to: '/categories' }, { label: 'Categories' }] },
  '/filters': { title: 'Filters', breadcrumbs: [{ label: 'Catalog', to: '/filters' }, { label: 'Filters' }] },
  '/dealers': { title: 'Dealers', breadcrumbs: [{ label: 'Marketplace', to: '/dealers' }, { label: 'Dealers' }] },
  '/emirates': { title: 'Emirates', breadcrumbs: [{ label: 'Marketplace', to: '/emirates' }, { label: 'Emirates' }] },
  '/packages': { title: 'Packages', breadcrumbs: [{ label: 'Marketplace', to: '/packages' }, { label: 'Packages' }] },
  '/storage-facilities': { title: 'Storage Facilities', breadcrumbs: [{ label: 'Marketplace', to: '/storage-facilities' }, { label: 'Storage Facilities' }] },
  '/checkout-services': { title: 'Checkout Services', breadcrumbs: [{ label: 'Marketplace', to: '/checkout-services' }, { label: 'Checkout Services' }] },
  '/coupons': { title: 'Coupons', breadcrumbs: [{ label: 'Marketplace', to: '/coupons' }, { label: 'Coupons' }] },
  '/buyers-coupons': { title: 'Buyer Coupons', breadcrumbs: [{ label: 'Marketplace', to: '/buyers-coupons' }, { label: 'Buyer Coupons' }] },
  '/roles': { title: 'Admin Roles', breadcrumbs: [{ label: 'Settings', to: '/roles' }, { label: 'Admin Roles' }] },
  '/identity-verification': { title: 'Identity Verification', breadcrumbs: [{ label: 'Users & Support' }, { label: 'Verification' }] },
  '/field-types': { title: 'Field Types', breadcrumbs: [{ label: 'Catalog' }, { label: 'Field Types' }] },
  '/form-fields': { title: 'Form Fields', breadcrumbs: [{ label: 'Catalog' }, { label: 'Form Fields' }] },
  '/login': { title: 'Admin Login', breadcrumbs: [{ label: 'Login' }] },
}

export const ADMIN_TAB_META = {
  dashboard: { title: 'Dashboard', breadcrumbs: [{ label: 'Dashboard' }] },
  products: { title: 'Products', breadcrumbs: [{ label: 'Marketplace' }, { label: 'Products' }] },
  sold: { title: 'Sold Products', breadcrumbs: [{ label: 'Marketplace' }, { label: 'Sold' }] },
  users: { title: 'Users', breadcrumbs: [{ label: 'Users & Support' }, { label: 'Users' }] },
  contacts: { title: 'Contacts', breadcrumbs: [{ label: 'Users & Support' }, { label: 'Contacts' }] },
  comments: { title: 'Reports', breadcrumbs: [{ label: 'Users & Support' }, { label: 'Reports' }] },
}

/** Metadata for module add/edit routes: /:module/new and /:module/:id/edit */
export const ADMIN_MODULE_FORM_META = {
  categories: { listPath: '/categories', section: 'Catalog', label: 'Categories', singular: 'Category' },
  filters: { listPath: '/filters', section: 'Catalog', label: 'Filters', singular: 'Filter' },
  'field-types': { listPath: '/field-types', section: 'Catalog', label: 'Field Types', singular: 'Field Type' },
  'form-fields': { listPath: '/form-fields', section: 'Catalog', label: 'Form Fields', singular: 'Form Field' },
  dealers: { listPath: '/dealers', section: 'Marketplace', label: 'Dealers', singular: 'Dealer' },
  emirates: { listPath: '/emirates', section: 'Marketplace', label: 'Emirates', singular: 'Emirate' },
  packages: { listPath: '/packages', section: 'Marketplace', label: 'Packages', singular: 'Package' },
  'storage-facilities': { listPath: '/storage-facilities', section: 'Marketplace', label: 'Storage Facilities', singular: 'Storage Facility' },
  'checkout-services': { listPath: '/checkout-services', section: 'Marketplace', label: 'Checkout Services', singular: 'Checkout Service' },
  coupons: { listPath: '/coupons', section: 'Marketplace', label: 'Coupons', singular: 'Coupon' },
  'buyers-coupons': { listPath: '/buyers-coupons', section: 'Marketplace', label: 'Buyer Coupons', singular: 'Buyer Coupon' },
  roles: { listPath: '/roles', section: 'Settings', label: 'Admin Roles', singular: 'Role' },
}

export function resolveAdminRouteMeta(pathname) {
  if (ADMIN_ROUTE_META[pathname]) return ADMIN_ROUTE_META[pathname]

  if (pathname.startsWith('/roles/') && pathname.includes('/permissions')) {
    return {
      title: 'Role Permissions',
      breadcrumbs: [{ label: 'Settings', to: '/roles' }, { label: 'Permissions' }],
    }
  }

  const newMatch = pathname.match(/^\/([^/]+)\/new$/)
  if (newMatch) {
    const config = ADMIN_MODULE_FORM_META[newMatch[1]]
    if (config) {
      return {
        title: `Add ${config.singular}`,
        breadcrumbs: [
          { label: config.section, to: config.listPath },
          { label: config.label, to: config.listPath },
          { label: 'Add' },
        ],
      }
    }
  }

  const editMatch = pathname.match(/^\/([^/]+)\/([^/]+)\/edit$/)
  if (editMatch) {
    const config = ADMIN_MODULE_FORM_META[editMatch[1]]
    if (config) {
      return {
        title: `Edit ${config.singular}`,
        breadcrumbs: [
          { label: config.section, to: config.listPath },
          { label: config.label, to: config.listPath },
          { label: 'Edit' },
        ],
      }
    }
  }

  return { title: 'Admin', breadcrumbs: [] }
}
