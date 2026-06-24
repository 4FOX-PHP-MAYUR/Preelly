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
} from 'lucide-react'

export const ADMIN_MENU_GROUPS = [
  {
    key: 'overview',
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', to: '/admin', icon: Home },
    ],
  },
  {
    key: 'catalog',
    label: 'Catalog',
    items: [
      { key: 'categories', label: 'Categories', to: '/admin/categories', icon: Layers },
      { key: 'filters', label: 'Filters', to: '/admin/filters', icon: Filter },
      { key: 'field-types', label: 'Field Types', to: '/admin/field-types', icon: Tag },
      { key: 'form-fields', label: 'Form Fields', to: '/admin/form-fields', icon: LayoutList },
    ],
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    items: [
      { key: 'dealers', label: 'Dealers', to: '/admin/dealers', icon: Store },
      { key: 'emirates', label: 'Emirates', to: '/admin/emirates', icon: MapPin },
      { key: 'products', label: 'Products', to: '/admin?tab=products', icon: Box },
      { key: 'sold', label: 'Sold', to: '/admin?tab=sold', icon: TrendingUp },
    ],
  },
  {
    key: 'users',
    label: 'Users & Support',
    items: [
      { key: 'users', label: 'Users', to: '/admin?tab=users', icon: Users },
      { key: 'identity-verification', label: 'Verification', to: '/admin/identity-verification', icon: ShieldCheck },
      { key: 'contacts', label: 'Contacts', to: '/admin?tab=contacts', icon: MessageCircle },
      { key: 'reports', label: 'Reports', to: '/admin?tab=comments', icon: FileText },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    items: [
      { key: 'admin-roles', label: 'Admin Roles', to: '/admin/roles', icon: Shield },
    ],
  },
]

export const MENU_PERMISSION_MAP = {
  dashboard: 'Dashboard',
  categories: 'Categories',
  filters: 'Filters',
  dealers: 'Dealers',
  emirates: 'Emirates',
  products: 'Listings',
  sold: 'Listings',
  users: 'Users',
  'identity-verification': 'Users',
}

export const ADMIN_ROUTE_META = {
  '/admin': { title: 'Dashboard', breadcrumbs: [{ label: 'Dashboard' }] },
  '/admin/categories': { title: 'Categories', breadcrumbs: [{ label: 'Catalog', to: '/admin/categories' }, { label: 'Categories' }] },
  '/admin/filters': { title: 'Filters', breadcrumbs: [{ label: 'Catalog', to: '/admin/filters' }, { label: 'Filters' }] },
  '/admin/dealers': { title: 'Dealers', breadcrumbs: [{ label: 'Marketplace', to: '/admin/dealers' }, { label: 'Dealers' }] },
  '/admin/emirates': { title: 'Emirates', breadcrumbs: [{ label: 'Marketplace', to: '/admin/emirates' }, { label: 'Emirates' }] },
  '/admin/roles': { title: 'Admin Roles', breadcrumbs: [{ label: 'Settings', to: '/admin/roles' }, { label: 'Admin Roles' }] },
  '/admin/identity-verification': { title: 'Identity Verification', breadcrumbs: [{ label: 'Users & Support' }, { label: 'Verification' }] },
  '/admin/field-types': { title: 'Field Types', breadcrumbs: [{ label: 'Catalog' }, { label: 'Field Types' }] },
  '/admin/form-fields': { title: 'Form Fields', breadcrumbs: [{ label: 'Catalog' }, { label: 'Form Fields' }] },
  '/admin/login': { title: 'Admin Login', breadcrumbs: [{ label: 'Login' }] },
}

export const ADMIN_TAB_META = {
  dashboard: { title: 'Dashboard', breadcrumbs: [{ label: 'Dashboard' }] },
  products: { title: 'Products', breadcrumbs: [{ label: 'Marketplace' }, { label: 'Products' }] },
  sold: { title: 'Sold Products', breadcrumbs: [{ label: 'Marketplace' }, { label: 'Sold' }] },
  users: { title: 'Users', breadcrumbs: [{ label: 'Users & Support' }, { label: 'Users' }] },
  contacts: { title: 'Contacts', breadcrumbs: [{ label: 'Users & Support' }, { label: 'Contacts' }] },
  comments: { title: 'Reports', breadcrumbs: [{ label: 'Users & Support' }, { label: 'Reports' }] },
}

/** Metadata for module add/edit routes: /admin/:module/new and /admin/:module/:id/edit */
export const ADMIN_MODULE_FORM_META = {
  categories: { listPath: '/admin/categories', section: 'Catalog', label: 'Categories', singular: 'Category' },
  filters: { listPath: '/admin/filters', section: 'Catalog', label: 'Filters', singular: 'Filter' },
  'field-types': { listPath: '/admin/field-types', section: 'Catalog', label: 'Field Types', singular: 'Field Type' },
  'form-fields': { listPath: '/admin/form-fields', section: 'Catalog', label: 'Form Fields', singular: 'Form Field' },
  dealers: { listPath: '/admin/dealers', section: 'Marketplace', label: 'Dealers', singular: 'Dealer' },
  emirates: { listPath: '/admin/emirates', section: 'Marketplace', label: 'Emirates', singular: 'Emirate' },
  roles: { listPath: '/admin/roles', section: 'Settings', label: 'Admin Roles', singular: 'Role' },
}

export function resolveAdminRouteMeta(pathname) {
  if (ADMIN_ROUTE_META[pathname]) return ADMIN_ROUTE_META[pathname]

  if (pathname.startsWith('/admin/roles/') && pathname.includes('/permissions')) {
    return {
      title: 'Role Permissions',
      breadcrumbs: [{ label: 'Settings', to: '/admin/roles' }, { label: 'Permissions' }],
    }
  }

  const newMatch = pathname.match(/^\/admin\/([^/]+)\/new$/)
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

  const editMatch = pathname.match(/^\/admin\/([^/]+)\/([^/]+)\/edit$/)
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
