import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Home, Box, Layers, Users, FileText, ChevronLeft, ChevronRight, TrendingUp, MessageCircle, Store, Settings, Shield, ChevronDown } from 'lucide-react'
import { selectPermissions } from '../../store/slices/authSlice'

const MENU = [
  { key: 'dashboard', label: 'Dashboard', to: '/admin', icon: Home },
  { key: 'categories', label: 'Categories', to: '/admin/categories', icon: Layers },
  { key: 'filters', label: 'Filters', to: '/admin/filters', icon: Layers },
  { key: 'dealers', label: 'Dealers', to: '/admin/dealers', icon: Store },
  { key: 'products', label: 'Products', to: '/admin?tab=products', icon: Box },
  { key: 'sold', label: 'Sold', to: '/admin?tab=sold', icon: TrendingUp },
  { key: 'contacts', label: 'Contacts', to: '/admin?tab=contacts', icon: MessageCircle },
  { key: 'users', label: 'Users', to: '/admin?tab=users', icon: Users },
  { key: 'reports', label: 'Reports', to: '/admin?tab=comments', icon: FileText },
  {
    key: 'settings',
    label: 'Settings',
    icon: Settings,
    children: [
      { key: 'admin-roles', label: 'Admin Roles', to: '/admin/roles', icon: Shield },
    ],
  },
]

const MENU_PERMISSION_MAP = {
  dashboard: 'Dashboard',
  categories: 'Categories',
  filters: 'Filters',
  dealers: 'Dealers',
  products: 'Listings',
  sold: 'Listings',
  users: 'Users',
}

function Sidebar() {
  const [open, setOpen] = useState(true)
  const [expandedSections, setExpandedSections] = useState({ settings: true })
  const location = useLocation()
  const search = location.search || ''
  const permissions = useSelector(selectPermissions)

  const canViewModule = (menuKey) => {
    if (!permissions) return true
    const moduleName = MENU_PERMISSION_MAP[menuKey]
    if (!moduleName) return true
    if (!permissions[moduleName]) return false
    return !!permissions[moduleName].can_view
  }

  const isItemActive = (item) => {
    try {
      const pathname = location.pathname
      const params = new URLSearchParams(search)
      const currentTab = params.get('tab')

      if (item.to && item.to.includes('?tab=')) {
        const tab = new URLSearchParams(item.to.split('?')[1]).get('tab')
        return pathname === '/admin' && currentTab === tab
      } else if (item.to === '/admin') {
        return pathname === '/admin' && (!currentTab || currentTab === 'dashboard')
      } else if (item.to) {
        return pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to))
      }
    } catch {
      return location.pathname === item.to
    }
    return false
  }

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <aside className={`h-screen sticky top-0 bg-slate-900 text-slate-200 flex-shrink-0 ${open ? 'w-64' : 'w-20'} transition-all duration-200`}>
      <div className="h-full flex flex-col">
        <div className={`flex items-center ${open ? 'justify-between' : 'justify-center'} p-4 border-b border-slate-800`}>
          <div className={`flex items-center ${open ? 'gap-3' : ''}`}>
            {!open && (
              <div className="bg-indigo-600 w-9 h-9 rounded flex items-center justify-center text-white font-bold">
                P
              </div>
            )}
            {open && (
              <div>
                <div className="font-semibold text-lg text-center">Preelly</div>
              </div>
            )}
          </div>
          {open ? (
            <button onClick={() => setOpen(!open)} className="p-1">
              <ChevronLeft className="h-4 w-4 text-slate-200" />
            </button>
          ) : (
            <button onClick={() => setOpen(!open)} className="p-1 absolute right-3 top-3">
              <ChevronRight className="h-4 w-4 text-slate-200" />
            </button>
          )}
        </div>

        <nav className="p-3 flex-1 overflow-auto space-y-1">
          {MENU.filter((item) => canViewModule(item.key)).map((item) => {
            const Icon = item.icon
            const hasChildren = item.children && item.children.length > 0
            const isParentOnly = hasChildren && !item.to

            if (isParentOnly) {
              const isExpanded = expandedSections[item.key]
              const childActive = item.children.some((c) => isItemActive(c))

              return (
                <div key={item.key} className="flex flex-col items-stretch">
                  <button
                    onClick={() => toggleSection(item.key)}
                    title={item.label}
                    className={`flex items-center w-full ${open ? 'gap-3 px-3 py-2 justify-start' : 'justify-center py-3'} rounded-lg transition-colors ${childActive ? 'text-indigo-400' : 'text-slate-200 hover:bg-slate-800'}`}
                  >
                    {Icon && <Icon className="h-5 w-5" />}
                    {open && (
                      <>
                        <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </button>
                  {open && isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.children.map((c) => {
                        const CIcon = c.icon
                        const cActive = isItemActive(c)
                        return (
                          <Link
                            key={c.key}
                            to={c.to}
                            title={c.label}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${cActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                          >
                            {CIcon && <CIcon className="h-4 w-4" />}
                            {c.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            const active = isItemActive(item)
            return (
              <div key={item.key} className="flex flex-col items-stretch">
                <Link
                  to={item.to}
                  title={item.label}
                  className={`flex items-center ${open ? 'gap-3 px-3 py-2 justify-start' : 'justify-center py-3'} rounded-lg transition-colors ${active ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-slate-800'}`}
                >
                  {Icon && <Icon className="h-5 w-5" />}
                  {open && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
                {open && hasChildren && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.children.map((c) => (
                      <Link
                        key={c.key}
                        to={c.to}
                        title={c.label}
                        className={`block px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800 ${location.pathname === c.to ? 'bg-indigo-600 text-white' : ''}`}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}

export default Sidebar
