import React from 'react'
import { User, LogOut } from 'lucide-react'
import { useSelector, useDispatch } from 'react-redux'
import { selectUser, logout } from '../../store/slices/authSlice'
import { useNavigate } from 'react-router-dom'

function TopNav() {
  const user = useSelector(selectUser)
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const handleLogout = () => {
    dispatch(logout())
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="text-lg font-semibold text-gray-800">Dashboard</div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">{user?.name || 'Admin'}</div>
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <User className="h-5 w-5 text-gray-600" />
            </div>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default TopNav

