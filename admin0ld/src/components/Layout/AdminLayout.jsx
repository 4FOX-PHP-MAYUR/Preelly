import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { selectIsAuthenticated, selectUser, logout } from '@shared/store/slices/authSlice'
import Sidebar from '../AdminUI/Sidebar'
import TopNav from '../AdminUI/TopNav'
import { AdminThemeProvider } from '../AdminUI/AdminThemeContext'

function AdminLayout({ children }) {
  const location = useLocation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const [mobileAdminOpen, setMobileAdminOpen] = useState(false)

  const isLoginRoute = location.pathname === '/admin/login'

  const handleLogout = () => {
    dispatch(logout('user-click'))
    navigate('/admin/login')
  }

  if (isLoginRoute) {
    return (
      <AdminThemeProvider>
        <div className="admin-shell">
          <main className="admin-content">{children}</main>
        </div>
      </AdminThemeProvider>
    )
  }

  return (
    <AdminThemeProvider>
      <div className="admin-shell flex">
        <div className="hidden md:block md:flex-shrink-0">
          <Sidebar mobileOpen={false} onMobileClose={() => {}} />
        </div>
        <div className="md:hidden">
          <Sidebar
            mobileOpen={mobileAdminOpen}
            onMobileClose={() => setMobileAdminOpen(false)}
          />
        </div>
        <div className="admin-main">
          <TopNav onMenuClick={() => setMobileAdminOpen((v) => !v)} />
          <main className="admin-content">{children}</main>
        </div>
      </div>
    </AdminThemeProvider>
  )
}

export default AdminLayout
