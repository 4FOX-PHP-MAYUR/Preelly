import React from 'react'
import { Menu, User, LogOut } from 'lucide-react'
import { useSelector, useDispatch } from 'react-redux'
import { selectUser, logout } from '../../store/slices/authSlice'
import { useNavigate } from 'react-router-dom'

function TopNav({ onMenuClick }) {
  const user = useSelector(selectUser)
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const handleLogout = () => {
    dispatch(logout('user-click'))
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 rounded-lg border border-gray-200 shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
          )}
          <div className="text-base sm:text-lg font-semibold text-gray-800 truncate">Admin Dashboard</div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-sm text-gray-600 truncate max-w-[120px]">{user?.name || 'Admin'}</div>
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-gray-600" />
            </div>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1.5">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default TopNav

