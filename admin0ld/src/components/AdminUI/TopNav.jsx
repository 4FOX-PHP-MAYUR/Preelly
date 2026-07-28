import React, { useMemo } from 'react'
import { Menu, LogOut, Sun, Moon, User } from 'lucide-react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { selectUser, logout } from '@shared/store/slices/authSlice'
import { getMediaUrl } from '@shared/utils/helpers'
import Breadcrumbs from './Breadcrumbs'
import { ADMIN_TAB_META, resolveAdminRouteMeta } from './adminNavConfig'
import { useAdminTheme } from './AdminThemeContext'

function TopNav({ onMenuClick }) {
  const user = useSelector(selectUser)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { theme, toggleTheme } = useAdminTheme()

  const pageMeta = useMemo(() => {
    const pathname = location.pathname
    if (pathname === '/admin') {
      const tab = searchParams.get('tab') || 'dashboard'
      return ADMIN_TAB_META[tab] || ADMIN_TAB_META.dashboard
    }
    return resolveAdminRouteMeta(pathname)
  }, [location.pathname, searchParams])

  const handleLogout = () => {
    dispatch(logout('user-click'))
    navigate('/')
  }

  const avatarSrc = user?.avatar ? getMediaUrl(user.avatar) || user.avatar : null

  return (
    <header className="sticky top-0 z-40 admin-topnav bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
      <div className="px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {onMenuClick && (
              <button
                type="button"
                onClick={onMenuClick}
                className="md:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div className="min-w-0">
              {pageMeta.breadcrumbs?.length > 0 && (
                <Breadcrumbs items={pageMeta.breadcrumbs} />
              )}
              <h1 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white truncate">
                {pageMeta.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-700">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-700" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                </div>
              )}
              <div className="hidden lg:block min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[140px]">
                  {user?.name || 'Admin'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                  {user?.email || 'Administrator'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default TopNav
