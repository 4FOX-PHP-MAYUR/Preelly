import {
  Home,
  Layers,
  Filter,
  Store,
  MapPin,
  Box,
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
  ArrowLeftRight,
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
      { key: 'transactions', label: 'Transactions', to: '/transactions', icon: ArrowLeftRight },
      {
        key: 'products',
        label: 'Products',
        to: '/products',
        icon: Box,
        children: [
          { key: 'products-all', label: 'All Products', to: '/products', exact: true },
          { key: 'products-pending', label: 'Pending', to: '/products/pending' },
          { key: 'products-approved', label: 'Approved', to: '/products/approved' },
          { key: 'products-sold', label: 'Sold', to: '/products/sold' },
        ],
      },
    ],
  },
  {
    key: 'users',
    label: 'Users & Support',
    items: [
      { key: 'users', label: 'Users', to: '/users', icon: Users },
      { key: 'identity-verification', label: 'Verification', to: '/identity-verification', icon: ShieldCheck },
      { key: 'contacts', label: 'Contacts', to: '/?tab=contacts', icon: MessageCircle },
      { key: 'reports', label: 'Reports', to: '/reports', icon: FileText },
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
  'field-types': 'Field Types',
  'form-fields': 'Form Fields',
  dealers: 'Dealers',
  emirates: 'Emirates',
  packages: 'Packages',
  'storage-facilities': 'Storage Facilities',
  'checkout-services': 'Checkout Services',
  coupons: 'Coupons',
  'buyers-coupons': 'Buyer Coupons',
  transactions: 'Transactions',
  products: 'Listings',
  'products-all': 'Listings',
  'products-pending': 'Listings',
  'products-approved': 'Listings',
  'products-sold': 'Listings',
  users: 'Users',
  'identity-verification': 'Users',
  contacts: 'Contacts',
  reports: 'Reports',
  'admin-roles': 'Settings',
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
  '/transactions': { title: 'Transactions', breadcrumbs: [{ label: 'Marketplace', to: '/transactions' }, { label: 'Transactions' }] },
  '/products': { title: 'All Products', breadcrumbs: [{ label: 'Marketplace', to: '/products' }, { label: 'Products', to: '/products' }, { label: 'All Products' }] },
  '/products/pending': { title: 'Pending Products', breadcrumbs: [{ label: 'Marketplace', to: '/products' }, { label: 'Products', to: '/products' }, { label: 'Pending' }] },
  '/products/approved': { title: 'Approved Products', breadcrumbs: [{ label: 'Marketplace', to: '/products' }, { label: 'Products', to: '/products' }, { label: 'Approved' }] },
  '/products/sold': { title: 'Sold Products', breadcrumbs: [{ label: 'Marketplace', to: '/products' }, { label: 'Products', to: '/products' }, { label: 'Sold' }] },
  '/users': { title: 'Users', breadcrumbs: [{ label: 'Users & Support' }, { label: 'Users' }] },
  '/roles': { title: 'Admin Roles', breadcrumbs: [{ label: 'Settings', to: '/roles' }, { label: 'Admin Roles' }] },
  '/identity-verification': { title: 'Identity Verification', breadcrumbs: [{ label: 'Users & Support' }, { label: 'Verification' }] },
  '/reports': { title: 'User Reports', breadcrumbs: [{ label: 'Users & Support' }, { label: 'Reports' }] },
  '/field-types': { title: 'Field Types', breadcrumbs: [{ label: 'Catalog' }, { label: 'Field Types' }] },
  '/form-fields': { title: 'Form Fields', breadcrumbs: [{ label: 'Catalog' }, { label: 'Form Fields' }] },
  '/login': { title: 'Admin Login', breadcrumbs: [{ label: 'Login' }] },
}

export const ADMIN_TAB_META = {
  dashboard: { title: 'Dashboard', breadcrumbs: [{ label: 'Dashboard' }] },
  products: { title: 'All Products', breadcrumbs: [{ label: 'Marketplace' }, { label: 'Products', to: '/products' }, { label: 'All Products' }] },
  sold: { title: 'Sold Products', breadcrumbs: [{ label: 'Marketplace' }, { label: 'Sold' }] },
  contacts: { title: 'Contacts', breadcrumbs: [{ label: 'Users & Support' }, { label: 'Contacts' }] },
  comments: { title: 'User Reports', breadcrumbs: [{ label: 'Users & Support' }, { label: 'Reports' }] },
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
  transactions: { listPath: '/transactions', section: 'Marketplace', label: 'Transactions', singular: 'Transaction' },
  users: { listPath: '/users', section: 'Users & Support', label: 'Users', singular: 'User' },
  roles: { listPath: '/roles', section: 'Settings', label: 'Admin Roles', singular: 'Role' },
  reports: { listPath: '/reports', section: 'Users & Support', label: 'Reports', singular: 'Report' },
}

export function resolveAdminRouteMeta(pathname) {
  if (ADMIN_ROUTE_META[pathname]) return ADMIN_ROUTE_META[pathname]

  if (pathname.startsWith('/roles/') && pathname.includes('/permissions')) {
    return {
      title: 'Role Permissions',
      breadcrumbs: [{ label: 'Settings', to: '/roles' }, { label: 'Permissions' }],
    }
  }

  if (pathname.startsWith('/roles/') && pathname.includes('/assign')) {
    return {
      title: 'Assign Users',
      breadcrumbs: [{ label: 'Settings', to: '/roles' }, { label: 'Assign Users' }],
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

  // Read-only detail routes: /:module/:id
  const viewMatch = pathname.match(/^\/([^/]+)\/([^/]+)$/)
  if (viewMatch) {
    const config = ADMIN_MODULE_FORM_META[viewMatch[1]]
    if (config) {
      return {
        title: `${config.singular} Details`,
        breadcrumbs: [
          { label: config.section, to: config.listPath },
          { label: config.label, to: config.listPath },
          { label: 'Details' },
        ],
      }
    }
  }

  return { title: 'Admin', breadcrumbs: [] }
}
