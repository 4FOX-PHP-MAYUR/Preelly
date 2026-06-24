import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Shield,
} from 'lucide-react'
import { selectPermissions } from '@shared/store/slices/authSlice'
import BrandLogo from '@shared/components/BrandLogo'
import { ADMIN_MENU_GROUPS, MENU_PERMISSION_MAP } from './adminNavConfig'

function Sidebar({ mobileOpen = false, onMobileClose }) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState(() =>
    Object.fromEntries(ADMIN_MENU_GROUPS.map((g) => [g.key, true]))
  )
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

      if (item.to?.includes('?tab=')) {
        const tab = new URLSearchParams(item.to.split('?')[1]).get('tab')
        return pathname === '/admin' && currentTab === tab
      }
      if (item.to === '/admin') {
        return pathname === '/admin' && (!currentTab || currentTab === 'dashboard')
      }
      if (item.to) {
        return pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to))
      }
    } catch {
      return location.pathname === item.to
    }
    return false
  }

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleNavClick = () => {
    if (mobileOpen) onMobileClose?.()
  }

  const visibleGroups = ADMIN_MENU_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canViewModule(item.key)),
  })).filter((group) => group.items.length > 0)

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`
          admin-sidebar h-screen flex-shrink-0 transition-all duration-300 z-50
          bg-slate-950 text-slate-300 border-r border-slate-800/80
          ${collapsed ? 'w-[72px]' : 'w-64'}
          fixed md:sticky top-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        aria-label="Admin navigation"
      >
        <div className="h-full flex flex-col">
          <div className={`flex items-center h-16 px-4 border-b border-slate-800/80 ${collapsed ? 'justify-center' : 'justify-between'}`}>
            {!collapsed ? (
              <>
                <Link to="/admin" className="overflow-hidden" onClick={handleNavClick}>
                  <BrandLogo variant="dark" className="h-9 w-auto" />
                </Link>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="hidden md:flex items-center justify-center w-full"
                aria-label="Expand sidebar"
              >
                <BrandLogo variant="dark" className="h-8 w-auto" />
              </button>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-5 admin-sidebar-scroll">
            {visibleGroups.map((group) => {
              const isExpanded = expandedGroups[group.key] !== false
              const groupHasActive = group.items.some(isItemActive)

              return (
                <div key={group.key}>
                  {!collapsed && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      className={`flex items-center w-full px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider
                        ${groupHasActive ? 'text-primary-400' : 'text-slate-500 hover:text-slate-400'}`}
                    >
                      <span className="flex-1 text-left">{group.label}</span>
                      <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                    </button>
                  )}
                  {(collapsed || isExpanded) && (
                    <ul className="space-y-0.5" role="list">
                      {group.items.map((item) => {
                        const Icon = item.icon
                        const active = isItemActive(item)
                        return (
                          <li key={item.key}>
                            <Link
                              to={item.to}
                              onClick={handleNavClick}
                              title={item.label}
                              className={`
                                group flex items-center rounded-lg transition-all duration-150
                                ${collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'}
                                ${active
                                  ? 'bg-primary-600/90 text-white shadow-sm shadow-primary-900/20'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'}
                              `}
                              aria-current={active ? 'page' : undefined}
                            >
                              {Icon && (
                                <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                              )}
                              {!collapsed && (
                                <span className="text-sm font-medium truncate">{item.label}</span>
                              )}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </nav>

          <div className={`p-3 border-t border-slate-800/80 ${collapsed ? 'flex justify-center' : ''}`}>
            <div className={`flex items-center ${collapsed ? '' : 'gap-2 px-2 py-2 rounded-lg bg-slate-900/80'}`}>
              <div className="h-8 w-8 rounded-lg bg-primary-600/20 flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-primary-400" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-300 truncate">Admin Console</p>
                  <p className="text-[10px] text-slate-500">Secure access</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="md:hidden absolute -right-3 top-20 h-6 w-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-3 w-3 text-slate-400" />
          </button>
        )}
      </aside>
    </>
  )
}

export default Sidebar
